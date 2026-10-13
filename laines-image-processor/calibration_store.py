"""
calibration_store.py — Armazenamento de dados de referência para recalibração.

Persiste avaliações com %GC de referência externo (BIA, DEXA, hidrostática) e
fornece Ridge regression para reajustar os pesos do ensemble dinamicamente.

Uso:
    store = CalibrationStore()                        # carrega/cria DB
    store.save(evaluation_id, reference_bf, ...)      # salva novo dado
    weights = store.compute_weights()                 # Ridge regression
    count = store.count()

Schema:
    calibration_data(
        id, evaluation_id, created_at, reference_source, reference_bf,
        sexo, idade, ensemble_bf,
        formula_us_navy, formula_rfm, formula_deurenberg,
        formula_frustum, formula_smplx
    )

Nota sobre a regressão:
  X = matriz (n_samples, n_formulas) com previsões de cada fórmula
  y = %GC de referência
  Encontra pesos w ≥ 0 (NNLS) que minimizam ||X @ (w/Σw) - y||²
  com regularização Ridge para estabilidade com n < 30 amostras.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import config

_DB_PATH  = os.getenv(
    'PROCESSOR_CALIBRATION_DB',
    str(Path(config.JOB_STATE_PATH).parent / 'laines-calibration.db'),
)
_MIN_SAMPLES_FOR_REGRESSION = 5  # mínimo antes de oferecer pesos ajustados
_MAX_SAMPLES = 2000

_FORMULAS = ('us_navy', 'rfm', 'deurenberg', 'frustum', 'smplx')
_DEFAULT_WEIGHTS: dict[str, float] = {
    'us_navy': 1.0, 'rfm': 1.0, 'deurenberg': 0.8, 'frustum': 1.5, 'smplx': 2.5,
}

_DDL = """
CREATE TABLE IF NOT EXISTS calibration_data (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id   TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    reference_source TEXT,
    reference_bf    REAL    NOT NULL,
    sexo            TEXT,
    idade           INTEGER,
    ensemble_bf     REAL,
    formula_us_navy     REAL,
    formula_rfm         REAL,
    formula_deurenberg  REAL,
    formula_frustum     REAL,
    formula_smplx       REAL
);
CREATE INDEX IF NOT EXISTS idx_cal_eval ON calibration_data (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_cal_sexo ON calibration_data (sexo);
"""


class CalibrationStore:
    """Thread-safe SQLite store for calibration reference data."""

    def __init__(self, db_path: str = _DB_PATH) -> None:
        self._path = db_path
        self._lock = threading.Lock()
        with self._connect() as con:
            con.executescript(_DDL)

    @contextmanager
    def _connect(self):
        con = sqlite3.connect(self._path, timeout=10, check_same_thread=False)
        con.row_factory = sqlite3.Row
        try:
            yield con
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()

    def save(
        self,
        evaluation_id: str,
        reference_bf: float,
        reference_source: str | None = None,
        sexo: str | None = None,
        idade: int | None = None,
        ensemble_bf: float | None = None,
        formula_details: dict[str, float | None] | None = None,
    ) -> int:
        """
        Persiste um registro de calibração.

        Parâmetros
        ----------
        evaluation_id    : UUID da avaliação correspondente
        reference_bf     : %GC real medido externamente (BIA / DEXA / hidrostática)
        reference_source : 'bia' | 'dexa' | 'hidrostatica' | outros
        formula_details  : dict com as previsões individuais do pipeline
                           (campo 'formulas' do resultado JSON)
        """
        fd = formula_details or {}
        now = datetime.now(timezone.utc).isoformat()

        with self._lock, self._connect() as con:
            # Limpa entradas mais antigas se o limite for atingido
            count = con.execute('SELECT COUNT(*) FROM calibration_data').fetchone()[0]
            if count >= _MAX_SAMPLES:
                con.execute(
                    'DELETE FROM calibration_data WHERE id IN '
                    '(SELECT id FROM calibration_data ORDER BY id ASC LIMIT ?)',
                    (count - _MAX_SAMPLES + 1,)
                )
            cur = con.execute(
                """INSERT INTO calibration_data
                   (evaluation_id, created_at, reference_source, reference_bf,
                    sexo, idade, ensemble_bf,
                    formula_us_navy, formula_rfm, formula_deurenberg,
                    formula_frustum, formula_smplx)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    str(evaluation_id), now, reference_source, float(reference_bf),
                    sexo, idade, ensemble_bf,
                    fd.get('us_navy'), fd.get('rfm'), fd.get('deurenberg'),
                    fd.get('frustum'), fd.get('smplx_siri'),
                ),
            )
            return cur.lastrowid  # type: ignore[return-value]

    def count(self, sexo: str | None = None) -> int:
        q = 'SELECT COUNT(*) FROM calibration_data'
        params: tuple = ()
        if sexo:
            q += ' WHERE sexo = ?'
            params = (sexo,)
        with self._connect() as con:
            return con.execute(q, params).fetchone()[0]

    def compute_weights(
        self,
        sexo: str | None = None,
        ridge_alpha: float = 1.0,
    ) -> dict:
        """
        Calcula pesos ótimos do ensemble via NNLS + Ridge regression.

        Estratégia (Leave-One-Out sugere overfitting com n < 30 → Ridge forte):
          1. Carrega apenas registros onde ao menos 2 fórmulas têm valor.
          2. Monta X (n, n_active_formulas) e y (n,).
          3. Ridge NNLS com alpha proporcional a 1/n para evitar sobreajuste.
          4. Normaliza os pesos para que a soma dos defaults seja preservada.

        Retorna os pesos ajustados ou os pesos padrão se n < _MIN_SAMPLES.
        """
        try:
            import numpy as np
            from scipy.optimize import nnls
        except ImportError:
            return {'weights': _DEFAULT_WEIGHTS, 'n_samples': 0, 'status': 'scipy_unavailable'}

        q = 'SELECT * FROM calibration_data'
        params: tuple = ()
        if sexo:
            q += ' WHERE sexo = ?'
            params = (sexo,)

        with self._connect() as con:
            rows = con.execute(q, params).fetchall()

        if len(rows) < _MIN_SAMPLES_FOR_REGRESSION:
            return {
                'weights':   _DEFAULT_WEIGHTS,
                'n_samples': len(rows),
                'status':    f'insufficient_data (need {_MIN_SAMPLES_FOR_REGRESSION})',
            }

        cols = [f'formula_{f}' for f in _FORMULAS]
        X_rows, y_vals = [], []
        for row in rows:
            formula_vals = [row[c] for c in cols]
            if sum(v is not None for v in formula_vals) < 2:
                continue  # skip rows with too few formulas
            X_rows.append([v if v is not None else 0.0 for v in formula_vals])
            y_vals.append(row['reference_bf'])

        if len(y_vals) < _MIN_SAMPLES_FOR_REGRESSION:
            return {'weights': _DEFAULT_WEIGHTS, 'n_samples': len(y_vals), 'status': 'insufficient_data'}

        X = np.array(X_rows, dtype=np.float64)
        y = np.array(y_vals,  dtype=np.float64)
        n = len(y)

        # Ridge augmentation: append sqrt(alpha) * I to X, zeros to y
        # This is equivalent to L2 regularisation on the weights
        alpha_eff = ridge_alpha / max(1, n / 10)   # weaker regularisation with more data
        X_aug = np.vstack([X, np.sqrt(alpha_eff) * np.eye(X.shape[1])])
        y_aug = np.hstack([y, np.zeros(X.shape[1])])

        raw_w, _ = nnls(X_aug, y_aug)  # non-negative least squares

        # Map back to named weights; re-scale so mean active weight = 1.0
        active = raw_w.sum()
        if active < 1e-9:
            return {'weights': _DEFAULT_WEIGHTS, 'n_samples': n, 'status': 'regression_degenerate'}

        adjusted: dict[str, float] = {}
        n_active = sum(1 for w in raw_w if w > 1e-6)
        scale = n_active / active if n_active > 0 else 1.0
        for i, fname in enumerate(_FORMULAS):
            adjusted[fname] = round(float(raw_w[i]) * scale, 3)

        return {
            'weights':    adjusted,
            'n_samples':  n,
            'ridge_alpha': alpha_eff,
            'status':     'ok',
        }

    def export_json(self, limit: int = 200) -> list[dict]:
        """Exporta os últimos `limit` registros como lista de dicts."""
        with self._connect() as con:
            rows = con.execute(
                'SELECT * FROM calibration_data ORDER BY id DESC LIMIT ?', (limit,)
            ).fetchall()
        return [dict(r) for r in rows]


# Singleton para reuso entre requests
_store: CalibrationStore | None = None
_store_lock = threading.Lock()


def get_calibration_store() -> CalibrationStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = CalibrationStore()
        return _store
