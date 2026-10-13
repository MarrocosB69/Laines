import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FlipHorizontal,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Scan,
  Shield,
  Sun,
  Upload,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { getApiErrorMessage } from '../../../services/api';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';
import {
  createEvaluation,
  createUploadUrls,
  deleteEvaluation,
  findEvaluation,
  getResults,
  getStatus,
  listImageEvaluations,
  reprocessEvaluation,
  uploadCapture,
} from '../../../services/avaliacaoImagemService';
import { AvaliacaoModulo, AvaliacaoSecao, Campo, GrupoOpcoes, Opcao, AvisoAvaliacao } from '../base';
import './AvaliacaoImagem.css';
import Body3D from './Body3D';

// ─── Views ────────────────────────────────────────────────────────────────────

const CAPTURE_VIEWS = [
  {
    id: 'frontal',
    label: 'Frontal',
    short: 'F',
    instruction: 'Fique de frente — corpo inteiro visível, braços ligeiramente afastados',
  },
  {
    id: 'lateral_direita',
    label: 'Lateral direita',
    short: 'LD',
    instruction: 'Vire para a direita — olhe para a frente, braços ao longo do corpo',
  },
  {
    id: 'posterior',
    label: 'Posterior',
    short: 'P',
    instruction: 'Fique de costas — braços ligeiramente afastados do corpo',
  },
  {
    id: 'lateral_esquerda',
    label: 'Lateral esquerda',
    short: 'LE',
    instruction: 'Vire para a esquerda — olhe para a frente, braços ao longo do corpo',
  },
];

// ─── Silhouette SVGs ──────────────────────────────────────────────────────────

function SilhouetteFrontal() {
  return (
    <svg viewBox="0 0 80 200" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ai-silhouette">
      <circle cx="40" cy="15" r="12" strokeWidth="3" />
      <line x1="40" y1="27" x2="40" y2="36" strokeWidth="3" />
      {/* Shoulders */}
      <path d="M14 48 L28 36 L52 36 L66 48" strokeWidth="3" />
      {/* Arms */}
      <path d="M14 48 L10 82" strokeWidth="5" />
      <path d="M66 48 L70 82" strokeWidth="5" />
      {/* Torso */}
      <path d="M28 36 L25 100 L55 100 L52 36" strokeWidth="3" />
      {/* Hips / Legs */}
      <path d="M25 100 L22 172" strokeWidth="5.5" />
      <path d="M55 100 L58 172" strokeWidth="5.5" />
      {/* Feet */}
      <path d="M22 172 L16 182" strokeWidth="3.5" />
      <path d="M58 172 L64 182" strokeWidth="3.5" />
    </svg>
  );
}

function SilhouetteLateralDir() {
  return (
    <svg viewBox="0 0 80 200" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ai-silhouette">
      <circle cx="48" cy="15" r="12" strokeWidth="3" />
      <line x1="44" y1="27" x2="42" y2="36" strokeWidth="3" />
      {/* Back curve */}
      <path d="M42 36 Q30 44 28 72 Q27 92 30 100" strokeWidth="3.5" />
      {/* Front curve */}
      <path d="M42 36 Q58 42 58 72 Q56 92 52 100" strokeWidth="3.5" />
      {/* Arm (back) */}
      <path d="M32 52 L24 88" strokeWidth="5" />
      {/* Legs */}
      <path d="M30 100 L27 172" strokeWidth="5.5" />
      <path d="M52 100 L55 172" strokeWidth="5.5" />
      <path d="M27 172 L20 182" strokeWidth="3.5" />
      <path d="M55 172 L62 182" strokeWidth="3.5" />
    </svg>
  );
}

function SilhouettePosterior() {
  return (
    <svg viewBox="0 0 80 200" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ai-silhouette">
      <circle cx="40" cy="15" r="12" strokeWidth="3" />
      <line x1="40" y1="27" x2="40" y2="36" strokeWidth="3" />
      <path d="M14 48 L28 36 L52 36 L66 48" strokeWidth="3" />
      <path d="M14 48 L10 82" strokeWidth="5" />
      <path d="M66 48 L70 82" strokeWidth="5" />
      <path d="M28 36 L25 100 L55 100 L52 36" strokeWidth="3" />
      {/* Spine hint */}
      <line x1="40" y1="40" x2="40" y2="100" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3 3" />
      <path d="M25 100 L22 172" strokeWidth="5.5" />
      <path d="M55 100 L58 172" strokeWidth="5.5" />
      <path d="M22 172 L16 182" strokeWidth="3.5" />
      <path d="M58 172 L64 182" strokeWidth="3.5" />
    </svg>
  );
}

function SilhouetteLateralEsq() {
  return (
    <svg viewBox="0 0 80 200" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ai-silhouette">
      <circle cx="32" cy="15" r="12" strokeWidth="3" />
      <line x1="36" y1="27" x2="38" y2="36" strokeWidth="3" />
      <path d="M38 36 Q50 44 52 72 Q53 92 50 100" strokeWidth="3.5" />
      <path d="M38 36 Q22 42 22 72 Q24 92 28 100" strokeWidth="3.5" />
      <path d="M48 52 L56 88" strokeWidth="5" />
      <path d="M50 100 L53 172" strokeWidth="5.5" />
      <path d="M28 100 L25 172" strokeWidth="5.5" />
      <path d="M53 172 L60 182" strokeWidth="3.5" />
      <path d="M25 172 L18 182" strokeWidth="3.5" />
    </svg>
  );
}

const SILHOUETTE_COMPONENTS = [
  SilhouetteFrontal,
  SilhouetteLateralDir,
  SilhouettePosterior,
  SilhouetteLateralEsq,
];

// ─── Quality analysis ─────────────────────────────────────────────────────────

function analyzeFrameQuality(video, canvas) {
  if (!video || !canvas || video.readyState < 2) return { brightness: 0, sharpness: 0, framing: 0, ready: false };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { brightness: 0, sharpness: 0, framing: 0, ready: false };
  const w = 120;
  const h = 90;
  canvas.width = w;
  canvas.height = h;
  try {
    ctx.drawImage(video, 0, 0, w, h);
  } catch {
    return { brightness: 0, sharpness: 0, framing: 0, ready: false };
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  const third = Math.floor(w / 3);
  let sum = 0;
  let count = 0;
  let leftSum = 0;
  let centerSum = 0;
  let rightSum = 0;
  let stripCount = 0;
  let edgeEnergy = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum;
    count++;
    const x = (i / 4) % w;
    if (x > 0) {
      const prev = i - 4;
      const prevLum = 0.299 * data[prev] + 0.587 * data[prev + 1] + 0.114 * data[prev + 2];
      edgeEnergy += Math.abs(lum - prevLum);
    }
    if (x < third) leftSum += lum;
    else if (x < 2 * third) centerSum += lum;
    else rightSum += lum;
    stripCount++;
  }
  const mean = sum / count;
  // Framing: contrast between center column vs side columns detects person in frame
  const perStrip = stripCount / 3;
  const edgeMean = (leftSum + rightSum) / (2 * perStrip);
  const centerMean = centerSum / perStrip;
  const framing = Math.min(1, Math.abs(centerMean - edgeMean) / 28);
  return {
    brightness: Math.min(1, mean / 185),
    sharpness: Math.min(1, edgeEnergy / Math.max(1, count) / 18),
    framing,
    ready: true,
  };
}

const canvasToBlob = (canvas, type = 'image/jpeg', quality = 0.9) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a fotografia.'))), type, quality);
});

