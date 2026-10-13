import uuid
import secrets
from contextlib import asynccontextmanager
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, HttpUrl, model_validator

import config
from jobs_status import create_job, get_job, update_job
from pipeline import start_pipeline_thread
from calibration_store import get_calibration_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm MediaPipe model on startup so the first request isn't slow
    import numpy as np
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    import config

    dummy = np.zeros((64, 64, 3), dtype=np.uint8)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=dummy)
    base_options = mp_python.BaseOptions(model_asset_path=config.MODEL_PATH)
    options = mp_vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=mp_vision.RunningMode.IMAGE,
        output_segmentation_masks=False,
        num_poses=1,
    )
    with mp_vision.PoseLandmarker.create_from_options(options) as d:
        d.detect(mp_image)
    yield


app = FastAPI(
    title='LAINES Image Processor',
    version=config.VERSAO_ALGORITMO,
    description='Analisa fotos e vídeo 360° para estimativa de composição corporal (US Navy).',
    lifespan=lifespan,
)


class Anthropometry(BaseModel):
    peso: float = Field(ge=20, le=350)
    estatura: float = Field(ge=100, le=250)
    sexo: Literal['masculino', 'feminino']
    idade: int | None = Field(default=None, ge=19, le=83)
    idadeOrigem: Literal['paciente.dataNascimento', 'indisponivel'] | None = None
    idadeReferenciaEm: str | None = Field(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    arucoMarkerSizeCm: float | None = Field(default=None, gt=0, le=100)


class CaptureSource(BaseModel):
    type: Literal['url', 'local_path']
    url: HttpUrl | None = None
    path: str | None = None

    @model_validator(mode='after')
    def validate_location(self):
        if self.type == 'url' and not self.url:
            raise ValueError('URL da captura ausente')
        if self.type == 'local_path' and not self.path:
            raise ValueError('Caminho da captura ausente')
        return self


class Capture(BaseModel):
    captureId: uuid.UUID
    vista: Literal['frontal', 'lateral_direita', 'posterior', 'lateral_esquerda', 'video_360']
    mimeType: Literal['image/jpeg', 'video/webm', 'video/mp4']
    source: CaptureSource


class JobRequest(BaseModel):
    evaluationId: uuid.UUID
    protocolVersion: Literal['quatro_vistas_rgb_v1'] = 'quatro_vistas_rgb_v1'
    anthropometry: Anthropometry
    captures: list[Capture] = Field(min_length=5, max_length=5)

    @model_validator(mode='after')
    def validate_capture_set(self):
        expected = {'frontal', 'lateral_direita', 'posterior', 'lateral_esquerda', 'video_360'}
        actual = {capture.vista for capture in self.captures}
        if actual != expected:
            raise ValueError('Conjunto de capturas incompleto ou duplicado')
        return self


def require_processor_token(
    authorization: Annotated[str | None, Header()] = None,
    x_processor_token: Annotated[str | None, Header()] = None,
) -> None:
    expected = config.PROCESSOR_TOKEN
    if not expected:
        raise HTTPException(status_code=503, detail='Token interno do processador nao configurado.')
    bearer = authorization[7:].strip() if authorization and authorization.lower().startswith('bearer ') else ''
    provided = x_processor_token or bearer
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail='Credencial interna invalida.')


@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'laines-image-processor'}


