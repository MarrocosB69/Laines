import React, { useCallback, useEffect, useId, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import './AthleteOnboardingWizard.css';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const STEPS = [
  { id: 'pessoal',   label: 'Dados pessoais' },
  { id: 'esportivo', label: 'Contexto esportivo' },
  { id: 'saude',     label: 'Histórico clínico' },
  { id: 'estilo',    label: 'Estilo de vida' },
];

const GOAL_OPTIONS = [
  { value: 'performance',   label: 'Performance' },
  { value: 'hipertrofia',   label: 'Hipertrofia' },
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'saude_geral',   label: 'Saúde geral' },
  { value: 'reabilitacao',  label: 'Reabilitação' },
];

const PATHOLOGY_OPTIONS = [
  'Diabetes', 'Hipertensão', 'Dislipidemia', 'Doença renal',
  'Doença hepática', 'Hipotireoidismo', 'Hipertireoidismo',
  'Síndrome dos ovários policísticos', 'Doença cardiovascular', 'Transtorno alimentar',
];

const FAMILY_OPTIONS = [
  { value: 'cardiovascular', label: 'Doença cardiovascular' },
  { value: 'diabetes',       label: 'Diabetes' },
  { value: 'cancer',         label: 'Câncer' },
  { value: 'obesidade',      label: 'Obesidade' },
];

const SPORT_MODALITIES = [
  { value: '',            label: 'Selecione' },
  { value: 'futebol',    label: 'Futebol' },
  { value: 'futsal',     label: 'Futsal' },
  { value: 'natacao',    label: 'Natação' },
  { value: 'musculacao', label: 'Musculação' },
  { value: 'corrida',    label: 'Corrida' },
  { value: 'ciclismo',   label: 'Ciclismo' },
  { value: 'volei',      label: 'Vôlei' },
  { value: 'basquete',   label: 'Basquete' },
  { value: 'handebol',   label: 'Handebol' },
  { value: 'tenis',      label: 'Tênis' },
  { value: 'luta',       label: 'Luta / Combate' },
  { value: 'atletismo',  label: 'Atletismo' },
  { value: 'remo',       label: 'Remo' },
  { value: 'triatlo',    label: 'Triatlo' },
  { value: 'outro',      label: 'Outro' },
];

// type 'select' → single-choice position dropdown
// type 'checkboxes' → multi-select events (athletics, swimming)
// no entry → free text
const SPORT_CONTEXT_CONFIG = {
  futebol:  { type: 'select',    label: 'Posição',         options: ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante'] },
  futsal:   { type: 'select',    label: 'Posição',         options: ['Goleiro', 'Fixo', 'Ala', 'Pivô'] },
  volei:    { type: 'select',    label: 'Posição',         options: ['Ponteiro', 'Central', 'Oposto', 'Levantador', 'Líbero'] },
  basquete: { type: 'select',    label: 'Posição',         options: ['Armador', 'Ala-armador', 'Ala', 'Ala-pivô', 'Pivô'] },
  handebol: { type: 'select',    label: 'Posição',         options: ['Goleiro', 'Pivô', 'Ponta', 'Meia', 'Armador'] },
  tenis:    { type: 'select',    label: 'Estilo de jogo',  options: ['Baseline', 'Saque e voleio', 'Versátil'] },
  remo:     { type: 'select',    label: 'Especialidade',   options: ['Skiff', 'Dupla', 'Par', 'Quatro', 'Oito'] },
  luta:     { type: 'select',    label: 'Modalidade',      options: ['Judô', 'Jiu-jitsu', 'Muay thai', 'Boxe', 'Wrestling', 'MMA', 'Outra'] },
  natacao: {
    type: 'checkboxes', label: 'Provas',
    options: ['50m livre', '100m livre', '200m livre', '400m livre', '800m livre', '1500m livre',
              '100m costas', '200m costas', '100m peito', '200m peito',
              '100m borboleta', '200m borboleta', '200m medley', '400m medley'],
  },
  atletismo: {
    type: 'checkboxes', label: 'Provas',
    options: ['100m', '200m', '400m', '800m', '1500m', '5000m', '10000m',
              'Meia maratona', 'Maratona', 'Salto em altura', 'Salto com vara',
              'Salto em distância', 'Triplo salto', 'Lançamento / Arremesso', 'Decatlo / Heptatlo'],
  },
};

// UX-07 / CLI cadastro (UPD-18): o cadastro do paciente (inscrição pública
// ou cadastro feito pela equipe) pode já conter telefone, cidade, estado,
// data de nascimento e rotina de treino — ver src/views/public/
// InscricaoPublica.jsx e server/src/pacientes/athlete-cadastro.utils.ts
// (buildCadastroAtletaConsolidado). Sem isso, o atleta reescrevia tudo do
// zero aqui. `origemCadastro` identifica de onde veio o dado; `createdAt`
// do paciente é usado como "quando foi registrado". Nunca prefiltra o
// campo "Sexo biológico": o cadastro não expõe `sexoBiologico` ao atleta
// (só `genero`, que também carrega identidade de gênero em outros fluxos),
// e esse campo alimenta cálculo clínico — melhor deixar em branco do que
// arriscar um valor com semântica ambígua.
const CADASTRO_ORIGEM_LABELS = {
  inscricao_publica: 'inscrição pública',
  equipe: 'cadastro feito pela equipe',
  atleta: 'seu cadastro anterior',
  desconhecida: 'seu cadastro'
};

const formatDatePtBr = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('pt-BR');
};

