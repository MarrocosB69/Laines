# Inicia o processador de imagens LAINES na porta 8001
# Uso: ./start.ps1
# Para desenvolvimento: ./start.ps1 -Reload

param(
    [switch]$Reload,
    [string]$Token = $env:IMAGE_PROCESSOR_TOKEN
)

Set-Location $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Token)) {
    throw 'Defina IMAGE_PROCESSOR_TOKEN com o mesmo valor configurado no backend.'
}
$env:IMAGE_PROCESSOR_TOKEN = $Token
$uploads = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\server\uploads\avaliacoes-imagem'))
$env:NESTJS_UPLOAD_BASE = $uploads
$env:PROCESSOR_UPLOAD_BASE = $uploads

# Baixar modelo se nao existir
$model = "$PSScriptRoot\models\pose_landmarker_full.task"
if (-not (Test-Path $model)) {
    Write-Host "Baixando modelo MediaPipe (~9 MB)..." -ForegroundColor Yellow
    $url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
    Invoke-WebRequest -Uri $url -OutFile $model -UseBasicParsing
    Write-Host "Modelo baixado." -ForegroundColor Green
}

if ($Reload) {
    python -m uvicorn main:app --port 8001 --reload --log-level info
} else {
    python -m uvicorn main:app --port 8001 --log-level info
}