@app.post('/jobs', status_code=202)
async def create_job_endpoint(request: JobRequest, _: None = Depends(require_processor_token)):
    """
    Submit a processing job. Returns jobId immediately; processing runs async.
    Poll GET /jobs/{jobId} for status and results.
    """
    job_id = str(uuid.uuid4())
    create_job(job_id)

    payload = {
        'evaluationId': str(request.evaluationId),
        'protocolVersion': request.protocolVersion,
        'anthropometry': request.anthropometry.model_dump(),
        'captures': [capture.model_dump(mode='json') for capture in request.captures],
    }
    if not start_pipeline_thread(job_id, payload):
        update_job(job_id, status='falha', error='Fila de processamento ocupada.')
        raise HTTPException(status_code=503, detail='Fila de processamento ocupada.')

    return {
        'jobId': job_id,
        'status': 'processing',
        'progress': 0,
        'algorithmVersion': config.VERSAO_ALGORITMO,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Calibration data endpoints (Bloco 5)
# ─────────────────────────────────────────────────────────────────────────────

class CalibrationDataRequest(BaseModel):
    evaluationId: uuid.UUID
    reference_bf: float = Field(ge=2.0, le=70.0, description='%GC real medido externamente')
    reference_source: Literal['bia', 'dexa', 'hidrostatica', 'outro'] | None = None
    sexo: Literal['masculino', 'feminino'] | None = None
    idade: int | None = Field(default=None, ge=10, le=100)
    # Opcional: preencher com o campo 'formulas' do resultado do job
    formula_details: dict[str, float | None] | None = None
    ensemble_bf: float | None = None


@app.post('/calibration-data', status_code=201)
async def submit_calibration_data(
    request: CalibrationDataRequest,
    _: None = Depends(require_processor_token),
):
    """
    Registra um dado de referência externo (BIA / DEXA) para uma avaliação.
    Usado futuramente para recalibrar os pesos do ensemble via Ridge regression.

    Envie o campo 'formulas' do resultado do job em formula_details para que
    a regressão possa correlacionar as previsões individuais com o valor real.
    """
    store = get_calibration_store()
    record_id = store.save(
        evaluation_id=str(request.evaluationId),
        reference_bf=request.reference_bf,
        reference_source=request.reference_source,
        sexo=request.sexo,
        idade=request.idade,
        ensemble_bf=request.ensemble_bf,
        formula_details=request.formula_details,
    )
    return {
        'id':            record_id,
        'evaluation_id': str(request.evaluationId),
        'n_total':       store.count(),
        'message':       'Dado de calibração registrado.',
    }


@app.get('/calibration-weights')
async def get_calibration_weights(
    sexo: Literal['masculino', 'feminino'] | None = None,
    _: None = Depends(require_processor_token),
):
    """
    Calcula e retorna os pesos ótimos do ensemble baseados nos dados de referência
    registrados via POST /calibration-data.

    O campo 'weights' pode ser usado como override em calc_body_composition
    (via level_confidence → _adjusted_weights).

    Requer ≥ 5 amostras com ao menos 2 fórmulas por amostra para calcular.
    Retorna os pesos padrão enquanto o dataset de calibração é construído.
    """
    store = get_calibration_store()
    result = store.compute_weights(sexo=sexo)
    return {
        **result,
        'default_weights': {'us_navy': 1.0, 'rfm': 1.0, 'deurenberg': 0.8, 'frustum': 1.5, 'smplx': 2.5},
    }


@app.get('/calibration-data')
async def list_calibration_data(
    limit: int = 50,
    _: None = Depends(require_processor_token),
):
    """Lista os últimos registros de calibração (para auditoria)."""
    store = get_calibration_store()
    return {'data': store.export_json(limit=limit), 'total': store.count()}


# ─────────────────────────────────────────────────────────────────────────────

@app.get('/jobs/{job_id}')
async def get_job_status(job_id: str, _: None = Depends(require_processor_token)):
    """
    Poll the status of a processing job.

    status values:
        queued       → in queue (instant on this impl)
        processing   → running (progress 0–99)
        concluida    → done; results field is populated
        falha        → failed; error field explains why
    """
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail='Job não encontrado.')

    response: dict[str, Any] = {
        'jobId': job_id,
        'status': job['status'],
        'progress': job.get('progress', 0),
    }

    if job['status'] == 'concluida' and job.get('results'):
        response['results'] = job['results']
        response['algorithmVersion'] = job['results'].get('algorithmVersion', config.VERSAO_ALGORITMO)

    if job['status'] == 'falha' and job.get('error'):
        response['error'] = job['error']

    return response