const toDateInputValue = (value) => {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
};

const STEP1_PREFILL_KEYS = ['dataNascimento', 'telefone', 'cidade', 'estado'];
const STEP2_PREFILL_KEYS = ['frequenciaSemanal', 'duracaoSessao', 'modalidade'];
const hasPrefillFor = (fields, keys) => keys.some((key) => fields[key]);

/* ─── Factory helpers ────────────────────────────────────────────────────── */

let _seq = 0;
const genId = () => `${Date.now()}-${_seq++}`;
const createMed       = () => ({ id: genId(), nome: '', dose: '', frequencia: '' });
const createSup       = () => ({ id: genId(), nome: '', dose: '', frequencia: '' });
const createLesao     = () => ({ id: genId(), local: '', tempoAfastado: '' });
const createCompeticao = () => ({ id: genId(), nome: '', data: '' });

const defaultData = () => ({
  // Step 1 — Pessoal
  dataNascimento: '', genero: '', identidadeGenero: '',
  telefone: '', cidade: '', estado: '',
  // Step 2 — Esportivo
  modalidade: '', posicao: '', provas: [], nivel: '', clube: '',
  frequenciaSemanal: '', duracaoSessao: '',
  cargaTotal: '',
  cargaSemanal: { tecnico: '', tatico: '', fisico: '', preventivo: '' },
  fasePeriodizacao: '',
  temLesoes: false,
  historicoLesoes: [createLesao()],
  temCompeticoes: false,
  proximasCompeticoes: [createCompeticao()],
  historicaREDS: false,
  // Step 3 — Saúde
  objetivos: [], queixaPrincipal: '',
  patologias: [],
  usaMed: false,
  medicamentos: [createMed()],
  usaSuple: false,
  suplementos: [createSup()],
  alergias: '', cirurgias: '',
  // Step 4 — Estilo
  sonoHoras: '', sonoQualidade: '3', estresseNivel: '5',
  alcoolUso: 'nao_informado', tabacoUso: 'nao_informado',
  cicloMenstrualRegularidade: 'nao_informado',
  cicloMenstrualContraceptivo: 'nao_informado',
  comorbidadesFamiliares: [],
});

/* ─── Micro-components ───────────────────────────────────────────────────── */

const Field = ({ label, children, full = false, required = false }) => (
  <label className={`athlete-wizard-field${full ? ' athlete-wizard-field-full' : ''}`}>
    <span>{label}{required ? ' *' : ''}</span>
    {children}
  </label>
);

