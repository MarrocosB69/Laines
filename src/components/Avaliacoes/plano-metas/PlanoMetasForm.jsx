import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Target, Save, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  Campo,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../base';
import './PlanoMetasForm.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));

const normalizeDateValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : toLocalDateInputValue(d);
};

const resolveTimestamp = (value) => (value ? new Date(value).getTime() : 0);

// ── ScaleInput component ──────────────────────────────────────────────────────

function ScaleInput({ value, onChange, min = 0, max = 10, label, readOnly, color = 'accent' }) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const num = Number(value);
  return (
    <div className="pm-scale">
      <div className="pm-scale__labels">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <div className="pm-scale__steps">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            disabled={readOnly}
            className={`pm-scale__step pm-scale__step--${color}${num === step ? ' pm-scale__step--active' : ''}`}
            onClick={() => !readOnly && onChange(step)}
            aria-label={`${label}: ${step}`}
            aria-pressed={num === step}
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── TextArea component ────────────────────────────────────────────────────────

// Mesma assinatura, com o Campo da base por dentro: o rótulo passa a ser
// ligado ao controle (antes o <label> ficava solto), a dica entra em
// aria-describedby e o "*" vira "obrigatório" escrito, com a mesma marca
// pm-field__required que o modo essencial procura.
function PmField({ label, hint, children, required }) {
  return (
    <Campo
      rotulo={label}
      ajuda={hint}
      obrigatorio={required}
      classeObrigatorio="pm-field__required"
      className="pm-field"
    >
      {children}
    </Campo>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function PlanoMetasHistorico({ history }) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => {
    if (!Array.isArray(history)) return [];
    return [...history]
      .sort((a, b) => resolveTimestamp(b?.updatedAt || b?.data) - resolveTimestamp(a?.updatedAt || a?.data))
      .slice(0, 5);
  }, [history]);

  if (items.length === 0) return null;

  return (
    <div className="pm-history">
      <button type="button" className="pm-history__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <History size={14} />
        <span>Histórico ({items.length})</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="pm-history__list">
          {items.map((item, idx) => {
            const d = item?.dados || {};
            const date = normalizeDateValue(item?.data || item?.updatedAt);
            const mot = d.motivacao != null ? `Motivação ${d.motivacao}/10` : null;
            const conf = d.grauConfianca != null ? `Confiança ${d.grauConfianca}/10` : null;
            const meta = d.oQueQueroMudar || d.mudancaDesejada || '';
            return (
              <div key={item?.id || idx} className="pm-history__item">
                <span className="pm-history__date">{date || '—'}</span>
                <span className="pm-history__meta">{meta || '—'}</span>
                <span className="pm-history__scores">
                  {[mot, conf].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  dataAvaliacao: '',
  versao: 'simples',
  // Simples
  oQueQueroMudar: '',
  motivacao: '',
  pros: '',
  contras: '',
  // Completo
  mudancaDesejada: '',
  motivosParaMudar: '',
  comoPlanejo: '',
  estrategias: '',
  planosParaDificuldades: '',
  comoOutrosPodemAjudar: '',
  comoMonitorar: '',
  grauConfianca: '',
  observacoes: ''
};

export default function PlanoMetasForm({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId,
  moduleHistory
}) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [error, setError] = useState('');
  const loadedSnapshotIdRef = useRef('');
  const saveStatusResetRef = useRef(null);

  // Load snapshot
  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;
    const d = moduleSnapshot?.dados || {};
    setForm({
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || d.dataAvaliacao),
      versao: d.versao || 'simples',
      oQueQueroMudar: d.oQueQueroMudar || '',
      motivacao: d.motivacao != null ? String(d.motivacao) : '',
      pros: d.pros || '',
      contras: d.contras || '',
      mudancaDesejada: d.mudancaDesejada || '',
      motivosParaMudar: d.motivosParaMudar || '',
      comoPlanejo: d.comoPlanejo || '',
      estrategias: d.estrategias || '',
      planosParaDificuldades: d.planosParaDificuldades || '',
      comoOutrosPodemAjudar: d.comoOutrosPodemAjudar || '',
      comoMonitorar: d.comoMonitorar || '',
      grauConfianca: d.grauConfianca != null ? String(d.grauConfianca) : '',
      observacoes: d.observacoes || ''
    });
    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setVal = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const isCompleto = form.versao === 'completo';

  const payload = useMemo(() => ({
    tipo: 'plano_metas',
    pacienteId,
    data: form.dataAvaliacao || undefined,
    sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
    schemaVersion: 1,
    formulaId: 'plano_metas_motivacional_v1',
    formulaVersion: '1.0.0',
    dados: {
      dataAvaliacao: form.dataAvaliacao || undefined,
      versao: form.versao,
      oQueQueroMudar: form.oQueQueroMudar.trim() || undefined,
      motivacao: form.motivacao !== '' ? clamp(Number(form.motivacao), 0, 10) : undefined,
      pros: form.pros.trim() || undefined,
      contras: form.contras.trim() || undefined,
      ...(isCompleto ? {
        mudancaDesejada: form.mudancaDesejada.trim() || undefined,
        motivosParaMudar: form.motivosParaMudar.trim() || undefined,
        comoPlanejo: form.comoPlanejo.trim() || undefined,
        estrategias: form.estrategias.trim() || undefined,
        planosParaDificuldades: form.planosParaDificuldades.trim() || undefined,
        comoOutrosPodemAjudar: form.comoOutrosPodemAjudar.trim() || undefined,
        comoMonitorar: form.comoMonitorar.trim() || undefined,
        grauConfianca: form.grauConfianca !== '' ? clamp(Number(form.grauConfianca), 1, 10) : undefined,
      } : {}),
      observacoes: form.observacoes.trim() || undefined
    }
  }), [form, isCompleto, pacienteId, moduleSnapshot, currentSessionId]);

  const hasInput = useMemo(() => (
    form.oQueQueroMudar.trim().length > 0
    || form.motivacao !== ''
    || form.mudancaDesejada.trim().length > 0
  ), [form]);

  const validate = useCallback(() => {
    if (!form.oQueQueroMudar.trim()) return 'Informe o que deseja mudar para salvar.';
    if (form.motivacao === '') return 'Informe o grau de motivação (0-10).';
    return '';
  }, [form]);

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    if (!auto) {
      const err = validate();
      if (err) { setError(err); return; }
    }

    setError('');
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch(payload));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus('error');
      if (!auto) setError('Não foi possível salvar o plano de metas.');
    }
  }, [onAutoSave, onSalvar, payload, validate]);

  // Autosave
  useEffect(() => {
    if (readOnly || !onAutoSave || !hasInput) return undefined;
    const t = setTimeout(() => { void dispatchSalvar(true); }, 3000);
    return () => clearTimeout(t);
  }, [payload, readOnly, onAutoSave, hasInput, dispatchSalvar]);

  const textarea = (field, placeholder, rows = 3) => (
    <textarea
      className="pm-textarea"
      value={form[field]}
      onChange={set(field)}
      placeholder={readOnly ? '' : placeholder}
      rows={rows}
      readOnly={readOnly}
      disabled={readOnly}
    />
  );

  return (
    <AvaliacaoModulo
      className="pm-form"
      titulo="Plano de Metas"
      descricao="Planejamento motivacional e estratégias de mudança"
      icone={<Target size={22} />}
      acoes={!readOnly && (
        // aria-pressed: a versão ativa não fica dita só pela cor.
        <div className="pm-version-toggle">
          <button
            type="button"
            className={`pm-version-btn${!isCompleto ? ' pm-version-btn--active' : ''}`}
            onClick={() => setVal('versao')('simples')}
            aria-pressed={!isCompleto}
          >
            Simples
          </button>
          <button
            type="button"
            className={`pm-version-btn${isCompleto ? ' pm-version-btn--active' : ''}`}
            onClick={() => setVal('versao')('completo')}
            aria-pressed={isCompleto}
          >
            Completo
          </button>
        </div>
      )}
    >
      {/* ── Seção Simples ─────────────────────────────────────────────── */}
      <AvaliacaoSecao id="pm-exploracao" titulo="Exploração da mudança" className="pm-section">
        {/* A data, antes solta entre o cabeçalho e a seção, abre o primeiro bloco. */}
        <Campo rotulo="Data da avaliação" className="pm-date-row">
          <input
            type="date"
            className="pm-input"
            value={form.dataAvaliacao}
            onChange={set('dataAvaliacao')}
            readOnly={readOnly}
            disabled={readOnly}
            max={new Date().toISOString().slice(0, 10)}
          />
        </Campo>

        <PmField label="O que eu quero mudar?" required hint="Descreva com suas próprias palavras a mudança que deseja fazer.">
          {textarea('oQueQueroMudar', 'Ex: Quero melhorar minha alimentação antes dos treinos...')}
        </PmField>

        <PmField
          label="Grau de motivação para essa mudança"
          required
          hint="0 = nenhuma motivação · 10 = completamente motivado(a)"
        >
          <ScaleInput
            value={form.motivacao}
            onChange={(v) => setVal('motivacao')(String(v))}
            min={0}
            max={10}
            label="Motivação"
            readOnly={readOnly}
            color="accent"
          />
        </PmField>

        <div className="pm-grid-2">
          <PmField label="Prós de fazer essa mudança" hint="Razões positivas, benefícios esperados.">
            {textarea('pros', 'Ex: Mais energia, melhor rendimento nos treinos...')}
          </PmField>
          <PmField label="Contras ou dificuldades" hint="Obstáculos, custos ou desvantagens percebidos.">
            {textarea('contras', 'Ex: Tempo para preparar refeições, custo dos alimentos...')}
          </PmField>
        </div>
      </AvaliacaoSecao>

      {/* ── Seção Completa ────────────────────────────────────────────── */}
      {isCompleto && (
        <AvaliacaoSecao id="pm-planejamento" titulo="Planejamento detalhado" className="pm-section pm-section--complete">

          <PmField label="Que mudança específica quero fazer?" hint="Seja concreto: o quê, quando, quanto, onde.">
            {textarea('mudancaDesejada', 'Ex: A partir de segunda, vou comer uma refeição equilibrada 2h antes do treino, 5 dias por semana.')}
          </PmField>

          <PmField label="Por que isso é importante para mim?" hint="Valores e razões mais profundas por trás dessa mudança.">
            {textarea('motivosParaMudar', 'Ex: Quero ter mais energia para treinar e melhorar minha performance na competição de março.')}
          </PmField>

          <PmField label="Como planejo realizar essa mudança?" hint="Passos concretos e recursos necessários.">
            {textarea('comoPlanejo', 'Ex: Vou organizar minha alimentação no domingo para a semana inteira, separar recipientes...')}
          </PmField>

          <PmField label="Estratégias e instrumentos de apoio" hint="Ferramentas, pessoas ou hábitos que vão ajudar.">
            {textarea('estrategias', 'Ex: Usar o app de receitas, contar com o apoio da família, manter um diário alimentar...')}
          </PmField>

          <PmField label="Planos para momentos difíceis" hint="O que farei quando sentir vontade de desistir ou surgir um obstáculo?">
            {textarea('planosParaDificuldades', 'Ex: Quando estiver cansado, vou lembrar meu objetivo. Se falhar um dia, recomeço no próximo...')}
          </PmField>

          <PmField label="Como outras pessoas podem me ajudar?" hint="Apoio do entorno familiar, colegas, profissionais.">
            {textarea('comoOutrosPodemAjudar', 'Ex: Pedir para a família respeitar meus horários de refeição, avisar o técnico sobre minha meta...')}
          </PmField>

          <PmField label="Como vou monitorar meu progresso?" hint="Indicadores ou sinais de que a mudança está acontecendo.">
            {textarea('comoMonitorar', 'Ex: Vou anotar no diário alimentar, pesar semanalmente, observar meu desempenho nos treinos...')}
          </PmField>

          <PmField
            label="Grau de confiança para realizar essa mudança"
            hint="1 = pouco confiante · 10 = totalmente confiante"
          >
            <ScaleInput
              value={form.grauConfianca}
              onChange={(v) => setVal('grauConfianca')(String(v))}
              min={1}
              max={10}
              label="Confiança"
              readOnly={readOnly}
              color="green"
            />
          </PmField>
        </AvaliacaoSecao>
      )}

      {/* Observações: o rótulo visível é o título da seção. */}
      <AvaliacaoSecao id="pm-observacoes" titulo="Observações do profissional">
        <Campo rotulo="Observações do profissional" rotuloOculto className="pm-field">
          {textarea('observacoes', 'Registre anotações clínicas, contexto da sessão ou próximos passos...', 3)}
        </Campo>
      </AvaliacaoSecao>

      {/* Histórico */}
      <PlanoMetasHistorico history={moduleHistory} />

      {/* Actions. Os estados escritos são os de antes: "Salvo com sucesso."
          e "Erro ao salvar." (só quando não há mensagem de erro própria);
          durante o salvamento, o próprio botão diz "Salvando...". */}
      {!readOnly && (
        <>
          <BarraAcoesAvaliacao
            className="pm-actions"
            status={saveStatus === 'saved' || (saveStatus === 'error' && !error) ? saveStatus : null}
            textosStatus={{ saved: 'Salvo com sucesso.', error: 'Erro ao salvar.' }}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void dispatchSalvar(false)}
              disabled={saveStatus === 'saving'}
            >
              <Save size={16} />
              {saveStatus === 'saving' ? 'Salvando...' : 'Salvar rascunho'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                const err = validate();
                if (err) { setError(err); return; }
                if (onSalvar) await onSalvar({ ...payload }, true);
              }}
              disabled={saveStatus === 'saving'}
            >
              Finalizar
            </Button>
          </BarraAcoesAvaliacao>
          {error && <AvisoAvaliacao tipo="perigo" anunciar className="pm-error">{error}</AvisoAvaliacao>}
        </>
      )}
    </AvaliacaoModulo>
  );
}
