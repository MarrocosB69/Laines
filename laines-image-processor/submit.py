#!/usr/bin/env python3
"""
submit.py — Submete um manifest.json ao pipeline de análise.

Dois modos:

  DIRETO (padrão) — importa o pipeline internamente, sem servidor HTTP.
  Ideal para testar localmente sem precisar subir o serviço FastAPI.

    python submit.py captures/20260624_123456/manifest.json

  API — envia via HTTP ao processador já em execução.
  Mesmo fluxo que o NestJS usa em produção.

    python submit.py manifest.json --api-url http://localhost:8001 --token TOKEN

Flags opcionais:
  --aruco-size <cm>   Tamanho do marcador ArUco usado na sessão (padrão: não usar)
  --poll-interval <s> Intervalo de polling no modo API (padrão: 2 s)
  --timeout <s>       Tempo máximo de espera no modo API (padrão: 180 s)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Resolução de paths do manifest
# ──────────────────────────────────────────────────────────────────────────────

def _resolve_file(raw_path: str, manifest_dir: Path) -> Path | None:
    """
    Tenta resolver o path do arquivo em duas etapas:
      1. Relativo ao CWD (como o capture.py escreveu)
      2. Fallback: mesmo nome de arquivo no diretório do manifest
    """
    p = Path(raw_path)
    if p.is_file():
        return p.resolve()
    fallback = manifest_dir / p.name
    if fallback.is_file():
        return fallback.resolve()
    return None


def _load_manifest(manifest_path: Path) -> tuple[dict, dict[str, Path]]:
    """Lê o manifest.json e resolve todos os 5 caminhos de arquivo."""
    data = json.loads(manifest_path.read_text(encoding='utf-8'))
    raw_files: dict[str, str] = data.get('files', {})
    manifest_dir = manifest_path.parent.resolve()

    resolved: dict[str, Path] = {}
    missing: list[str] = []
    for vista, raw_path in raw_files.items():
        p = _resolve_file(raw_path, manifest_dir)
        if p:
            resolved[vista] = p
        else:
            missing.append(vista)

    if missing:
        print(f'Erro: arquivos não encontrados para: {", ".join(missing)}', file=sys.stderr)
        print('  Verifique se está rodando submit.py do mesmo diretório que capture.py,', file=sys.stderr)
        print(f'  ou se os arquivos existem em {manifest_dir}', file=sys.stderr)
        sys.exit(1)

    expected = {'frontal', 'lateral_direita', 'posterior', 'lateral_esquerda', 'video_360'}
    if resolved.keys() != expected:
        missing2 = expected - resolved.keys()
        print(f'Erro: vistas faltando no manifest: {", ".join(missing2)}', file=sys.stderr)
        sys.exit(1)

    return data, resolved


# ──────────────────────────────────────────────────────────────────────────────
# Construção do payload
# ──────────────────────────────────────────────────────────────────────────────

_MIME = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/mp4',  # codec fallback do capture.py; pipeline lê igualmente
}

def _build_payload(manifest: dict, files: dict[str, Path],
                   aruco_size: float | None) -> dict:
    anthro = manifest['anthropometry']
    captures = []
    for vista, path in files.items():
        mime = _MIME.get(path.suffix.lower(), 'image/jpeg')
        captures.append({
            'captureId': str(uuid.uuid4()),
            'vista': vista,
            'mimeType': mime,
            'source': {'type': 'local_path', 'path': str(path)},
        })
    return {
        'evaluationId': str(uuid.uuid4()),
        'protocolVersion': 'quatro_vistas_rgb_v1',
        'anthropometry': {
            'peso':               anthro['peso'],
            'estatura':           anthro['estatura'],
            'sexo':               anthro['sexo'],
            'idade':              anthro.get('idade', 25),
            'arucoMarkerSizeCm':  aruco_size,
        },
        'captures': captures,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Exibição de resultados
# ──────────────────────────────────────────────────────────────────────────────

def _print_results(manifest: dict, results: dict | None, error: str | None) -> None:
    anthro = manifest['anthropometry']
    nome = anthro.get('nome', 'Atleta')
    sep = '─' * 46

    print(f'\n{sep}')
    print(f'  RESULTADO  —  {nome}')
    print(sep)

    if error or results is None:
        print(f'  FALHA: {error or "resultado vazio"}')
        print(sep)
        return

    bf = results.get('percGordura')
    mg = results.get('massaGorda')
    mm = results.get('massaMagra')
    rcq = results.get('rcq')
    m   = results.get('measurements', {})

    print(f'  Gordura corporal :  {bf} %' if bf is not None else '  Gordura corporal :  —')
    print(f'  Massa gorda      :  {mg} kg' if mg is not None else '  Massa gorda      :  —')
    print(f'  Massa magra      :  {mm} kg' if mm is not None else '  Massa magra      :  —')
    if rcq is not None:
        print(f'  RCQ (cin/quad)   :  {rcq}')

    ffmi = results.get('ffmi')
    fmi  = results.get('fmi')
    if ffmi is not None: print(f'  FFMI             :  {ffmi}')
    if fmi  is not None: print(f'  FMI              :  {fmi}')

    std = results.get('ensemble_std')
    n   = results.get('ensemble_n')
    if std is not None:
        conf = 'alta' if std < 3 else ('média' if std < 6 else 'baixa')
        print(f'  Concordância     :  ±{std} pp  ({n} fórmulas, confiança {conf})')

    idx = results.get('indices', {})
    calf_s = idx.get('calf_screening')
    if calf_s:
        label = 'OK' if calf_s == 'baixo_risco' else 'TRIAGEM POSITIVA (massa muscular reduzida)'
        print(f'  Panturrilha      :  {label}')

    print(f'  {sep}')
    if m:
        if m.get('neck_cm'):  print(f'  Pescoço          :  {m["neck_cm"]} cm')
        if m.get('chest_cm'): print(f'  Tórax            :  {m["chest_cm"]} cm')
        if m.get('waist_cm'): print(f'  Cintura          :  {m["waist_cm"]} cm')
        if m.get('hip_cm'):   print(f'  Quadril          :  {m["hip_cm"]} cm')
        if m.get('thigh_cm'): print(f'  Coxa             :  {m["thigh_cm"]} cm')
        if m.get('calf_cm'):  print(f'  Panturrilha      :  {m["calf_cm"]} cm')
    print(f'  {sep}')

    metodo = results.get('metodo', '—')
    cal = results.get('calibracao', {})
    cal_metodo    = cal.get('metodo_geral', '—')
    cal_confianca = cal.get('confianca_geral', '—')
    fotos_ok = results.get('sources', {}).get('photos_processed', '—')
    frames_ok = results.get('sources', {}).get('video_frames_processed', '—')

    print(f'  Método           :  {metodo}')
    print(f'  Calibração       :  {cal_metodo}  ({cal_confianca} confiança)')
    print(f'  Fotos processadas:  {fotos_ok}')
    print(f'  Frames de vídeo  :  {frames_ok}')
    print(sep + '\n')


# ──────────────────────────────────────────────────────────────────────────────
# Modo DIRETO — chama run_pipeline localmente
# ──────────────────────────────────────────────────────────────────────────────

def run_direct(manifest_path: Path, args: argparse.Namespace) -> None:
    manifest, files = _load_manifest(manifest_path)

    # Define PROCESSOR_UPLOAD_BASE antes de importar config/pipeline.
    # O check de segurança em _resolve_source exige que os arquivos estejam
    # dentro deste diretório.
    session_dir = str(manifest_path.parent.resolve())
    os.environ.setdefault('PROCESSOR_UPLOAD_BASE', session_dir)

    # Adiciona o diretório do processor ao path (para imports relativos)
    proc_root = str(Path(__file__).parent.resolve())
    if proc_root not in sys.path:
        sys.path.insert(0, proc_root)

    from pipeline import run_pipeline         # noqa: E402 — import intencional tardio
    from jobs_status import create_job, get_job  # noqa: E402

    payload = _build_payload(manifest, files, args.aruco_size)
    job_id  = str(uuid.uuid4())
    create_job(job_id)

    print(f'\nProcessando  {manifest["anthropometry"].get("nome", "Atleta")}...')
    print(f'  Sessão  : {manifest.get("captured_at", "—")}')
    print(f'  Arquivos: {session_dir}')

    t0 = time.time()
    run_pipeline(job_id, payload)   # síncrono — bloqueia até terminar
    elapsed = time.time() - t0

    job = get_job(job_id)
    if job is None:
        print('Erro interno: job não encontrado após execução.', file=sys.stderr)
        sys.exit(1)

    print(f'  Tempo   : {elapsed:.1f} s')

    if job['status'] == 'concluida':
        _print_results(manifest, job.get('results'), None)
    else:
        _print_results(manifest, None, job.get('error', 'falha sem mensagem'))
        sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# Modo API — envia via HTTP e aguarda resultado
# ──────────────────────────────────────────────────────────────────────────────

def run_api(manifest_path: Path, args: argparse.Namespace) -> None:
    try:
        import requests as _req
    except ImportError:
        print('Erro: pacote "requests" não instalado. Execute: pip install requests', file=sys.stderr)
        sys.exit(1)

    token = args.token or os.environ.get('IMAGE_PROCESSOR_TOKEN', '')
    if not token:
        print('Erro: informe o token via --token ou $IMAGE_PROCESSOR_TOKEN.', file=sys.stderr)
        sys.exit(1)

    manifest, files = _load_manifest(manifest_path)
    payload = _build_payload(manifest, files, args.aruco_size)
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    base    = args.api_url.rstrip('/')

    # Verifica health
    try:
        h = _req.get(f'{base}/health', timeout=5)
        h.raise_for_status()
    except Exception as exc:
        print(f'Erro: processador não responde em {base}  ({exc})', file=sys.stderr)
        sys.exit(1)

    # Envia job
    print(f'\nSubmetendo job para {base}...')
    try:
        r = _req.post(f'{base}/jobs', json=payload, headers=headers, timeout=30)
        r.raise_for_status()
    except _req.HTTPError as exc:
        print(f'Erro HTTP {exc.response.status_code}: {exc.response.text}', file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f'Erro ao enviar job: {exc}', file=sys.stderr)
        sys.exit(1)

    job_id = r.json()['jobId']
    print(f'  Job ID: {job_id}')
    print('  Aguardando resultado', end='', flush=True)

    # Polling
    deadline = time.time() + args.timeout
    while time.time() < deadline:
        time.sleep(args.poll_interval)
        try:
            rp = _req.get(f'{base}/jobs/{job_id}', headers=headers, timeout=10)
            rp.raise_for_status()
            data = rp.json()
        except Exception as exc:
            print(f'\nErro ao consultar status: {exc}', file=sys.stderr)
            continue

        status   = data.get('status', '')
        progress = data.get('progress', 0)
        print(f'\r  Aguardando resultado  [{status}  {progress}%]   ', end='', flush=True)

        if status == 'concluida':
            print()
            _print_results(manifest, data.get('results'), None)
            return

        if status == 'falha':
            print()
            _print_results(manifest, None, data.get('error', 'falha sem mensagem'))
            sys.exit(1)

    print(f'\nTimeout após {args.timeout} s.', file=sys.stderr)
    sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description='Submete manifest.json ao pipeline LAINES',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        'manifest',
        type=Path,
        help='Caminho para manifest.json gerado pelo capture.py',
    )
    parser.add_argument(
        '--api-url',
        metavar='URL',
        default=None,
        help='URL do processador (ex: http://localhost:8001). '
             'Se omitido, usa modo direto (sem HTTP).',
    )
    parser.add_argument(
        '--token',
        metavar='TOKEN',
        default=None,
        help='Token de autenticação (modo API). Alternativa: $IMAGE_PROCESSOR_TOKEN.',
    )
    parser.add_argument(
        '--aruco-size',
        type=float,
        default=None,
        metavar='CM',
        help='Tamanho físico do marcador ArUco usado na sessão (cm).',
    )
    parser.add_argument(
        '--poll-interval',
        type=float,
        default=2.0,
        metavar='S',
        help='Intervalo de polling em modo API (segundos).',
    )
    parser.add_argument(
        '--timeout',
        type=float,
        default=180.0,
        metavar='S',
        help='Tempo máximo de espera em modo API (segundos).',
    )

    args = parser.parse_args()

    if not args.manifest.is_file():
        print(f'Erro: arquivo não encontrado: {args.manifest}', file=sys.stderr)
        sys.exit(1)

    if args.api_url:
        run_api(args.manifest, args)
    else:
        run_direct(args.manifest, args)


if __name__ == '__main__':
    main()