const Sel = ({ name, value, onChange, options }) => (
  <select name={name} value={value} onChange={onChange}>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const SectionTitle = ({ children }) => (
  <p className="athlete-wizard-section-title athlete-wizard-field-full">{children}</p>
);

const CheckboxGrid = ({ options, selected, onToggle }) => (
  <div className="athlete-wizard-checkbox-grid athlete-wizard-field-full">
    {options.map((opt) => {
      const val = typeof opt === 'string' ? opt : opt.value;
      const lbl = typeof opt === 'string' ? opt : opt.label;
      return (
        <label key={val} className="athlete-wizard-checkbox">
          <input type="checkbox" checked={selected.includes(val)} onChange={() => onToggle(val)} />
          <span>{lbl}</span>
        </label>
      );
    })}
  </div>
);

// Grupo de opções marcáveis: o título visível vira o nome do grupo
// (role="group" + aria-labelledby); a marcação em volta é a de antes.
const CheckboxGroup = ({ label, children }) => {
  const labelId = useId();
  return (
    <div className="athlete-wizard-field-full" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="athlete-wizard-field-label">{label}</p>
      {children}
    </div>
  );
};

const ToggleRow = ({ label, checked, onChange }) => (
  <label className="athlete-wizard-checkbox athlete-wizard-field-full" style={{ marginBottom: '0.3rem' }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

// Avisa de onde vieram os campos pré-preenchidos e quando o cadastro de
// origem foi registrado, sem esconder que a pessoa pode corrigir qualquer
// valor — nunca trava o campo, só explica.
const PrefillNote = ({ origemLabel, registradoEm }) => (
  <p className="athlete-wizard-mandatory-note athlete-wizard-field-full">
    Alguns campos já vieram do seu cadastro{origemLabel ? ` (via ${origemLabel})` : ''}
    {registradoEm ? `, registrado em ${registradoEm}` : ''}. Confira e corrija se necessário.
  </p>
);

/* ─── Step components ────────────────────────────────────────────────────── */

const StepPessoal = ({ data, onChange, prefillFields, prefillMeta }) => (
  <div className="athlete-wizard-grid">
    {hasPrefillFor(prefillFields, STEP1_PREFILL_KEYS) && (
      <PrefillNote origemLabel={prefillMeta.origemLabel} registradoEm={prefillMeta.registradoEm} />
    )}
    <Field label="Data de nascimento">
      <input type="date" name="dataNascimento" value={data.dataNascimento} onChange={onChange} />
    </Field>
    <Field label="Sexo biológico" required>
      <Sel name="genero" value={data.genero} onChange={onChange} options={[
        { value: '', label: 'Selecione' },
        { value: 'masculino', label: 'Masculino' },
        { value: 'feminino',  label: 'Feminino' },
      ]} />
    </Field>
    <Field label="Identidade de gênero" full>
      <input name="identidadeGenero" value={data.identidadeGenero} onChange={onChange} placeholder="Ex: cisgênero, não-binário…" />
    </Field>
    <Field label="Telefone">
      <input type="tel" name="telefone" value={data.telefone} onChange={onChange} placeholder="(84) 99999-9999" />
    </Field>
    <Field label="Cidade">
      <input name="cidade" value={data.cidade} onChange={onChange} />
    </Field>
    <Field label="Estado (UF)">
      <input name="estado" value={data.estado} onChange={onChange} placeholder="RN" />
    </Field>
  </div>
);

const StepEsportivo = ({ data, onChange, onCarga, onLesao, onCompeticao, onProva, prefillFields, prefillMeta }) => {
  const isElite = ['elite', 'federado'].includes(data.nivel);
  const sportCfg = SPORT_CONTEXT_CONFIG[data.modalidade];

  return (
    <div className="athlete-wizard-grid">
      {hasPrefillFor(prefillFields, STEP2_PREFILL_KEYS) && (
        <PrefillNote origemLabel={prefillMeta.origemLabel} registradoEm={prefillMeta.registradoEm} />
      )}
      <Field label="Modalidade principal">
        <Sel name="modalidade" value={data.modalidade} onChange={onChange} options={SPORT_MODALITIES} />
      </Field>

      {sportCfg?.type === 'select' && (
        <Field label={sportCfg.label}>
          <Sel name="posicao" value={data.posicao} onChange={onChange} options={[
            { value: '', label: 'Selecione' },
            ...sportCfg.options.map((o) => ({ value: o.toLowerCase().replace(/[\s/]+/g, '_'), label: o })),
          ]} />
        </Field>
      )}
      {sportCfg?.type === 'checkboxes' && (
        <CheckboxGroup label={sportCfg.label}>
          <CheckboxGrid options={sportCfg.options} selected={data.provas} onToggle={onProva} />
        </CheckboxGroup>
      )}
      {!sportCfg && data.modalidade && (
        <Field label="Posição / especialidade">
          <input name="posicao" value={data.posicao} onChange={onChange} placeholder="Ex: fundo, sprinter, meia…" />
        </Field>
      )}

      <Field label="Nível competitivo">
        <Sel name="nivel" value={data.nivel} onChange={onChange} options={[
          { value: '',         label: 'Selecione' },
          { value: 'amador',   label: 'Amador' },
          { value: 'semi-pro', label: 'Semi-profissional' },
          { value: 'elite',    label: 'Elite' },
          { value: 'federado', label: 'Federado' },
        ]} />
      </Field>
      <Field label="Clube / equipe">
        <input name="clube" value={data.clube} onChange={onChange} />
      </Field>
      <Field label="Sessões por semana">
        <input type="number" name="frequenciaSemanal" value={data.frequenciaSemanal} onChange={onChange} placeholder="5" />
      </Field>
      <Field label="Duração da sessão (min)">
        <input type="number" name="duracaoSessao" value={data.duracaoSessao} onChange={onChange} placeholder="90" />
      </Field>
      <Field label="Fase de periodização">
        <Sel name="fasePeriodizacao" value={data.fasePeriodizacao} onChange={onChange} options={[
          { value: '',              label: 'Selecione' },
          { value: 'pre-temporada', label: 'Pré-temporada' },
          { value: 'temporada',     label: 'Temporada' },
          { value: 'off-season',    label: 'Off-season' },
        ]} />
      </Field>
      <div />

      {isElite ? (
        <>
          <SectionTitle>Carga semanal (horas)</SectionTitle>
          {[
            { k: 'tecnico',    label: 'Técnico' },
            { k: 'tatico',     label: 'Tático' },
            { k: 'fisico',     label: 'Físico' },
            { k: 'preventivo', label: 'Preventivo' },
          ].map(({ k, label }) => (
            <Field key={k} label={label}>
              <input type="number" value={data.cargaSemanal[k]} onChange={(e) => onCarga(k, e.target.value)} placeholder="h/sem" />
            </Field>
          ))}
        </>
      ) : (
        <Field label="Horas de treino por semana" full>
          <input type="number" name="cargaTotal" value={data.cargaTotal} onChange={onChange} placeholder="Ex: 10" />
        </Field>
      )}

      <ToggleRow
        label="Tive lesões esportivas relevantes"
        checked={data.temLesoes}
        onChange={(v) => onChange({ target: { name: 'temLesoes', value: v } })}
      />
      {data.temLesoes && (
        <>
          {data.historicoLesoes.map((item, i) => (
            <div key={item.id} className="athlete-wizard-list-row athlete-wizard-field-full">
              <input className="athlete-wizard-list-input" value={item.local} placeholder="Local da lesão" onChange={(e) => onLesao(item.id, 'local', e.target.value)} />
              <input className="athlete-wizard-list-input" value={item.tempoAfastado} placeholder="Tempo afastado" onChange={(e) => onLesao(item.id, 'tempoAfastado', e.target.value)} />
              {i > 0 && <button type="button" className="athlete-wizard-icon-btn" aria-label="Remover lesão" onClick={() => onLesao(item.id, '__remove', '')}><Trash2 size={13} /></button>}
            </div>
          ))}
          <button type="button" className="athlete-wizard-add-btn athlete-wizard-field-full" onClick={() => onLesao(null, '__add', '')}>
            <Plus size={13} /> Adicionar lesão
          </button>
        </>
      )}

      <ToggleRow
        label="Tenho competições nos próximos 3 meses"
        checked={data.temCompeticoes}
        onChange={(v) => onChange({ target: { name: 'temCompeticoes', value: v } })}
      />
      {data.temCompeticoes && (
        <>
          {data.proximasCompeticoes.map((item, i) => (
            <div key={item.id} className="athlete-wizard-list-row athlete-wizard-field-full">
              <input className="athlete-wizard-list-input" value={item.nome} placeholder="Nome da competição" onChange={(e) => onCompeticao(item.id, 'nome', e.target.value)} />
              <input className="athlete-wizard-list-input" type="date" aria-label="Data da competição" value={item.data} onChange={(e) => onCompeticao(item.id, 'data', e.target.value)} />
              {i > 0 && <button type="button" className="athlete-wizard-icon-btn" aria-label="Remover competição" onClick={() => onCompeticao(item.id, '__remove', '')}><Trash2 size={13} /></button>}
            </div>
          ))}
          <button type="button" className="athlete-wizard-add-btn athlete-wizard-field-full" onClick={() => onCompeticao(null, '__add', '')}>
            <Plus size={13} /> Adicionar competição
          </button>
        </>
      )}

      {data.genero === 'feminino' && (
        <label className="athlete-wizard-checkbox athlete-wizard-field-full" style={{ marginTop: '0.5rem' }}>
          <input type="checkbox" checked={data.historicaREDS} onChange={(e) => onChange({ target: { name: 'historicaREDS', value: e.target.checked } })} />
          <span>Histórico prévio sugestivo de baixa disponibilidade energética</span>
        </label>
      )}
    </div>
  );
};

const StepSaude = ({ data, onChange, onToggle, onMed, onSup }) => (
  <div className="athlete-wizard-grid">
    <CheckboxGroup label="Objetivos principais">
      <CheckboxGrid options={GOAL_OPTIONS} selected={data.objetivos} onToggle={(v) => onToggle('objetivos', v)} />
    </CheckboxGroup>
    <Field label="Queixa principal / motivo da consulta" full>
      <textarea name="queixaPrincipal" value={data.queixaPrincipal} onChange={onChange} rows={3} placeholder="Ex: emagrecimento com performance, dores musculares recorrentes…" />
    </Field>
    <CheckboxGroup label="Diagnósticos / patologias">
      <CheckboxGrid options={PATHOLOGY_OPTIONS} selected={data.patologias} onToggle={(v) => onToggle('patologias', v)} />
    </CheckboxGroup>

    <ToggleRow
      label="Uso medicamentos regularmente"
      checked={data.usaMed}
      onChange={(v) => onChange({ target: { name: 'usaMed', value: v } })}
    />
    {data.usaMed && (
      <>
        {data.medicamentos.map((med, i) => (
          <div key={med.id} className="athlete-wizard-med-row athlete-wizard-field-full">
            <input className="athlete-wizard-list-input" value={med.nome} placeholder="Nome" onChange={(e) => onMed(med.id, 'nome', e.target.value)} />
            <input className="athlete-wizard-list-input" value={med.dose} placeholder="Dose" onChange={(e) => onMed(med.id, 'dose', e.target.value)} />
            <input className="athlete-wizard-list-input" value={med.frequencia} placeholder="Frequência" onChange={(e) => onMed(med.id, 'frequencia', e.target.value)} />
            {i > 0 && <button type="button" className="athlete-wizard-icon-btn" aria-label="Remover medicamento" onClick={() => onMed(med.id, '__remove', '')}><Trash2 size={13} /></button>}
          </div>
        ))}
        <button type="button" className="athlete-wizard-add-btn athlete-wizard-field-full" onClick={() => onMed(null, '__add', '')}>
          <Plus size={13} /> Adicionar medicamento
        </button>
      </>
    )}

    <ToggleRow
      label="Uso suplementos esportivos ou nutricionais"
      checked={data.usaSuple}
      onChange={(v) => onChange({ target: { name: 'usaSuple', value: v } })}
    />
    {data.usaSuple && (
      <>
        {data.suplementos.map((sup, i) => (
          <div key={sup.id} className="athlete-wizard-med-row athlete-wizard-field-full">
            <input className="athlete-wizard-list-input" value={sup.nome} placeholder="Nome (ex: creatina, whey)" onChange={(e) => onSup(sup.id, 'nome', e.target.value)} />
            <input className="athlete-wizard-list-input" value={sup.dose} placeholder="Dose" onChange={(e) => onSup(sup.id, 'dose', e.target.value)} />
            <input className="athlete-wizard-list-input" value={sup.frequencia} placeholder="Frequência" onChange={(e) => onSup(sup.id, 'frequencia', e.target.value)} />
            {i > 0 && <button type="button" className="athlete-wizard-icon-btn" aria-label="Remover suplemento" onClick={() => onSup(sup.id, '__remove', '')}><Trash2 size={13} /></button>}
          </div>
        ))}
        <button type="button" className="athlete-wizard-add-btn athlete-wizard-field-full" onClick={() => onSup(null, '__add', '')}>
          <Plus size={13} /> Adicionar suplemento
        </button>
      </>
    )}

    <Field label="Alergias / intolerâncias" full>
      <textarea name="alergias" value={data.alergias} onChange={onChange} rows={2} placeholder="Glúten, lactose, amendoim…" />
    </Field>
    <Field label="Cirurgias / procedimentos relevantes" full>
      <textarea name="cirurgias" value={data.cirurgias} onChange={onChange} rows={2} />
    </Field>
  </div>
);

const StepEstilo = ({ data, onChange, onToggle }) => (
  <div className="athlete-wizard-grid">
    <Field label="Horas de sono por noite">
      <input type="number" name="sonoHoras" value={data.sonoHoras} onChange={onChange} placeholder="7" />
    </Field>
    <Field label="Qualidade do sono (1–5)">
      <Sel name="sonoQualidade" value={data.sonoQualidade} onChange={onChange} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} />
    </Field>
    <Field label="Nível de estresse (1–10)">
      <Sel name="estresseNivel" value={data.estresseNivel} onChange={onChange} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
    </Field>
    <div />
    <Field label="Álcool">
      <Sel name="alcoolUso" value={data.alcoolUso} onChange={onChange} options={[
        { value: 'nao_informado', label: 'Não informado' },
        { value: 'nao',          label: 'Não' },
        { value: 'eventual',     label: 'Eventual' },
        { value: 'frequente',    label: 'Frequente' },
        { value: 'alto',         label: 'Alto / diário' },
      ]} />
    </Field>
    <Field label="Tabaco">
      <Sel name="tabacoUso" value={data.tabacoUso} onChange={onChange} options={[
        { value: 'nao_informado', label: 'Não informado' },
        { value: 'nao',          label: 'Não' },
        { value: 'eventual',     label: 'Eventual' },
        { value: 'sim',          label: 'Sim' },
      ]} />
    </Field>

    {data.genero === 'feminino' && (
      <>
        <Field label="Ciclo menstrual">
          <Sel name="cicloMenstrualRegularidade" value={data.cicloMenstrualRegularidade} onChange={onChange} options={[
            { value: 'nao_informado', label: 'Não informado' },
            { value: 'regular',       label: 'Regular' },
            { value: 'irregular',     label: 'Irregular' },
          ]} />
        </Field>
        <Field label="Uso de contraceptivo">
          <Sel name="cicloMenstrualContraceptivo" value={data.cicloMenstrualContraceptivo} onChange={onChange} options={[
            { value: 'nao_informado', label: 'Não informado' },
            { value: 'nao',          label: 'Não' },
            { value: 'sim',          label: 'Sim' },
          ]} />
        </Field>
      </>
    )}

    <CheckboxGroup label="Histórico familiar">
      <CheckboxGrid options={FAMILY_OPTIONS} selected={data.comorbidadesFamiliares} onToggle={(v) => onToggle('comorbidadesFamiliares', v)} />
    </CheckboxGroup>
  </div>
);

/* ─── Main component ─────────────────────────────────────────────────────── */

const AthleteOnboardingWizard = ({ pacienteId, patientName, onComplete, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState(defaultData);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [prefillFields, setPrefillFields] = useState({});
  const [prefillMeta, setPrefillMeta] = useState({ origemLabel: '', registradoEm: '' });

  // UX-07 / CLI cadastro: busca o cadastro já existente do paciente e
  // pré-preenche o que ele já tem — nunca sobrescreve o que a pessoa já
  // digitou nesta sessão, e nunca bloqueia o preenchimento se a busca
  // falhar ou vier vazia (mesma degradação silenciosa de sempre).
  useEffect(() => {
    if (!pacienteId) return undefined;
    let active = true;

    (async () => {
      try {
        const { data: paciente } = await api.get(`/pacientes/${pacienteId}`);
        if (!active || !paciente) return;

        const base = paciente.cadastroAtleta?.dadosBase || {};
        const candidates = {
          dataNascimento: toDateInputValue(paciente.dataNascimento),
          telefone: typeof base.telefone === 'string' ? base.telefone : '',
          cidade: typeof base.cidade === 'string' ? base.cidade : '',
          estado: typeof base.estado === 'string' ? base.estado : '',
          frequenciaSemanal: paciente.frequenciaSemanal != null ? String(paciente.frequenciaSemanal) : '',
          duracaoSessao: paciente.duracaoSessao != null ? String(paciente.duracaoSessao) : ''
        };
        const modalidadeLabel = String(paciente.modalidadePrincipal || '').trim().toLowerCase();
        const matchedModalidade = SPORT_MODALITIES.find(
          (option) => option.value && option.label.toLowerCase() === modalidadeLabel
        );
        if (matchedModalidade) candidates.modalidade = matchedModalidade.value;

        const prefilled = {};
        setData((prev) => {
          const next = { ...prev };
          Object.entries(candidates).forEach(([key, value]) => {
            if (!value) return;
            const current = prev[key];
            const isUntouched = current === '' || current === undefined || current === null;
            if (!isUntouched) return;
            next[key] = value;
            prefilled[key] = true;
          });
          return next;
        });

        if (active && Object.keys(prefilled).length > 0) {
          setPrefillFields(prefilled);
          const origemKey = paciente.cadastroAtleta?.origemCadastro || 'desconhecida';
          setPrefillMeta({
            origemLabel: CADASTRO_ORIGEM_LABELS[origemKey] || CADASTRO_ORIGEM_LABELS.desconhecida,
            registradoEm: formatDatePtBr(paciente.createdAt)
          });
        }
      } catch {
        // Sem cadastro previo legivel: segue com os campos em branco, sem
        // bloquear o preenchimento manual.
      }
    })();

    return () => { active = false; };
  }, [pacienteId]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleToggle = useCallback((key, value) => {
    setData((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      return { ...prev, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  }, []);

  const handleProva = useCallback((value) => {
    setData((prev) => {
      const list = Array.isArray(prev.provas) ? prev.provas : [];
      return { ...prev, provas: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  }, []);

  const handleCarga = useCallback((key, value) => {
    setData((prev) => ({ ...prev, cargaSemanal: { ...prev.cargaSemanal, [key]: value } }));
  }, []);

  const handleLesao = useCallback((id, field, value) => {
    setData((prev) => {
      if (field === '__add') return { ...prev, historicoLesoes: [...prev.historicoLesoes, createLesao()] };
      if (field === '__remove') return { ...prev, historicoLesoes: prev.historicoLesoes.filter((l) => l.id !== id) };
      return { ...prev, historicoLesoes: prev.historicoLesoes.map((l) => l.id === id ? { ...l, [field]: value } : l) };
    });
  }, []);

  const handleCompeticao = useCallback((id, field, value) => {
    setData((prev) => {
      if (field === '__add') return { ...prev, proximasCompeticoes: [...prev.proximasCompeticoes, createCompeticao()] };
      if (field === '__remove') return { ...prev, proximasCompeticoes: prev.proximasCompeticoes.filter((c) => c.id !== id) };
      return { ...prev, proximasCompeticoes: prev.proximasCompeticoes.map((c) => c.id === id ? { ...c, [field]: value } : c) };
    });
  }, []);

  const handleMed = useCallback((id, field, value) => {
    setData((prev) => {
      if (field === '__add') return { ...prev, medicamentos: [...prev.medicamentos, createMed()] };
      if (field === '__remove') return { ...prev, medicamentos: prev.medicamentos.filter((m) => m.id !== id) };
      return { ...prev, medicamentos: prev.medicamentos.map((m) => m.id === id ? { ...m, [field]: value } : m) };
    });
  }, []);

  const handleSup = useCallback((id, field, value) => {
    setData((prev) => {
      if (field === '__add') return { ...prev, suplementos: [...prev.suplementos, createSup()] };
      if (field === '__remove') return { ...prev, suplementos: prev.suplementos.filter((s) => s.id !== id) };
      return { ...prev, suplementos: prev.suplementos.map((s) => s.id === id ? { ...s, [field]: value } : s) };
    });
  }, []);

  const validate = () => {
    if (stepIndex === 0 && !data.genero) {
      setError('Informe o sexo biológico para continuar — necessário para triagem clínica.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = async () => {
    if (!validate()) return;

    if (stepIndex < STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (!pacienteId) {
        throw new Error('Paciente nao informado para completar o cadastro clinico.');
      }
      const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
      const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      const isElite = ['elite', 'federado'].includes(data.nivel);
      const sportCfg = SPORT_CONTEXT_CONFIG[data.modalidade];

      const payload = {
        dataNascimento: str(data.dataNascimento),
        genero: str(data.genero),
        // O campo acima e rotulado "Sexo biologico" na tela e e o que alimenta
        // formula clinica. Enviar so `genero` deixava `sexoBiologico` vazio no
        // cadastro, e a referencia nutricional (DRI por sexo e faixa etaria)
        // respondia "sexo biologico nao informado" para quem acabara de informar.
        // Identidade de genero continua em campo proprio, com outro significado.
        sexoBiologico: str(data.genero),
        identidadeGenero: str(data.identidadeGenero),
        telefone: str(data.telefone),
        cidade: str(data.cidade),
        estado: str(data.estado),
        objetivos: data.objetivos.length ? data.objetivos : undefined,
        queixaPrincipal: str(data.queixaPrincipal),
        patologias: data.patologias.length ? data.patologias : undefined,
        medicamentos: data.usaMed
          ? data.medicamentos
              .filter((m) => m.nome.trim())
              .map((m) => ({ nome: m.nome.trim(), dose: str(m.dose), frequencia: str(m.frequencia) }))
          : undefined,
        suplementos: data.usaSuple
          ? data.suplementos
              .filter((s) => s.nome.trim())
              .map((s) => ({ nome: s.nome.trim(), dose: str(s.dose), frequencia: str(s.frequencia) }))
          : undefined,
        alergias: str(data.alergias),
        cirurgias: str(data.cirurgias),
        sonoHoras: num(data.sonoHoras),
        sonoQualidade: num(data.sonoQualidade),
        estresseNivel: num(data.estresseNivel),
        alcoolUso: data.alcoolUso !== 'nao_informado' ? data.alcoolUso : undefined,
        tabacoUso: data.tabacoUso !== 'nao_informado' ? data.tabacoUso : undefined,
        cicloMenstrualRegularidade: data.genero === 'feminino' && data.cicloMenstrualRegularidade !== 'nao_informado'
          ? data.cicloMenstrualRegularidade : undefined,
        cicloMenstrualContraceptivo: data.genero === 'feminino' && data.cicloMenstrualContraceptivo !== 'nao_informado'
          ? data.cicloMenstrualContraceptivo : undefined,
        comorbidadesFamiliares: data.comorbidadesFamiliares.length ? data.comorbidadesFamiliares : undefined,
        esportivo: {
          modalidade: str(data.modalidade),
          posicao: sportCfg?.type === 'checkboxes' ? undefined : str(data.posicao),
          provas: sportCfg?.type === 'checkboxes' && data.provas.length ? data.provas : undefined,
          nivel: str(data.nivel),
          clube: str(data.clube),
          frequenciaSemanal: num(data.frequenciaSemanal),
          duracaoSessao: num(data.duracaoSessao),
          cargaSemanal: isElite
            ? {
                tecnico:    num(data.cargaSemanal.tecnico),
                tatico:     num(data.cargaSemanal.tatico),
                fisico:     num(data.cargaSemanal.fisico),
                preventivo: num(data.cargaSemanal.preventivo),
              }
            : { fisico: num(data.cargaTotal) },
          fasePeriodizacao: str(data.fasePeriodizacao),
          historicoLesoes: data.temLesoes
            ? data.historicoLesoes
                .filter((l) => l.local.trim())
                .map((l) => ({ local: l.local.trim(), tempoAfastado: str(l.tempoAfastado) }))
            : undefined,
          proximasCompeticoes: data.temCompeticoes
            ? data.proximasCompeticoes
                .filter((c) => c.nome.trim())
                .map((c) => ({ nome: c.nome.trim(), data: str(c.data) }))
            : undefined,
          historicaREDS: data.genero === 'feminino' ? (data.historicaREDS || undefined) : undefined,
        },
      };

      await api.patch(`/pacientes/${pacienteId}/onboarding`, payload);
      onComplete?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar. Verifique sua conexão e tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setError('');
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleClose = () => {
    if (saving || typeof onClose !== 'function') return;
    onClose();
  };

  const stepProps = {
    data,
    onChange: handleChange,
    onToggle: handleToggle,
    onCarga: handleCarga,
    onLesao: handleLesao,
    onCompeticao: handleCompeticao,
    onMed: handleMed,
    onSup: handleSup,
    onProva: handleProva,
    prefillFields,
    prefillMeta,
  };

  const currentStep = stepIndex + 1;
  const firstName = patientName ? patientName.trim().split(/\s+/)[0] : '';

  return (
    <div className="athlete-wizard-overlay" role="presentation">
      <section
        className="athlete-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="athlete-wizard-title"
      >
        <header className="athlete-wizard-header">
          <div>
            <p>Cadastro clínico — LAINES</p>
            <h2 id="athlete-wizard-title">
              {firstName ? `Bem-vindo, ${firstName}!` : 'Complete seu perfil'}
            </h2>
          </div>
          {typeof onClose === 'function' && (
            <button
              type="button"
              className="athlete-wizard-close"
              onClick={handleClose}
              disabled={saving}
              aria-label="Fechar cadastro clinico"
              title="Fechar"
            >
              <X size={17} />
            </button>
          )}
        </header>

        <div className="athlete-wizard-progress" aria-label={`Passo ${currentStep} de ${STEPS.length}`}>
          <div className="athlete-wizard-progress-label">
            <strong>Passo {currentStep} de {STEPS.length}</strong>
            <span>{STEPS[stepIndex].label}</span>
          </div>
          <div className="athlete-wizard-progress-track">
            <div className={`athlete-wizard-progress-fill athlete-wizard-progress-fill-step-${currentStep}`} />
          </div>
          <div className="athlete-wizard-dots" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={[
                  'athlete-wizard-dot',
                  i === stepIndex ? 'is-active' : '',
                  i < stepIndex ? 'is-complete' : ''
                ].filter(Boolean).join(' ')}
              />
            ))}
          </div>
        </div>

        <form className="athlete-wizard-form" onSubmit={(e) => e.preventDefault()}>
          {stepIndex === 0 && <StepPessoal {...stepProps} />}
          {stepIndex === 1 && <StepEsportivo {...stepProps} />}
          {stepIndex === 2 && <StepSaude {...stepProps} />}
          {stepIndex === 3 && <StepEstilo {...stepProps} />}

          {error && <p className="athlete-wizard-error" role="alert">{error}</p>}

          <footer className="athlete-wizard-actions">
            <span className="athlete-wizard-mandatory-note">
              Preenchimento necessário para liberar o sistema
            </span>
            <div className="athlete-wizard-actions-main">
              {stepIndex > 0 && (
                <button
                  type="button"
                  className="athlete-wizard-button athlete-wizard-button-secondary"
                  onClick={handleBack}
                  disabled={saving}
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                className="athlete-wizard-button athlete-wizard-button-primary"
                onClick={handleNext}
                disabled={saving}
              >
                {saving ? 'Salvando…' : stepIndex === STEPS.length - 1 ? 'Concluir e entrar' : 'Continuar'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default AthleteOnboardingWizard;
