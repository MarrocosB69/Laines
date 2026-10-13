import threading
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config

_lock = threading.Lock()
_state_path = Path(config.JOB_STATE_PATH)
_max_jobs = 1000


def _load_jobs() -> dict[str, dict]:
    try:
        loaded = json.loads(_state_path.read_text(encoding='utf-8'))
        if not isinstance(loaded, dict):
            return {}
        for job in loaded.values():
            if job.get('status') in {'queued', 'processing'}:
                job['status'] = 'falha'
                job['progress'] = 0
                job['error'] = 'Processamento interrompido por reinicializacao do servico.'
        return loaded
    except (OSError, ValueError, TypeError):
        return {}


_jobs: dict[str, dict] = _load_jobs()


def _persist_jobs() -> None:
    try:
        _state_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = _state_path.with_suffix(f'{_state_path.suffix}.tmp')
        temp_path.write_text(json.dumps(_jobs, ensure_ascii=False), encoding='utf-8')
        os.replace(temp_path, _state_path)
    except OSError:
        # Job processing must still work if the optional persistence volume is unavailable.
        pass


def create_job(job_id: str) -> None:
    with _lock:
        if len(_jobs) >= _max_jobs:
            oldest = sorted(_jobs, key=lambda key: _jobs[key].get('createdAt', ''))[:len(_jobs) - _max_jobs + 1]
            for key in oldest:
                _jobs.pop(key, None)
        _jobs[job_id] = {
            'status': 'queued',
            'progress': 0,
            'results': None,
            'error': None,
            'createdAt': datetime.now(timezone.utc).isoformat(),
        }
        _persist_jobs()


def update_job(
    job_id: str,
    status: str | None = None,
    progress: int | None = None,
    results: dict | None = None,
    error: str | None = None,
) -> None:
    with _lock:
        if job_id not in _jobs:
            _jobs[job_id] = {'status': 'processing', 'progress': 0, 'results': None, 'error': None}
        job = _jobs[job_id]
        if status is not None:
            job['status'] = status
        if progress is not None:
            job['progress'] = progress
        if results is not None:
            job['results'] = results
        if error is not None:
            job['error'] = error
        job['updatedAt'] = datetime.now(timezone.utc).isoformat()
        _persist_jobs()


def get_job(job_id: str) -> dict | None:
    with _lock:
        return dict(_jobs[job_id]) if job_id in _jobs else None