async function captureBestFrame(video, count = 3, intervalMs = 90) {
  let bestCanvas = null;
  let bestScore = -1;
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, outputWidth, outputHeight);
    const sample = document.createElement('canvas');
    sample.width = 160;
    sample.height = 120;
    const sampleCtx = sample.getContext('2d');
    sampleCtx.drawImage(canvas, 0, 0, sample.width, sample.height);
    const data = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
    let score = 0;
    for (let j = 0; j < data.length; j += 4) {
      const lum = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
      if ((j / 4) % sample.width > 0) {
        const previous = j - 4;
        const previousLum = 0.299 * data[previous] + 0.587 * data[previous + 1] + 0.114 * data[previous + 2];
        score += Math.abs(lum - previousLum);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCanvas = canvas;
    }
    if (i < count - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  const blob = await canvasToBlob(bestCanvas);
  return { blob, previewUrl: URL.createObjectURL(blob) };
}

// ─── US Navy estimativa ───────────────────────────────────────────────────────

// ─── Steps ───────────────────────────────────────────────────────────────────

function StepIntro() {
  // O título do passo era um segundo h2 no diálogo; agora é a seção (h3). O
  // selo vai nas ações da seção, escrito; o anel com a câmera saiu (enfeite).
  return (
    <div className="ai-step ai-step-intro">
      <AvaliacaoSecao
        titulo="Avaliação corporal por imagem"
        className="ai-intro-hero"
        acoes={<span className="av-selo av-selo--atencao ai-intro-badge">Módulo experimental — pesquisa</span>}
      >
        <p className="ai-intro-desc">
          Estimativa experimental de composição corporal a partir de 4 fotos e um vídeo 360° capturados
          pela câmera do dispositivo. Os resultados são versionados para pesquisa e não substituem exames
          clínicos.
        </p>
      </AvaliacaoSecao>

      <AvaliacaoSecao titulo="Prepare o ambiente" className="ai-requirements">
        <ul className="ai-requirements-list">
          <li className="ai-requirement-item">
            <span className="ai-requirement-icon" aria-hidden="true"><Sun size={18} /></span>
            <div>
              <strong>Boa iluminação</strong>
              <span>Preferencialmente luz natural, sem sombras no rosto</span>
            </div>
          </li>
          <li className="ai-requirement-item">
            <span className="ai-requirement-icon" aria-hidden="true"><Eye size={18} /></span>
            <div>
              <strong>Roupas justas</strong>
              <span>Short e sutiã esportivo, ou roupa de banho</span>
            </div>
          </li>
          <li className="ai-requirement-item">
            <span className="ai-requirement-icon" aria-hidden="true"><FlipHorizontal size={18} /></span>
            <div>
              <strong>Dispositivo posicionado</strong>
              <span>A 2–3 metros de distância, enquadrando o corpo inteiro</span>
            </div>
          </li>
        </ul>
      </AvaliacaoSecao>

      <AvisoAvaliacao tipo="info">
        A incerteza deste método ainda está em validação. O resultado não deve orientar decisões clínicas isoladamente.
      </AvisoAvaliacao>
    </div>
  );
}

// Campos da base: rótulo ligado, unidade na caixa ao lado (fora do
// placeholder), ajuda ligada por aria-describedby e 48 px. Os ids, os
// limites (min, max, step) e os handlers são os de antes. Sexo e quem
// consentiu continuam botões com aria-pressed, agora num fieldset com a
// legenda que já existia.
function StepConsent({ form, onChange }) {
  return (
    <div className="ai-step ai-step-consent">
      <AvaliacaoSecao titulo="Dados e consentimento">
        <div className="av-grade">
          <Campo rotulo="Peso atual" unidade="kg">
            <input
              id="ai-weight"
              type="number"
              className="ai-input"
              placeholder="75.5"
              value={form.peso}
              min="20"
              max="350"
              step="0.1"
              onChange={(e) => onChange('peso', e.target.value)}
            />
          </Campo>
          <Campo rotulo="Estatura" unidade="cm">
            <input
              id="ai-height"
              type="number"
              className="ai-input"
              placeholder="170"
              value={form.estatura}
              min="100"
              max="250"
              step="1"
              onChange={(e) => onChange('estatura', e.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Tamanho do marcador ArUco"
            unidade="cm"
            className="av-inteiro"
            ajuda={(
              <>
                Lado do marcador impresso em cm. Padrão: 14,8 cm (folha A4 ao meio).
                Meça após imprimir e corrija se houver diferença.
              </>
            )}
          >
            <input
              id="ai-marker-size"
              type="number"
              className="ai-input"
              placeholder="14.8"
              value={form.arucoMarkerSizeCm}
              min="3"
              max="100"
              step="0.1"
              onChange={(e) => onChange('arucoMarkerSizeCm', e.target.value)}
            />
          </Campo>
        </div>

        <GrupoOpcoes legenda="Sexo biológico" ajuda="Necessário para a equação US Navy." horizontal className="ai-escolha">
          {[
            { value: 'masculino', label: 'Masculino' },
            { value: 'feminino', label: 'Feminino' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`ai-radio-btn${form.sexo === value ? ' ai-radio-btn--active' : ''}`}
              aria-pressed={form.sexo === value}
              onClick={() => onChange('sexo', value)}
            >
              {form.sexo === value && <Check size={13} />}
              {label}
            </button>
          ))}
        </GrupoOpcoes>

        <GrupoOpcoes legenda="Quem forneceu o consentimento?" horizontal className="ai-escolha">
          {[
            { value: 'participante', label: 'Participante' },
            { value: 'responsavel_legal', label: 'Responsável legal' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`ai-radio-btn${form.consentimentoTipo === value ? ' ai-radio-btn--active' : ''}`}
              aria-pressed={form.consentimentoTipo === value}
              onClick={() => onChange('consentimentoTipo', value)}
            >
              {form.consentimentoTipo === value && <Check size={13} />}
              {label}
            </button>
          ))}
        </GrupoOpcoes>

        {form.consentimentoTipo === 'responsavel_legal' && (
          <Campo rotulo="Nome do responsável legal">
            <input
              id="ai-consent-name"
              type="text"
              className="ai-input"
              value={form.consentimentoResponsavelNome}
              maxLength={160}
              onChange={(e) => onChange('consentimentoResponsavelNome', e.target.value)}
            />
          </Campo>
        )}

        <div className="ai-consent-box">
          <Opcao
            tipo="checkbox"
            className="ai-consent-label"
            checked={form.consentimento}
            onChange={(e) => onChange('consentimento', e.target.checked)}
            rotulo={(
              <>
                Confirmo que o participante ou responsável legal foi informado de que as imagens corporais são
                dados sensíveis, serão armazenadas com acesso restrito para esta avaliação e poderão ser excluídas
                por usuário autorizado. Entendo que o resultado é experimental e não constitui diagnóstico clínico.
              </>
            )}
          />
        </div>
      </AvaliacaoSecao>
    </div>
  );
}

function StepCamera({ permissionState, onRequest }) {
  return (
    <div className="ai-step ai-step-camera">
      <div className={`ai-camera-state ai-camera-state--${permissionState}`}>
        {permissionState === 'idle' && (
          <>
            <div className="ai-camera-anim">
              <Camera size={32} />
            </div>
            <h3 className="ai-step-title">Permissão da câmera</h3>
            <p className="ai-step-desc">
              O navegador solicitará acesso à câmera. Toque em "Permitir" para continuar.
            </p>
            <button type="button" className="ai-btn ai-btn--primary ai-btn--wide" onClick={onRequest}>
              <Camera size={16} />
              Solicitar acesso à câmera
            </button>
          </>
        )}
        {permissionState === 'requesting' && (
          <>
            <Loader2 size={40} className="ai-spin" style={{ color: 'var(--ai-primary)' }} />
            <p className="ai-step-desc">Aguardando permissão do navegador…</p>
          </>
        )}
        {permissionState === 'granted' && (
          <>
            <div className="ai-camera-granted-icon">
              <CheckCircle2 size={44} />
            </div>
            <h3 className="ai-step-title">Câmera autorizada</h3>
            <p className="ai-step-desc">
              Pronto. Clique em "Iniciar captura" para começar a sessão de fotos.
            </p>
          </>
        )}
        {permissionState === 'denied' && (
          <>
            <AlertCircle size={40} className="ai-error-icon" />
            <h3 className="ai-step-title">Acesso negado</h3>
            <p className="ai-step-desc">
              Habilite a câmera nas permissões deste site e tente novamente.
            </p>
            <button type="button" className="ai-btn ai-btn--secondary" onClick={onRequest}>
              <RefreshCw size={15} />
              Tentar novamente
            </button>
          </>
        )}
        {permissionState === 'unavailable' && (
          <>
            <AlertCircle size={40} className="ai-error-icon" />
            <h3 className="ai-step-title">Câmera não disponível</h3>
            <p className="ai-step-desc">
              Não foi possível acessar a câmera. Verifique se ela está conectada, livre para uso e se o site usa HTTPS.
            </p>
            <button type="button" className="ai-btn ai-btn--secondary" onClick={onRequest}>
              <RefreshCw size={15} />
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StepCapture({ videoRef, qualityRef, currentView, captures, onCapture, onExitCapture, onSwitchCamera }) {
  const [quality, setQuality] = useState({ brightness: 0, sharpness: 0, framing: 0, ready: false });
  const [showFlash, setShowFlash] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [captureError, setCaptureError] = useState('');
  const animRef = useRef(null);
  const countdownRef = useRef(null);
  const capturingRef = useRef(false);
  const doCaptureRef = useRef(null);

  const SilhouetteComp = SILHOUETTE_COMPONENTS[currentView] || SilhouetteFrontal;
  const viewInfo = CAPTURE_VIEWS[currentView];

  useEffect(() => {
    const tick = () => {
      setQuality(analyzeFrameQuality(videoRef.current, qualityRef.current));
      animRef.current = window.setTimeout(tick, 250);
    };
    tick();
    return () => window.clearTimeout(animRef.current);
  }, [videoRef, qualityRef]);

  // Reset countdown when the pose advances to the next view
  useEffect(() => {
    clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
    capturingRef.current = false;
    return () => clearInterval(countdownRef.current);
  }, [currentView]);

  const brightnessOk = quality.brightness > 0.3;
  const sharpnessOk = quality.sharpness > 0.18;
  const framingOk = quality.framing > 0.3;
  const canCapture = brightnessOk && sharpnessOk && framingOk;

  // Always-fresh capture action — read via ref inside the interval to avoid stale closures
  useEffect(() => { doCaptureRef.current = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2 || capturingRef.current) return;
    capturingRef.current = true;
    setCaptureError('');
    try {
      const capture = await captureBestFrame(videoRef.current);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 350);
      onCapture(capture);
    } catch {
      setCaptureError('A fotografia não foi gerada. Confira a câmera e tente novamente.');
    } finally {
      capturingRef.current = false;
    }
  }; }, [onCapture, videoRef]);

  const handleManualCapture = () => {
    if (!quality.ready || countdownRef.current !== null) return;
    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(null);
        doCaptureRef.current?.();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  return (
    <div className="ai-capture-screen">
      <video ref={videoRef} autoPlay playsInline muted className="ai-camera-feed" />
      <canvas ref={qualityRef} style={{ display: 'none' }} />

      {showFlash && <div className="ai-capture-flash" />}

      {/* Top HUD */}
      <div className="ai-capture-hud-top">
        <button type="button" className="ai-capture-close" onClick={onExitCapture} aria-label="Encerrar captura">
          <X size={18} />
        </button>
        <div className="ai-capture-view-info">
          <span className="ai-capture-view-label">{viewInfo.label}</span>
          <span className="ai-capture-view-count">{currentView + 1} de {CAPTURE_VIEWS.length}</span>
        </div>
        <div className="ai-quality-badges">
          <div className={`ai-quality-badge${brightnessOk ? ' ai-quality-badge--ok' : ' ai-quality-badge--warn'}`}>
            <Sun size={11} />
            <span>{brightnessOk ? 'Luz ok' : 'Pouca luz'}</span>
          </div>
          <div className={`ai-quality-badge${framingOk ? ' ai-quality-badge--ok' : ' ai-quality-badge--warn'}`}>
            <Scan size={11} />
            <span>{framingOk ? 'Contraste ok' : 'Pouco contraste'}</span>
          </div>
          <div className={`ai-quality-badge${sharpnessOk ? ' ai-quality-badge--ok' : ' ai-quality-badge--warn'}`}>
            <Zap size={11} />
            <span>{sharpnessOk ? 'Nítido' : 'Mova devagar'}</span>
          </div>
        </div>
      </div>

      {/* Viewfinder corner brackets */}
      <div className="ai-viewfinder" aria-hidden="true">
        <div className="ai-viewfinder-inner" />
      </div>

      {/* Guia visual; o contraste do quadro não detecta o corpo. */}
      <div className="ai-silhouette-overlay">
        <SilhouetteComp />
      </div>

      {/* Instruction */}
      <div className="ai-capture-instruction">
        <p>{viewInfo.instruction}</p>
        <p className="ai-capture-aruco-hint">
          <Info size={11} />
          Vire o marcador ArUco para a câmera e mantenha-o visível no enquadramento.
        </p>
        {!brightnessOk && (
          <div className="ai-capture-light-hint">
            <Sun size={12} />
            Melhore a iluminação para capturar
          </div>
        )}
        {brightnessOk && !framingOk && (
          <div className="ai-capture-light-hint">
            <Scan size={12} />
            Confira manualmente se o corpo inteiro aparece
          </div>
        )}
        {quality.ready && !canCapture && (
          <p className="ai-capture-manual-note">Os indicadores são aproximados. Você pode capturar e conferir a foto na revisão.</p>
        )}
        {captureError && <p role="alert" className="ai-capture-manual-note">{captureError}</p>}
      </div>

      {/* Bottom HUD */}
      <div className="ai-capture-hud-bottom">
        <div className="ai-capture-thumbnails">
          {CAPTURE_VIEWS.map((view, idx) => (
            <div
              key={view.id}
              className={[
                'ai-thumb',
                idx === currentView && 'ai-thumb--active',
                captures[idx] && 'ai-thumb--done',
              ].filter(Boolean).join(' ')}
            >
              {captures[idx]?.previewUrl
                ? <img src={captures[idx].previewUrl} alt={view.label} />
                : <span className="ai-thumb-label">{view.short}</span>
              }
              {captures[idx] && (
                <div className="ai-thumb-check">
                  <Check size={9} />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className={`ai-capture-btn${countdown !== null ? ' ai-capture-btn--counting' : ''}`}
          onClick={handleManualCapture}
          disabled={!quality.ready}
          aria-label={countdown !== null ? 'Contagem para foto' : 'Capturar foto em 3 segundos'}
        >
          <div className="ai-capture-btn-ring">
            {countdown !== null
              ? <span key={countdown} className="ai-capture-btn-count">{countdown}</span>
              : <div className="ai-capture-btn-inner" />
            }
          </div>
        </button>

        <button
          type="button"
          className="ai-camera-switch-btn"
          onClick={onSwitchCamera}
          aria-label="Alternar câmera"
        >
          <FlipHorizontal size={22} />
        </button>
      </div>
    </div>
  );
}

function StepReview({ captures, onRecapture, error }) {
  const allCaptured = captures.every(Boolean);
  return (
    <div className="ai-step ai-step-review">
      <h3 className="ai-step-title">Revisar capturas</h3>
      <p className="ai-step-desc">
        Verifique se o corpo inteiro está visível e a imagem está nítida em cada vista.
        Os indicadores da câmera são heurísticos e não validam a qualidade clínica da captura.
      </p>

      <div className="ai-review-grid">
        {CAPTURE_VIEWS.map((view, idx) => (
          <div key={view.id} className="ai-review-item">
            <div className={`ai-review-preview${captures[idx] ? '' : ' ai-review-preview--empty'}`}>
              {captures[idx]?.previewUrl
                ? <img src={captures[idx].previewUrl} alt={view.label} />
                : (
                  <div className="ai-review-missing">
                    <Camera size={22} />
                    <span>{captures[idx]?.confirmed ? 'Confirmada no servidor' : 'Não capturado'}</span>
                  </div>
                )
              }
              {captures[idx] && (
                <div className="ai-review-ok-badge"><Check size={12} /></div>
              )}
            </div>
            <div className="ai-review-meta">
              <span className="ai-review-view-label">{view.label}</span>
              <button type="button" className="ai-btn-text" onClick={() => onRecapture(idx)} disabled={captures[idx]?.confirmed}>
                <RotateCcw size={12} />
                {captures[idx]?.confirmed ? 'Confirmada' : captures[idx] ? 'Recapturar' : 'Capturar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {!allCaptured && (
        <div className="ai-review-warning">
          <AlertCircle size={14} />
          <span>Capture todas as 4 vistas antes de enviar.</span>
        </div>
      )}
      {allCaptured && (
        <div className="ai-review-next-hint">
          <Video size={13} />
          <span>Próximo: vídeo 360° — gire lentamente por ~10 s</span>
        </div>
      )}
      {error && (
        <div className="ai-review-warning" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function StepUploading({ progress, fileProgress = [] }) {
  const files = [
    ...CAPTURE_VIEWS.map((v, i) => ({
      name: `${v.id}.jpg`,
      prog: Math.round((fileProgress[i] || 0) * 100),
    })),
    { name: 'video_360', prog: Math.round((fileProgress[4] || 0) * 100) },
  ];
  // O ícone pulsante saiu (enfeite); o progresso continua por arquivo e no
  // total, com o valor escrito.
  return (
    <div className="ai-step ai-step-uploading">
      <AvaliacaoSecao titulo="Enviando avaliação" descricao="Não feche esta janela até o envio ser concluído.">
        <div className="ai-upload-files">
          {files.map((f) => (
            <div key={f.name} className="ai-upload-file">
              <span className="ai-upload-file-name">{f.name}</span>
              <div className="ai-upload-bar" aria-hidden="true">
                <div className="ai-upload-bar-fill" style={{ width: `${f.prog}%` }} />
              </div>
              <span className="ai-upload-pct">{Math.round(f.prog)}%</span>
            </div>
          ))}
        </div>

        <div className="ai-upload-total">
          <div className="ai-upload-bar ai-upload-bar--total" role="progressbar"
            aria-label="Envio dos arquivos" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(progress)}>
            <div className="ai-upload-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{Math.round(progress)}% concluído</span>
        </div>
      </AvaliacaoSecao>
    </div>
  );
}

function StepProcessing({ processing, error, onClose, onRetry, retrying, onNew }) {
  const blocked = ['falha', 'aguardando_processador'].includes(processing?.status);
  const title = blocked ? 'Processamento indisponível' : 'Em análise';
  const description = processing?.message || error
    || 'As imagens estão sendo processadas. Você pode fechar e reabrir esta avaliação para acompanhar o estado salvo.';
  // O título do passo é o da seção; a animação é só enfeite (aria-hidden) e
  // para com o movimento reduzido.
  return (
    <div className="ai-step ai-step-processing">
      <AvaliacaoSecao titulo={title}>
        <div className="ai-processing-anim" aria-hidden="true">
          <div className="ai-processing-ring ai-processing-ring--1" />
          <div className="ai-processing-ring ai-processing-ring--2" />
          <div className="ai-processing-ring ai-processing-ring--3" />
          <Scan size={26} className="ai-processing-icon" />
        </div>
        <p className="ai-step-desc" role={blocked ? 'alert' : 'status'}>{description}</p>
        {!blocked && (
          <div className="ai-processing-eta" role={Number.isFinite(processing?.progress) ? 'progressbar' : 'status'}
            aria-label="Processamento das imagens" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Number.isFinite(processing?.progress) ? Math.round(processing.progress) : undefined}>
            <Clock size={13} />
            <span>{processing?.progress ? `${Math.round(processing.progress)}% processado` : 'Aguardando atualização do processador'}</span>
          </div>
        )}
        <div className="ai-video360-review-controls ai-processing-actions">
          <button type="button" className="ai-btn ai-btn--secondary" onClick={onClose}>
            Fechar — acompanhar no prontuário
          </button>
          {blocked && onRetry && (
            <button type="button" className="ai-btn ai-btn--primary" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 size={14} className="ai-spin" /> : <RefreshCw size={14} />}
              {retrying ? 'Reiniciando…' : 'Tentar novamente'}
            </button>
          )}
          {blocked && onNew && (
            <button type="button" className="ai-btn ai-btn--secondary" onClick={onNew} disabled={retrying}>
              Nova avaliação
            </button>
          )}
        </div>
      </AvaliacaoSecao>
    </div>
  );
}

function StatusPanel({ icon: Icon = Info, title, children, action, onAction, error = false }) {
  return (
    <div className={`ai-status-panel${error ? ' ai-status-panel--error' : ''}`}
      role={error ? 'alert' : 'status'}>
      <Icon size={24} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
        {action && onAction && (
          <button type="button" className="ai-btn ai-btn--secondary" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Scan-result helpers ─────────────────────────────────────────────────────

// ─── Step: Results ────────────────────────────────────────────────────────────

const SEGMENTAL_LEVELS = [
  { key: 'neck_cm',   label: 'Pescoço',     side: 'left',  yPct: 22 },
  { key: 'chest_cm',  label: 'Tórax',       side: 'right', yPct: 40 },
  { key: 'waist_cm',  label: 'Cintura',     side: 'left',  yPct: 50 },
  { key: 'hip_cm',    label: 'Quadril',     side: 'right', yPct: 57 },
  { key: 'thigh_cm',  label: 'Coxa',        side: 'left',  yPct: 66 },
  { key: 'calf_cm',   label: 'Panturrilha', side: 'right', yPct: 81 },
];

function BodySegmentMap({ measurements, zoneColor, sexo, qualityLabel, percGordura, massaMagra, estatura, meshUrl }) {
  const items = SEGMENTAL_LEVELS.filter(({ key }) => measurements?.[key] != null);
  const sexLabel = sexo === 'feminino' ? 'perfil feminino'
    : sexo === 'masculino' ? 'perfil masculino' : 'perfil não informado';
  const canIllustrate = Number.isFinite(Number(estatura)) && Number(estatura) >= 100
    && Number.isFinite(percGordura) && Number.isFinite(massaMagra);

  return (
    <div className="ai-segment-map">
      <div className="ai-segment-map__header">
        <div>
          <span>Ilustração corporal</span>
          <strong>{qualityLabel || 'Coleta processada'}</strong>
        </div>
        <em>{sexLabel}</em>
      </div>

      <div className="ai-segment-map__stage">
        {canIllustrate ? (
          <Body3D
            percGordura={percGordura}
            massaMagra={massaMagra}
            estatura={estatura}
            sexo={sexo}
            zoneColor={zoneColor}
            measurements={measurements}
            meshUrl={meshUrl ?? null}
          />
        ) : <p className="ai-segment-map__empty">Ilustração indisponível: estatura da sessão não informada.</p>}
        {items.map(({ key, label, side, yPct }, index) => (
          <div
            key={key}
            className={`ai-segment-callout ai-segment-callout--${side}`}
            style={{ top: `${yPct}%`, animationDelay: `${160 + index * 70}ms` }}
          >
            <span className="ai-segment-callout__value">{Number(measurements[key]).toFixed(1)} cm</span>
            <span className="ai-segment-callout__label">{label}</span>
          </div>
        ))}
      </div>

      <div className="ai-segment-map__legend">
        <span>Ilustração baseada em estimativas por imagem; não é uma medida clínica validada.</span>
      </div>
    </div>
  );
}

function StepResults({ results, evaluationId, onClose, onNew, readOnly = false }) {
  const {
    percGordura, massaGorda, massaMagra, sexo, estatura,
    measurements, calibracao, indices,
  } = results;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const zoneColor = '#475569';

  const resultSources  = results.sources || {};
  const calibMetodo    = calibracao?.metodo_geral;
  const calibConfianca = calibracao?.confianca_geral;
  const photos         = Number(resultSources.photos_processed ?? 0);
  const videoFrames    = Number(resultSources.video_frames_processed ?? 0);
  const videoOk        = resultSources.video_coverage_ok !== false;
  const bilateral      = Boolean(resultSources.bilateral_legs);
  const rmse           = resultSources.waist_fit_rmse_cm ?? null;
  const algVersion     = results.algoritmoVersion || results.algorithmVersion || results.versoes?.algoritmo || 'não informada';
  const calibViews     = calibracao?.px_por_cm_por_vista || {};

  const qualityLabel = calibConfianca === 'alta'
    ? 'Calibração: confiança alta informada pelo processador'
    : calibConfianca === 'moderada'
      ? 'Calibração: confiança moderada informada pelo processador'
      : calibConfianca ? 'Revisar coleta' : 'Qualidade da calibração não informada';

  const peso  = Number(results.peso);
  const h_m   = Number(estatura) > 0 ? Number(estatura) / 100 : null;
  const imc   = h_m && peso > 0 ? peso / (h_m * h_m) : null;
  const ffmi  = h_m ? massaMagra / (h_m * h_m) : null;

  const handleDelete = async () => {
    if (!evaluationId) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteEvaluation(evaluationId);
      onClose?.();
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, 'Não foi possível excluir o registro.'));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="ai-scan-result">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="ai-scan-header">
        <div className="ai-scan-header-left">
          <Scan size={11} className="ai-scan-hdr-icon" />
          <span className="ai-scan-hdr-title">ESTIMATIVA EXPERIMENTAL</span>
          <span className="ai-scan-hdr-ver">Algoritmo: {algVersion}</span>
        </div>
        <span className={`ai-scan-hdr-badge ai-scan-hdr-badge--${calibConfianca ?? 'baixa'}`}>
          {calibConfianca ? `Calibração: ${calibConfianca}` : 'Qualidade não informada'}
        </span>
      </div>

      {/* ── Body 3D + métricas ────────────────────────────────────────────── */}
      <p className="ai-disclaimer-note">
        Origem: processamento das fotos e do vídeo desta avaliação. A validação clínica e a incerteza
        deste método não estão comprovadas. Qualidade de captura ou calibração não comprova precisão
        clínica. As estimativas não substituem medidas de referência nem devem orientar conduta automaticamente.
      </p>
      <div className="ai-result-lead">
        <div>
          <h3>Composição corporal estimada</h3>
          <p>Resultado experimental das capturas desta avaliação. Compare com as medidas clínicas quando disponíveis.</p>
        </div>
        <strong className="ai-result-lead__value">{percGordura.toFixed(1)}% <small>gordura corporal</small></strong>
      </div>
      <div className="ai-scan-main">
        <BodySegmentMap
          sexo={sexo}
          zoneColor={zoneColor}
          measurements={measurements}
          qualityLabel={qualityLabel}
          percGordura={percGordura}
          massaMagra={massaMagra}
          estatura={estatura}
        />

        <div className="ai-scan-metrics">

          {/* Massas */}
          <div className="ai-scan-masses">
            <div className="ai-scan-mass-item">
              <span className="ai-scan-mass-num">{massaMagra.toFixed(1)}</span>
              <span className="ai-scan-mass-lbl">kg magra estimada</span>
            </div>
            <div className="ai-scan-mass-div" />
            <div className="ai-scan-mass-item">
              <span className="ai-scan-mass-num">{massaGorda.toFixed(1)}</span>
              <span className="ai-scan-mass-lbl">kg gorda estimada</span>
            </div>
          </div>

          {/* Índices rápidos */}
          <div className="ai-scan-qidx">
            {[
              { k: 'IMC · peso e estatura informados', v: imc?.toFixed(1) ?? 'Não informado' },
              { k: 'FFMI · massa estimada e estatura', v: ffmi?.toFixed(1) ?? 'Não informado' },
              indices?.rcest != null && { k: 'Razão cintura/estatura estimada', v: indices.rcest },
            ].filter(Boolean).map(({ k, v }) => (
              <div key={k} className="ai-scan-qidx-item">
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Painel de qualidade ───────────────────────────────────────────── */}
      <details className="ai-scan-quality ai-result-detail">
        <summary>Qualidade da coleta e do processamento</summary>
        <p>Indicadores técnicos do processador. Eles não medem a precisão clínica das estimativas.</p>
        <div className="ai-squal-row">
          <div className="ai-squal-cell">
            <span className="ai-squal-lbl">Calibração</span>
            <span>{calibMetodo || 'Não informada'}</span>
          </div>
          <div className="ai-squal-cell">
            <span className="ai-squal-lbl">Fotos</span>
            <span>{resultSources.photos_processed == null ? 'Não informado' : `${photos} processadas`}</span>
          </div>
          <div className="ai-squal-cell">
            <span className="ai-squal-lbl">Ajuste do modelo</span>
            <span>{rmse == null ? 'Não informado' : `RMSE: ${rmse} cm`}</span>
          </div>
          <div className="ai-squal-cell">
            <span className="ai-squal-lbl">Cobertura</span>
            <span>{resultSources.video_coverage_ok == null ? 'Não informada' : videoOk ? 'Adequada segundo processador' : 'Incompleta segundo processador'}</span>
          </div>
          <div className="ai-squal-cell">
            <span className="ai-squal-lbl">Pernas</span>
            <span className={`ai-squal-tag${bilateral ? ' ai-squal-tag--ok' : ''}`}>
              {resultSources.bilateral_legs == null ? 'Não informado' : bilateral ? 'Separadas' : 'Estimadas'}
            </span>
          </div>
        </div>
        <p className="ai-squal-meta">
          {rmse != null && `RMSE elipse: ±${rmse} cm`}
          {rmse != null && videoFrames > 0 && ' · '}
          {videoFrames > 0 && `${videoFrames} frames`}
          {calibMetodo === 'aruco' && ' · ArUco ✓'}
        </p>
      </details>

      {/* ── Índices antropométricos ───────────────────────────────────────── */}
      {indices && (
        <details className="ai-scan-indices">
          <summary>Outros índices estimados</summary>
          <p>Calculados a partir de medidas por imagem; interprete apenas junto às medidas clínicas.</p>
          <div className="ai-scan-indices-grid">
            {[
              { k: 'BRI',         v: indices.bri,              fmt: (x) => x.toFixed(2) },
              { k: 'ABSI',        v: indices.absi,             fmt: (x) => x.toFixed(4) },
              { k: 'WHtR',        v: indices.rcest,            fmt: (x) => x },
              { k: 'WHR',         v: indices.rcq,              fmt: (x) => (typeof x === 'number' ? x.toFixed(2) : x) },
            ].filter(({ v }) => v != null).map(({ k, v, fmt }) => (
              <div key={k} className="ai-scan-idx">
                <span className="ai-scan-idx-k">{k}</span>
                <strong className="ai-scan-idx-v">
                  {fmt ? fmt(v) : v}
                </strong>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Relatório técnico (colapsável) ────────────────────────────────── */}
      {Object.keys(calibViews).length > 0 && (
        <details className="ai-scan-tech-report">
          <summary>Relatório técnico</summary>
          <div className="ai-tech-report-body">
            <div className="ai-internal-calibration">
              {Object.entries(calibViews).map(([view, info]) => (
                <div key={view} className="ai-internal-calibration-row">
                  <span>{view.replaceAll('_', ' ')}</span>
                  <strong>{info?.metodo || 'n/d'}</strong>
                  <em>
                    {info?.px_por_cm ? `${info.px_por_cm} px/cm` : 'sem escala'}
                    {info?.confianca ? ` · ${info.confianca}` : ''}
                  </em>
                </div>
              ))}
            </div>
            {calibracao?.video && (
              <div className="ai-internal-calibration" style={{ marginTop: '0.5rem' }}>
                <div className="ai-internal-calibration-row">
                  <span>vídeo 360</span>
                  <strong>{calibracao.video.metodo || 'n/d'}</strong>
                  <em>
                    {calibracao.video.px_por_cm ? `${calibracao.video.px_por_cm} px/cm` : 'sem escala'}
                    {calibracao.video.confianca ? ` · ${calibracao.video.confianca}` : ''}
                  </em>
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* ── Excluir ───────────────────────────────────────────────────────── */}
      {evaluationId && !readOnly && (
        <div className="ai-results-delete-area">
          {!confirmingDelete ? (
            <button
              type="button"
              className="ai-btn-delete-trigger"
              onClick={() => setConfirmingDelete(true)}
            >
              <X size={13} />
              Excluir este registro
            </button>
          ) : (
            <div className="ai-results-delete-confirm">
              <p className="ai-results-delete-question">
                Excluir permanentemente? As imagens e os resultados serão removidos.
              </p>
              {deleteError && <p className="ai-results-delete-error">{deleteError}</p>}
              <div className="ai-results-delete-actions">
                <button
                  type="button"
                  className="ai-btn ai-btn--secondary"
                  onClick={() => { setConfirmingDelete(false); setDeleteError(''); }}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ai-btn ai-btn--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 size={14} className="ai-spin" /> : null}
                  {deleting ? 'Excluindo…' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {onNew && !readOnly && (
        <button type="button" className="ai-btn ai-btn--primary ai-btn--wide" onClick={onNew}>
          Nova avaliação por imagem
        </button>
      )}
    </div>
  );
}

// ─── Step: Video 360° ────────────────────────────────────────────────────────

function StepVideo360({ onRecorded, onDone, onExit }) {
  const [phase, setPhase] = useState('loading'); // loading | preview | countdown | recording | reviewing | error
  const [videoError, setVideoError] = useState('');
  const [preCount, setPreCount] = useState(3);
  const [countdown, setCountdown] = useState(10);
  const [minElapsed, setMinElapsed] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [vidQuality, setVidQuality] = useState({ brightness: 0, sharpness: 0, framing: 0, ready: false });
  const videoRef = useRef(null);
  const vidQualityCanvasRef = useRef(null);
  const qualityAnimRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const preTimerRef = useRef(null);
  const minTimerRef = useRef(null);
  const streamRef = useRef(null);
  const facingModeVidRef = useRef('environment');

  useEffect(() => () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl]);

  // Open own camera stream on mount
  useEffect(() => {
    let active = true;
    const open = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        setPhase('preview');
      } catch {
        if (active) setPhase('error');
      }
    };
    open();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      clearInterval(timerRef.current);
      clearInterval(preTimerRef.current);
      clearTimeout(minTimerRef.current);
    };
  }, []);

  // Attach stream to video when live preview phases are active
  useEffect(() => {
    if ((phase === 'preview' || phase === 'countdown') && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  // Quality analysis loop — only during preview so person can adjust before recording
  useEffect(() => {
    if (phase !== 'preview') return undefined;
    const tick = () => {
      setVidQuality(analyzeFrameQuality(videoRef.current, vidQualityCanvasRef.current));
      qualityAnimRef.current = window.setTimeout(tick, 250);
    };
    tick();
    return () => window.clearTimeout(qualityAnimRef.current);
  }, [phase]);

  const handleRetry = async () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setVideoError('');
    setPhase('loading');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingModeVidRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = s;
      setPhase('preview');
    } catch {
      setPhase('error');
    }
  };

  const handleSwitchCameraVid = async () => {
    if (phase !== 'preview') return;
    const newMode = facingModeVidRef.current === 'environment' ? 'user' : 'environment';
    facingModeVidRef.current = newMode;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: newMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setVideoError('Não foi possível trocar de câmera. Tente novamente ou use outro dispositivo.');
        setPhase('error');
      }
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    if (typeof MediaRecorder === 'undefined') {
      setVideoError('Este navegador não oferece gravação de vídeo compatível. Use outro navegador ou dispositivo.');
      setPhase('error');
      return;
    }
    chunksRef.current = [];
    const mimeType = [
      'video/mp4',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find((candidate) => MediaRecorder.isTypeSupported?.(candidate));
    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    } catch {
      setVideoError('Não foi possível iniciar a gravação neste navegador. Tente outro dispositivo.');
      setPhase('error');
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      if (!blob.size) {
        setVideoError('A gravação ficou vazia. Tente novamente.');
        setPhase('error');
        return;
      }
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      onRecorded(blob);
      setPhase('reviewing');
    };
    recorderRef.current = recorder;
    try {
      recorder.start(200);
    } catch {
      setVideoError('A câmera não iniciou a gravação. Tente novamente.');
      setPhase('error');
      return;
    }
    setPhase('recording');
    setCountdown(10);
    setMinElapsed(false);

    // Enforce minimum 5 s before stop is enabled
    minTimerRef.current = setTimeout(() => setMinElapsed(true), 5000);

    let ct = 10;
    timerRef.current = setInterval(() => {
      ct -= 1;
      setCountdown(ct);
      if (ct <= 0) {
        clearInterval(timerRef.current);
        clearTimeout(minTimerRef.current);
        recorderRef.current?.stop();
      }
    }, 1000);
  };

  const startPreCount = () => {
    setPhase('countdown');
    setPreCount(3);
    let c = 3;
    preTimerRef.current = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(preTimerRef.current);
        startRecording();
      } else {
        setPreCount(c);
      }
    }, 1000);
  };

  const stopEarly = () => {
    if (!minElapsed) return;
    clearInterval(timerRef.current);
    clearTimeout(minTimerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const reRecord = () => {
    if (recordedUrl) { URL.revokeObjectURL(recordedUrl); setRecordedUrl(null); }
    onRecorded(null);
    setCountdown(10);
    setPhase('preview');
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  };

  const C = 2 * Math.PI * 45;
  const ringOffset = C * (countdown / 10);
  const vidBrightnessOk = vidQuality.brightness > 0.3;
  const vidSharpnessOk = vidQuality.sharpness > 0.18;
  const vidFramingOk = vidQuality.framing > 0.3;
  const qualityAdvisoryOk = vidBrightnessOk && vidSharpnessOk && vidFramingOk;
  const readyToRecord = Boolean(vidQuality.ready);

  const videoInstruction = (() => {
    if (!vidBrightnessOk) return 'Melhore a iluminação';
    if (!vidSharpnessOk) return 'Mantenha a câmera estável e limpe a lente';
    if (!vidFramingOk) return 'Confira se o corpo inteiro aparece';
    return 'Gire devagar — uma volta em ~10 s';
  })();

  return (
    <div className="ai-capture-screen ai-video360-screen">
      {/* Live feed */}
      {!['reviewing', 'loading', 'error'].includes(phase) && (
        <video ref={videoRef} autoPlay playsInline muted className="ai-camera-feed" />
      )}
      {/* Hidden canvas for quality analysis */}
      <canvas ref={vidQualityCanvasRef} style={{ display: 'none' }} />
      {/* Review playback */}
      {phase === 'reviewing' && recordedUrl && (
        <video src={recordedUrl} controls playsInline className="ai-camera-feed" />
      )}

      {/* Top HUD */}
      <div className="ai-capture-hud-top">
        <button type="button" className="ai-capture-close" onClick={onExit}
          disabled={phase === 'recording' || phase === 'countdown'} aria-label="Sair">
          <X size={18} />
        </button>
        <div className="ai-capture-view-info">
          {phase === 'loading'   && <span className="ai-capture-view-label">Iniciando câmera…</span>}
          {phase === 'preview'   && <span className="ai-capture-view-label">Vídeo 360°</span>}
          {phase === 'countdown' && <span className="ai-capture-view-label">Prepare-se…</span>}
          {phase === 'recording' && (
            <span className="ai-capture-view-label ai-capture-view-label--rec">
              <span className="ai-rec-dot" /> GRAVANDO
            </span>
          )}
          {phase === 'reviewing' && <span className="ai-capture-view-label">Revisar gravação</span>}
          {phase === 'error'     && <span className="ai-capture-view-label">Câmera indisponível</span>}
        </div>
        {/* Condition badges — only during preview so person can adjust */}
        {phase === 'preview' && (
          <div className="ai-quality-badges">
            <div className={`ai-quality-badge${vidBrightnessOk ? ' ai-quality-badge--ok' : ' ai-quality-badge--warn'}`}>
              <Sun size={11} />
              <span>{vidBrightnessOk ? 'Luz ok' : 'Pouca luz'}</span>
            </div>
            <div className={`ai-quality-badge${vidFramingOk ? ' ai-quality-badge--ok' : ' ai-quality-badge--warn'}`}>
              <Scan size={11} />
              <span>{vidFramingOk ? 'Contraste ok' : 'Pouco contraste'}</span>
            </div>
          </div>
        )}
        {phase === 'preview' && (
          <button type="button" className="ai-camera-switch-btn"
            onClick={handleSwitchCameraVid} aria-label="Alternar câmera">
            <FlipHorizontal size={20} />
          </button>
        )}
      </div>

      {/* 3-2-1 pre-count overlay — key forces re-mount so animation replays each digit */}
      {phase === 'countdown' && (
        <div className="ai-precount-overlay">
          <span key={preCount} className="ai-precount-number">{preCount}</span>
        </div>
      )}

      {/* Body silhouette — shows during preview/countdown/recording; dims while recording */}
      {!['reviewing', 'loading', 'error'].includes(phase) && (
        <div className={[
          'ai-silhouette-overlay ai-silhouette-overlay--video',
          phase === 'recording' && 'ai-silhouette-overlay--dim',
        ].filter(Boolean).join(' ')}>
          <SilhouetteFrontal />
        </div>
      )}

      {/* Rotation guide ring */}
      {(phase === 'preview' || phase === 'recording') && (
        <div className="ai-video360-guide-wrap">
          <svg
            viewBox="0 0 140 140"
            className={`ai-rotation-svg${phase === 'recording' ? ' ai-rotation-svg--recording' : ''}`}
            aria-hidden="true"
          >
            <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
            <circle
              cx="70" cy="70" r="54"
              fill="none"
              stroke={qualityAdvisoryOk || phase === 'recording' ? 'rgba(255,255,255,0.45)' : 'rgba(250,204,21,0.4)'}
              strokeWidth="2.5"
              strokeDasharray="10 6"
              strokeLinecap="round"
            />
            <polygon
              points="70,14 79,30 61,30"
              fill={qualityAdvisoryOk || phase === 'recording' ? 'rgba(255,255,255,0.85)' : 'rgba(250,204,21,0.7)'}
            />
          </svg>
          {phase === 'preview' && (
            <p className={`ai-video360-instruction${qualityAdvisoryOk ? '' : ' ai-video360-instruction--warn'}`}>
              {videoInstruction}
            </p>
          )}
          {phase === 'preview' && (
            <p className="ai-video360-instruction">O indicador é aproximado. Confira visualmente a iluminação e o corpo inteiro antes de gravar.</p>
          )}
        </div>
      )}

      {/* Countdown ring */}
      {phase === 'recording' && (
        <div className="ai-countdown-wrap">
          <svg viewBox="0 0 100 100" className="ai-countdown-svg">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#ef4444"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - ringOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.9s linear' }}
            />
          </svg>
          <span className="ai-countdown-number">{countdown}</span>
        </div>
      )}

      {/* Bottom controls */}
      <div className="ai-capture-hud-bottom">
        {phase === 'loading' && (
          <Loader2 size={32} className="ai-spin" style={{ color: 'white', margin: '0 auto' }} />
        )}
        {phase === 'error' && (
          <div className="ai-video360-error">
            <p role="alert">{videoError || 'Não foi possível acessar a câmera.'}</p>
            <button type="button" className="ai-btn ai-btn--secondary ai-btn--light" onClick={handleRetry}>
              <RefreshCw size={14} />
              Tentar novamente
            </button>
          </div>
        )}
        {(phase === 'preview' || phase === 'countdown') && (
          <>
            <div style={{ width: 88 }} />
            <button
              type="button"
              className={`ai-record-btn${!readyToRecord && phase === 'preview' ? ' ai-record-btn--locked' : ''}`}
              onClick={phase === 'preview' && readyToRecord ? startPreCount : undefined}
              disabled={phase === 'countdown' || !readyToRecord}
              aria-label="Iniciar gravação"
            >
              <div className="ai-record-btn-ring"><div className="ai-record-btn-dot" /></div>
            </button>
            <div style={{ width: 88 }} />
          </>
        )}
        {phase === 'recording' && (
          <>
            <div style={{ width: 88 }} />
            <div className="ai-record-stop-wrap">
              <button
                type="button"
                className={`ai-record-btn ai-record-btn--stop${!minElapsed ? ' ai-record-btn--stop-locked' : ''}`}
                onClick={stopEarly}
                disabled={!minElapsed}
                aria-label="Parar gravação"
              >
                <div className="ai-record-btn-ring"><div className="ai-record-btn-square" /></div>
              </button>
              {!minElapsed && <span className="ai-min-hint">mín. 5 s</span>}
            </div>
            <div style={{ width: 88 }} />
          </>
        )}
        {phase === 'reviewing' && (
          <div className="ai-video360-review-controls">
            <button type="button" className="ai-btn ai-btn--secondary ai-btn--light" onClick={reRecord}>
              <RotateCcw size={14} />
              Regravar
            </button>
            <button type="button" className="ai-btn ai-btn--primary" onClick={onDone}>
              <Upload size={14} />
              Confirmar e enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STAGE_LABELS = ['Preparar', 'Fotografar', 'Vídeo 360°', 'Resultado'];
const stageForStep = (step) => (
  ['capture', 'review'].includes(step) ? 1
    : step === 'video360' ? 2
      : ['uploading', 'processing', 'results', 'readonly_pending'].includes(step) ? 3 : 0
);
const historyDate = (item) => {
  const date = new Date(item?.measuredAt || item?.createdAt || item?.data || '');
  return Number.isNaN(date.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
};
const historyStatus = (item) => ['finalizada', 'concluida'].includes(item?.status)
  ? 'Resultado disponível' : 'Em andamento';
const EMPTY_FORM = {
  peso: '',
  estatura: '',
  sexo: '',
  consentimento: false,
  consentimentoTipo: '',
  consentimentoResponsavelNome: '',
  arucoMarkerSizeCm: '14.8',
};

const normalizeResultPayload = (payload, fallback = {}) => {
  const required = ['percGordura', 'massaGorda', 'massaMagra'];
  if (!payload || required.some((key) => !['number', 'string'].includes(typeof payload[key])
    || String(payload[key]).trim() === '' || !Number.isFinite(Number(payload[key])) || Number(payload[key]) < 0)) return null;
  return {
    ...payload,
    percGordura: Number(payload.percGordura),
    massaGorda: Number(payload.massaGorda),
    massaMagra: Number(payload.massaMagra),
    rcq: payload.rcq == null ? null : Number(payload.rcq),
    sexo: payload.sexo || fallback.sexo,
    peso: Number(payload.peso ?? fallback.peso),
    estatura: Number(payload.estatura ?? fallback.estatura),
  };
};

const revokeCapturePreviews = (items = []) => {
  items.forEach((item) => {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
};

export function AvaliacaoImagem({ isOpen, onClose, patient, readOnly = false }) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState('intro');
  const [form, setForm] = useState(EMPTY_FORM);
  const [permissionState, setPermissionState] = useState('idle');
  const [stream, setStream] = useState(null);
  const [currentView, setCurrentView] = useState(0);
  const [captures, setCaptures] = useState(Array(CAPTURE_VIEWS.length).fill(null));
  const [videoBlob, setVideoBlob] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileProgress, setUploadFileProgress] = useState(Array(5).fill(0));
  const [results, setResults] = useState(null);
  const [evaluationId, setEvaluationId] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [processingRevision, setProcessingRevision] = useState(0);
  const [confirmedViews, setConfirmedViews] = useState([]);
  const [history, setHistory] = useState([]);
  const [requestedRecordId, setRequestedRecordId] = useState(null);
  const [restoreRevision, setRestoreRevision] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const qualityRef = useRef(null);
  const capturesRef = useRef(captures);
  const facingModeRef = useRef('environment');

  const isCapturing = step === 'capture' || step === 'video360';
  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (!isOpen) return undefined;
    const keepFocusInside = (event) => {
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog || dialog.contains(document.activeElement)) return;
      event.preventDefault();
      const buttons = [...dialog.querySelectorAll('button:not([disabled])')]
        .filter((button) => button.getClientRects().length > 0);
      const target = event.shiftKey ? buttons.at(-1) : buttons[0];
      (target || dialog).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => document.removeEventListener('keydown', keepFocusInside);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (['capture', 'review', 'video360'].includes(step)
      && (captures.some((item) => item?.blob) || videoBlob)) {
      setConfirmDiscard(true);
      return;
    }
    onClose?.();
  }, [captures, onClose, step, videoBlob]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const focusInside = () => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(document.activeElement)) {
        const target = dialog.querySelector('[data-modal-initial-focus], button:not([disabled])');
        (target || dialog).focus({ preventScroll: true });
      }
    };
    const timer = window.setTimeout(focusInside, 230);
    return () => window.clearTimeout(timer);
  }, [confirmDiscard, isOpen, step]);

  useEffect(() => {
    if (confirmDiscard) dialogRef.current?.querySelector('.ai-discard-banner button')?.focus({ preventScroll: true });
  }, [confirmDiscard]);

  useEffect(() => {
    if (!isOpen) {
      setRequestedRecordId(null);
      setConfirmDiscard(false);
      return undefined;
    }
    const onEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (confirmDiscard) { setConfirmDiscard(false); return; }
      if (!['uploading', 'video360'].includes(step)) handleClose();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [confirmDiscard, handleClose, isOpen, step]);

  // Attach stream to video element when step changes to capture
  useEffect(() => {
    if (step === 'capture' && stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [step, stream]);

  // Stop stream on close
  useEffect(() => {
    if (!isOpen && stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [isOpen, stream]);

  const resetForNewEvaluation = useCallback(() => {
    setStep('intro');
    setForm(EMPTY_FORM);
    setPermissionState('idle');
    setCurrentView(0);
    setCaptures((current) => {
      revokeCapturePreviews(current);
      return Array(CAPTURE_VIEWS.length).fill(null);
    });
    setVideoBlob(null);
    setUploadProgress(0);
    setUploadFileProgress(Array(5).fill(0));
    setResults(null);
    setEvaluationId(null);
    setProcessing(null);
    setConfirmedViews([]);
    setSubmitError('');
    setRetrying(false);
    setProcessingRevision((value) => value + 1);
  }, []);

  // Restore the latest record on open so completed and in-flight evaluations
  // remain accessible after closing the modal or reloading the page.
  useEffect(() => {
    if (!isOpen) return undefined;
    if (!patient?.id) {
      setSubmitError('Selecione um paciente para consultar a avaliação por imagem.');
      setStep('restore_error');
      return undefined;
    }
    let active = true;
    resetForNewEvaluation();
    setHistory([]);
    setStep('restoring');
    const restore = async () => {
      try {
        const records = await listImageEvaluations(patient.id);
        if (!active) return;
        setHistory(records);
        const selected = records.find((item) => item.id === requestedRecordId) || records[0];
        if (!selected?.id) { setStep(readOnly ? 'readonly_empty' : 'intro'); return; }
        const latest = await findEvaluation(selected.id);
        if (!active) return;
        const consent = latest?.dados?.consentimento || {};
        const restoredForm = {
          peso: latest?.dados?.peso ?? '',
          estatura: latest?.dados?.estatura ?? '',
          sexo: latest?.dados?.sexo || '',
          consentimento: Boolean(consent.aceito),
          consentimentoTipo: consent.tipo || 'participante',
          consentimentoResponsavelNome: consent.responsavelNome || '',
          arucoMarkerSizeCm: String(latest?.dados?.arucoMarkerSizeCm ?? '14.8'),
        };
        setForm(restoredForm);
        setEvaluationId(latest.id);
        const status = await getStatus(latest.id);
        if (!active) return;
        setProcessing(status);
        const confirmed = (status.captures || []).filter((capture) => capture.confirmed).map((capture) => capture.vista);
        setConfirmedViews(confirmed);
        setCaptures(CAPTURE_VIEWS.map((view) => confirmed.includes(view.id) ? { confirmed: true } : null));
        if (status.hasResults || status.status === 'concluida') {
          const response = await getResults(latest.id);
          if (!active) return;
          const normalized = normalizeResultPayload(response?.results, restoredForm);
          if (normalized) {
            setResults(normalized);
            setStep('results');
            return;
          }
          setProcessing({ status: 'falha', message: 'O resultado salvo está incompleto. Nenhuma estimativa pode ser exibida.' });
          setStep(readOnly ? 'readonly_pending' : 'processing');
          return;
        }
        if (['iniciando', 'em_processamento', 'falha', 'aguardando_processador'].includes(status.status)) {
          setStep(readOnly ? 'readonly_pending' : 'processing');
        } else if (status.status === 'aguardando_upload') {
          if (!readOnly) setSubmitError('Envio interrompido. As capturas confirmadas foram preservadas; capture apenas as vistas pendentes.');
          setStep(readOnly ? 'readonly_pending' : 'review');
        } else {
          throw new Error('Estado de processamento desconhecido.');
        }
      } catch (error) {
        if (active) {
          setSubmitError(getApiErrorMessage(error, 'Não foi possível restaurar a última avaliação. Feche e abra novamente.'));
          setStep('restore_error');
        }
      }
    };
    void restore();
    return () => { active = false; };
  }, [isOpen, patient?.id, readOnly, requestedRecordId, restoreRevision, resetForNewEvaluation]);

  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  useEffect(() => () => revokeCapturePreviews(capturesRef.current), []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const requestCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState('unavailable');
      return false;
    }
    setPermissionState('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
        audio: false,
      });
      setStream(s);
      setPermissionState('granted');
      return true;
    } catch (err) {
      setPermissionState(err.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      return false;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, [stream]);

  const switchCamera = useCallback(async () => {
    const newMode = facingModeRef.current === 'environment' ? 'user' : 'environment';
    facingModeRef.current = newMode;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: newMode }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      // fallback: open any available camera
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setStream(null);
        setPermissionState('unavailable');
        setStep('camera');
      }
    }
  }, [stream]);

  const handleCapture = useCallback((capture) => {
    setCaptures((prev) => {
      const next = [...prev];
      if (next[currentView]?.previewUrl) URL.revokeObjectURL(next[currentView].previewUrl);
      next[currentView] = capture;
      return next;
    });
    const nextMissing = CAPTURE_VIEWS.findIndex((_, index) => index !== currentView && !captures[index]);
    if (nextMissing >= 0) {
      setCurrentView(nextMissing);
    } else {
      stopStream();
      setStep('review');
    }
  }, [captures, currentView, stopStream]);

  const handleRecapture = useCallback(async (viewIdx) => {
    if (captures[viewIdx]?.confirmed) return;
    setCaptures((prev) => {
      const next = [...prev];
      if (next[viewIdx]?.previewUrl) URL.revokeObjectURL(next[viewIdx].previewUrl);
      next[viewIdx] = null;
      return next;
    });
    setCurrentView(viewIdx);
    const ok = await requestCamera();
    if (ok) setStep('capture');
  }, [captures, requestCamera]);

  const handleExitCapture = useCallback(() => {
    stopStream();
    setStep('review');
  }, [stopStream]);

  const handleSubmit = useCallback(async () => {
    if (!patient?.id || !captures.every(Boolean) || (!videoBlob && !confirmedViews.includes('video_360'))) {
      setSubmitError('Paciente, quatro fotografias e vídeo 360° são obrigatórios.');
      setStep('review');
      return;
    }
    setSubmitError('');
    setStep('uploading');
    setUploadProgress(0);
    setUploadFileProgress(Array(5).fill(0));
    let activeEvaluationId = evaluationId;
    try {
      if (activeEvaluationId) {
        const current = await getStatus(activeEvaluationId);
        if (current.status !== 'aguardando_upload') {
          setProcessing(current);
          setStep('processing');
          return;
        }
      }
      if (!activeEvaluationId) {
        const created = await createEvaluation({
          pacienteId: patient.id,
          peso: Number(form.peso),
          estatura: Number(form.estatura),
          sexo: form.sexo,
          consentimento: Boolean(form.consentimento),
          consentimentoTipo: form.consentimentoTipo,
          consentimentoResponsavelNome: form.consentimentoTipo === 'responsavel_legal'
            ? form.consentimentoResponsavelNome.trim()
            : undefined,
          arucoMarkerSizeCm: Number(form.arucoMarkerSizeCm) || 14.8,
          videoMimeType: videoBlob.type || undefined,
        });
        activeEvaluationId = created.id;
        setEvaluationId(created.id);
        setHistory((current) => [
          { id: created.id, createdAt: created.createdAt || new Date().toISOString(), status: 'rascunho' },
          ...current.filter((item) => item.id !== created.id),
        ]);
      }

      const uploadContract = await createUploadUrls(activeEvaluationId);
      const sources = [
        ...CAPTURE_VIEWS.map((view, index) => ({ vista: view.id, blob: captures[index].blob })),
        { vista: 'video_360', blob: videoBlob },
      ];
      const descriptors = new Map(
        (uploadContract.uploads || []).map((descriptor) => [descriptor.vista, descriptor]),
      );
      const pendingSources = sources.filter((source) => descriptors.has(source.vista));
      if (pendingSources.some((source) => !source.blob)) {
        throw new Error('Capture os arquivos pendentes antes de retomar o envio.');
      }
      const fractions = sources.map((source) => descriptors.has(source.vista) ? 0 : 1);

      for (let offset = 0; offset < pendingSources.length; offset += 2) {
        const batch = pendingSources.slice(offset, offset + 2);
        const uploads = await Promise.allSettled(batch.map((source) => {
          const index = sources.findIndex((item) => item.vista === source.vista);
          return uploadCapture({
            evaluationId: activeEvaluationId,
            descriptor: descriptors.get(source.vista),
            blob: source.blob,
            onProgress: (fraction) => {
              fractions[index] = fraction;
              setUploadFileProgress([...fractions]);
              const total = fractions.reduce((sum, value) => sum + value, 0) / fractions.length;
              setUploadProgress(Math.round(total * 100));
            },
          });
        }));
        const failed = uploads.find((upload) => upload.status === 'rejected');
        if (failed) throw failed.reason;
      }
      setUploadProgress(100);
      setProcessing({ status: 'iniciando', progress: 5, message: null });
      setStep('processing');
    } catch (error) {
      const message = error?.response
        ? getApiErrorMessage(error, 'Não foi possível enviar a avaliação.')
        : (error?.message || 'Não foi possível enviar a avaliação.');
      setSubmitError(message);
      if (activeEvaluationId) {
        try {
          const status = await getStatus(activeEvaluationId);
          const confirmed = (status.captures || []).filter((capture) => capture.confirmed).map((capture) => capture.vista);
          setConfirmedViews(confirmed);
          setCaptures((current) => current.map((capture, index) => (
            confirmed.includes(CAPTURE_VIEWS[index].id) ? { ...capture, confirmed: true } : capture
          )));
        } catch { /* O contrato de upload consultara novamente o estado ao retomar. */ }
      }
      setStep('review');
    }
  }, [captures, confirmedViews, evaluationId, form, patient?.id, videoBlob]);

  useEffect(() => {
    if (!isOpen || step !== 'processing' || !evaluationId) return undefined;
    let active = true;
    let timer = null;

    const poll = async () => {
      try {
        const nextStatus = await getStatus(evaluationId);
        if (!active) return;
        setProcessing(nextStatus);
        if (nextStatus.hasResults || nextStatus.status === 'concluida') {
          const response = await getResults(evaluationId);
          const payload = response?.results;
          if (!active) return;
          const normalized = normalizeResultPayload(payload, {
            sexo: form.sexo,
            estatura: form.estatura,
          });
          if (!normalized) {
            setProcessing({
              ...nextStatus,
              status: 'falha',
              message: 'O processador concluiu sem retornar a estimativa de composição corporal.',
            });
            return;
          }
          setResults(normalized);
          setHistory((current) => current.map((item) => item.id === evaluationId
            ? { ...item, status: 'finalizada' } : item));
          setStep('results');
          return;
        }
        if (nextStatus.terminal) return;
        timer = window.setTimeout(poll, 3000);
      } catch (error) {
        if (!active) return;
        setProcessing((current) => ({
          ...(current || {}),
          message: getApiErrorMessage(error, 'Falha temporária ao consultar o processamento.'),
        }));
        timer = window.setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [evaluationId, form.estatura, form.sexo, isOpen, processingRevision, step]);

  const handleRetryProcessing = useCallback(async () => {
    if (!evaluationId) return;
    setRetrying(true);
    setSubmitError('');
    try {
      const next = await reprocessEvaluation(evaluationId);
      setProcessing({ ...next, progress: 5, message: null });
      setStep('processing');
      setProcessingRevision((value) => value + 1);
    } catch (error) {
      setProcessing((current) => ({
        ...(current || {}),
        status: 'falha',
        message: getApiErrorMessage(error, 'Não foi possível reiniciar o processamento.'),
      }));
    } finally {
      setRetrying(false);
    }
  }, [evaluationId]);

  const goNext = useCallback(async () => {
    if (step === 'intro') { setStep('consent'); return; }
    if (step === 'consent') { setStep('camera'); return; }
    if (step === 'camera') {
      if (permissionState === 'granted') setStep('capture');
      return;
    }
  }, [permissionState, step]);

  const goBack = useCallback(async () => {
    if (step === 'consent') { setStep('intro'); return; }
    if (step === 'camera') { setStep('consent'); return; }
    if (step === 'video360') { setStep('review'); return; }
    if (step === 'review') {
      const nextMissing = captures.findIndex((capture) => !capture);
      if (nextMissing < 0) return;
      setCurrentView(nextMissing);
      const ok = await requestCamera();
      if (ok) setStep('capture');
    }
  }, [step, captures, requestCamera]);

  if (!isOpen) return null;

  const pesoInformado = Number(form.peso);
  const estaturaInformada = Number(form.estatura);
  const marcadorInformado = Number(form.arucoMarkerSizeCm);
  const consentValid = form.peso !== ''
    && Number.isFinite(pesoInformado) && pesoInformado >= 20 && pesoInformado <= 350
    && form.estatura !== ''
    && Number.isFinite(estaturaInformada) && estaturaInformada >= 100 && estaturaInformada <= 250
    && form.arucoMarkerSizeCm !== ''
    && Number.isFinite(marcadorInformado) && marcadorInformado >= 3 && marcadorInformado <= 100
    && ['masculino', 'feminino'].includes(form.sexo)
    && form.consentimento
    && form.consentimentoTipo
    && (form.consentimentoTipo !== 'responsavel_legal' || form.consentimentoResponsavelNome.trim().length >= 3);
  const canNext = !readOnly && (
    step === 'intro' ||
    (step === 'consent' && consentValid) ||
    (step === 'camera' && permissionState === 'granted'));
  const allCaptured = captures.every(Boolean);
  const showFooter = !['capture', 'video360', 'uploading', 'processing', 'restoring', 'restore_error'].includes(step);
  const showHeader = step !== 'capture' && step !== 'video360';
  const showHistory = history.length > 0 && !isCapturing
    && !captures.some((item) => item?.blob) && !videoBlob
    && !['restoring', 'uploading', 'consent', 'camera'].includes(step);

  const dialog = (
    <div className="app-modal-overlay ai-wizard-overlay">
      {/* A raiz da base (.av-modulo) é a própria casca do diálogo, sem
          elemento a mais: o título do diálogo é o h2 do cabeçalho, e as
          seções dos passos ficam h3 (nivelTitulo 2). O ref chega ao
          motion.div como prop (React 19). */}
      <AvaliacaoModulo
        as={motion.div}
        nivelTitulo={2}
        ref={dialogRef}
        className={`app-modal-shell ai-wizard-shell${isCapturing ? ' ai-wizard-shell--capture' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Avaliação corporal por imagem"
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
      >
        {showHeader && (
          <div className="ai-wizard-header">
            <div className="ai-wizard-header-left">
              {['consent', 'camera', 'video360'].includes(step) && (
                <button type="button" className="ai-icon-btn" onClick={goBack} aria-label="Voltar">
                  <ChevronLeft size={18} />
                </button>
              )}
              <div>
                <p className="ai-wizard-patient">{patient?.name || patient?.nome || 'Avaliação'}</p>
                <h2 id="ai-dialog-title" className="ai-wizard-subtitle" tabIndex={-1} data-modal-initial-focus>
                  Composição corporal por imagem
                </h2>
              </div>
            </div>
            <div className="ai-wizard-header-right">
              <button type="button" className="ai-icon-btn" onClick={handleClose} aria-label="Fechar" disabled={step === 'uploading'}>
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {showHeader && !['restoring', 'restore_error', 'readonly_empty'].includes(step) && (
          <ol className="ai-stage-nav" aria-label="Etapas da avaliação">
            {STAGE_LABELS.map((label, index) => (
              <li key={label} className={`ai-stage-nav__item${index === stageForStep(step) ? ' ai-stage-nav__item--current' : ''}${index < stageForStep(step) ? ' ai-stage-nav__item--done' : ''}`}
                aria-current={index === stageForStep(step) ? 'step' : undefined}>
                <span className="ai-stage-nav__number">{index + 1}</span><span>{label}</span>
              </li>
            ))}
          </ol>
        )}

        <div className={`ai-wizard-body${isCapturing ? ' ai-wizard-body--capture' : ''}`}>
          {confirmDiscard && (
            <div className="ai-discard-banner" role="alert">
              <div>
                <strong>Descartar capturas ainda não enviadas?</strong>
                <p>As fotos e o vídeo salvos apenas neste dispositivo serão perdidos. Arquivos já confirmados no servidor permanecem.</p>
              </div>
              <div className="ai-discard-banner__actions">
                <button type="button" className="ai-btn ai-btn--secondary" onClick={() => setConfirmDiscard(false)}>Continuar avaliação</button>
                <button type="button" className="ai-btn ai-btn--danger" onClick={() => { setConfirmDiscard(false); onClose?.(); }}>Descartar e sair</button>
              </div>
            </div>
          )}
          {showHistory && (
            <nav className="ai-history" aria-label="Histórico de avaliações por imagem">
              <div className="ai-history__heading">
                <strong>Registros deste paciente</strong>
                <span>{history.length > 4 ? 'Role para ver mais registros. ' : ''}Selecione uma data para consultar ou retomar.</span>
              </div>
              <div className="ai-history__list">
                {history.map((item) => (
                  <button key={item.id} type="button"
                    className={`ai-history__item${evaluationId === item.id ? ' ai-history__item--active' : ''}`}
                    aria-current={evaluationId === item.id ? 'true' : undefined}
                    disabled={evaluationId === item.id}
                    onClick={() => setRequestedRecordId(item.id)}>
                    <span>{historyDate(item)}</span><small>{historyStatus(item)}</small>
                  </button>
                ))}
              </div>
            </nav>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -10 }}
              transition={{ duration: reduceMotion ? 0 : 0.16 }}
              style={{ height: '100%' }}
            >
              {step === 'restoring' && <StatusPanel icon={Loader2} title="Consultando registros">Buscando avaliações por imagem deste paciente…</StatusPanel>}
              {step === 'restore_error' && <StatusPanel icon={AlertCircle} title="Não foi possível carregar" error
                action="Tentar novamente" onAction={() => setRestoreRevision((value) => value + 1)}>{submitError}</StatusPanel>}
              {step === 'readonly_empty' && <StatusPanel icon={Camera} title="Ainda sem registro">Nenhuma avaliação por imagem foi registrada neste caso.</StatusPanel>}
              {step === 'readonly_pending' && <StatusPanel icon={Clock} title="Resultado indisponível">Este registro ainda não tem estimativas para consulta. Você pode selecionar um resultado anterior no histórico.</StatusPanel>}
              {step === 'intro' && <StepIntro />}
              {step === 'consent' && <StepConsent form={form} onChange={handleFormChange} />}
              {step === 'camera' && <StepCamera permissionState={permissionState} onRequest={requestCamera} />}
              {step === 'capture' && (
                <StepCapture
                  videoRef={videoRef}
                  qualityRef={qualityRef}
                  currentView={currentView}
                  captures={captures}
                  onCapture={handleCapture}
                  onExitCapture={handleExitCapture}
                  onSwitchCamera={switchCamera}
                />
              )}
              {step === 'review' && (
                <StepReview
                  captures={captures}
                  onRecapture={handleRecapture}
                  error={submitError}
                />
              )}
              {step === 'video360' && (
                <StepVideo360
                  onRecorded={(blob) => setVideoBlob(blob)}
                  onDone={handleSubmit}
                  onExit={() => setStep('review')}
                />
              )}
              {step === 'uploading' && (
                <StepUploading progress={uploadProgress} fileProgress={uploadFileProgress} />
              )}
              {step === 'processing' && (
                <StepProcessing
                  processing={processing}
                  error={submitError}
                  onClose={handleClose}
                  onRetry={handleRetryProcessing}
                  retrying={retrying}
                  onNew={resetForNewEvaluation}
                />
              )}
              {step === 'results' && results && (
                <StepResults
                  results={results}
                  evaluationId={evaluationId}
                  onClose={handleClose}
                  onNew={resetForNewEvaluation}
                  readOnly={readOnly}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {showFooter && (
          <div className="ai-wizard-footer">
            {step === 'results' && (
              <>
                <button type="button" className="ai-btn ai-btn--secondary" onClick={handleClose}>
                  Fechar
                </button>
                <button
                  type="button"
                  className="ai-btn ai-btn--secondary ai-btn--icon"
                  onClick={() => window.print()}
                  title="Exportar / Imprimir"
                >
                  <Printer size={15} />
                  Exportar
                </button>
                <button type="button" className="ai-btn ai-btn--primary" onClick={handleClose}>
                  <Check size={15} />
                  Concluir
                </button>
              </>
            )}
            {step === 'review' && (
              <>
                <button type="button" className="ai-btn ai-btn--secondary" onClick={resetForNewEvaluation}>
                  <ChevronLeft size={15} />
                  Nova avaliação
                </button>
                <button
                  type="button"
                  className="ai-btn ai-btn--primary"
                  onClick={() => (videoBlob || confirmedViews.includes('video_360')) ? handleSubmit() : setStep('video360')}
                  disabled={!allCaptured}
                >
                  <Video size={15} />
                  {(videoBlob || confirmedViews.includes('video_360')) ? 'Retomar envio' : 'Gravar vídeo 360°'}
                </button>
              </>
            )}
            {['intro', 'consent', 'camera'].includes(step) && (
              <>
                <button type="button" className="ai-btn ai-btn--secondary" onClick={handleClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ai-btn ai-btn--primary"
                  onClick={goNext}
                  disabled={!canNext}
                >
                  {step === 'camera' ? 'Iniciar captura' : 'Continuar'}
                  <ChevronRight size={15} />
                </button>
              </>
            )}
          </div>
        )}
      </AvaliacaoModulo>
    </div>
  );
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}

export default AvaliacaoImagem;
