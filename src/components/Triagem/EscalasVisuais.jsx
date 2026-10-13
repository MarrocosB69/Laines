import React from 'react';
import './EscalasVisuais.css';

// Escalas visuais da triagem publica.
//
// Regra de conteudo, definida com a coordenacao:
//   1. nenhuma opcao exibe rotulo descritivo — o texto induz a resposta;
//   2. nenhuma tela devolve interpretacao clinica para quem responde.
// A leitura dos valores acontece apenas no prontuario, do lado da equipe.
//
// Direcao "Energia e velocidade" (docs/implementacao/inscricao-v2/): o
// estado selecionado nunca depende so de cor (borda azul + fundo) — um
// icone (check para presenca, traco para ausencia) acompanha, para quem
// nao distingue as duas bordas por cor.

function CheckIcon({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DashIcon({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
    </svg>
  );
}

// ── Chips de escolha ─────────────────────────────────────────────────────────

export function ChipGroup({
  options,
  value,
  onChange,
  multiple = false,
  exclusiveValues = [],
  ariaLabel
}) {
  const selected = multiple
    ? (Array.isArray(value) ? value : [])
    : (value === null || value === undefined ? [] : [value]);

  const handle = (optionValue) => {
    if (!multiple) {
      onChange(value === optionValue ? null : optionValue);
      return;
    }
    const isExclusive = exclusiveValues.includes(optionValue);
    const already = selected.includes(optionValue);

    if (isExclusive) {
      onChange(already ? [] : [optionValue]);
      return;
    }
    const withoutExclusives = selected.filter((item) => !exclusiveValues.includes(item));
    onChange(already
      ? withoutExclusives.filter((item) => item !== optionValue)
      : [...withoutExclusives, optionValue]);
  };

  const asEntry = (option) => (
    typeof option === 'string'
      ? { value: option, label: option }
      : { value: option.value, label: option.label }
  );

  const entries = options.map(asEntry);
  const regulares = entries.filter((item) => !exclusiveValues.includes(item.value));
  const saidas = entries.filter((item) => exclusiveValues.includes(item.value));

  const renderChip = (item, extraClass = '', neutral = false) => {
    const pressed = selected.includes(item.value);
    return (
      <button
        key={item.value}
        type="button"
        className={`ip-chip${extraClass}`}
        aria-pressed={pressed}
        onClick={() => handle(item.value)}
      >
        {pressed && (neutral
          ? <DashIcon className="ip-chip-icon ip-chip-icon--neutral" />
          : <CheckIcon className="ip-chip-icon" />)}
        <span>{item.label}</span>
      </button>
    );
  };

  // As opcoes de ausencia ("Nenhuma", "Nada disso") saem da parede de chips e
  // ganham linha propria: sem isso quem nao tem nada a marcar percorre a lista
  // inteira sem encontrar a saida, e o sistema nao distingue "nao tem" de
  // "nao respondeu".
  return (
    <div className="ip-chips-wrap" role="group" aria-label={ariaLabel}>
      <div className="ip-chips">
        {regulares.map((item) => renderChip(item))}
      </div>
      {saidas.length > 0 && (
        <div className="ip-chips ip-chips--escape">
          {saidas.map((item) => renderChip(item, ' ip-chip--neutral', true))}
        </div>
      )}
    </div>
  );
}

// ── Escala de Bristol ────────────────────────────────────────────────────────

// Descricao factual da forma, usada apenas no rotulo acessivel: sem ela o
// controle fica inutilizavel em leitor de tela. Nao contem interpretacao.
const BRISTOL_SHAPES = [
  'caroços duros separados',
  'formato de salsicha, irregular',
  'salsicha com rachaduras',
  'salsicha lisa e macia',
  'pedaços com bordas definidas',
  'pedaços esponjosos, pastosas',
  'aquoso, sem pedaços sólidos'
];

// Cor de ilustracao (nao e um token de design compartilhado: e a cor de
// preenchimento das figuras da escala de Bristol, sem equivalente --lt-*).
const BRISTOL_FILL = '#8c6239';

function BristolArt({ type }) {
  const fill = BRISTOL_FILL;
  const stroke = '#ffffff';
  return (
    <svg width="58" height="40" viewBox="0 0 58 40" aria-hidden="true" focusable="false">
      {type === 1 && (
        <g fill={fill}>
          <circle cx="16" cy="16" r="5" />
          <circle cx="30" cy="12" r="4.4" />
          <circle cx="41" cy="19" r="5.2" />
          <circle cx="24" cy="27" r="4.6" />
          <circle cx="37" cy="30" r="4" />
        </g>
      )}
      {type === 2 && (
        <g>
          <path fill={fill} d="M9 20c0-6 5-8 9-6 3-5 9-5 12-1 4-3 9-1 10 3 4 1 6 4 5 7-1 4-6 5-9 4-3 3-9 3-12 0-4 2-9 1-11-2-3-1-4-3-4-5z" />
          <path d="M20 14c1 2 1 5 0 7M31 13c1 2 1 6 0 8M40 17c1 2 1 4 0 6" stroke={stroke} strokeWidth="1.4" fill="none" opacity=".55" />
        </g>
      )}
      {type === 3 && (
        <g>
          <rect x="7" y="14" width="44" height="12" rx="6" fill={fill} />
          <path d="M17 14v12M26 14v12M35 14v12M43 15v10" stroke={stroke} strokeWidth="1.5" opacity=".5" />
        </g>
      )}
      {type === 4 && (
        <path fill={fill} d="M7 21c0-4 3-6 7-6h33c4 0 7 2 7 5s-3 6-7 6H14c-4 0-7-2-7-5z" />
      )}
      {type === 5 && (
        <g fill={fill}>
          <path d="M10 16c4-3 10-2 11 2 1 4-3 7-7 6-4-1-6-5-4-8z" />
          <path d="M27 13c5-2 10 1 10 5s-5 7-9 5-4-8-1-10z" />
          <path d="M42 20c4-2 8 1 7 5s-6 5-9 2-1-6 2-7z" />
        </g>
      )}
      {type === 6 && (
        <g fill={fill}>
          <path opacity=".92" d="M9 21c-1-4 3-6 6-5 1-4 6-5 9-2 2-4 8-4 10 0 4-2 8 0 8 4 3 0 5 3 4 6-2 3-6 3-8 2-2 3-7 4-10 2-3 2-8 1-10-2-4 1-8-1-9-5z" />
          <circle cx="15" cy="30" r="1.7" />
          <circle cx="33" cy="32" r="1.4" />
          <circle cx="45" cy="29" r="1.5" />
        </g>
      )}
      {type === 7 && (
        <g fill={fill}>
          <path opacity=".55" d="M5 25c6-4 12 2 18-1s10-6 16-3 10 6 14 4v6H5z" />
          <path opacity=".85" d="M5 29c7-3 12 3 18 0s11-5 16-2 9 5 14 3v4H5z" />
        </g>
      )}
    </svg>
  );
}

export function BristolScale({ value, onChange }) {
  return (
    <div className="ip-bristol" role="group" aria-label="Escala de consistência">
      {BRISTOL_SHAPES.map((shape, index) => {
        const type = index + 1;
        const checked = Number(value) === type;
        return (
          <button
            key={type}
            type="button"
            className="ip-bristol-opt"
            aria-pressed={checked}
            aria-label={`Opção ${type} de 7 — ${shape}`}
            onClick={() => onChange(checked ? '' : type)}
          >
            {checked && <CheckIcon className="ip-bristol-check" />}
            <span className="ip-bristol-n" aria-hidden="true">{type}</span>
            <BristolArt type={type} />
          </button>
        );
      })}
    </div>
  );
}

// ── Escala de cor da urina ───────────────────────────────────────────────────

// Referencia de 8 pontos. Os tons sao indicativos em tela e devem ser
// calibrados contra prancha impressa antes do uso clinico.
const URINE_TONES = [
  '#F8F5CE', '#F7F0A0', '#F5E874', '#F2DC4C',
  '#EBCC2B', '#DFB717', '#C99A0B', '#A87407'
];

export const URINE_DARK_THRESHOLD = 5;

export function UrineScale({ value, onChange, ariaLabel }) {
  return (
    <div className="ip-urine-strip" role="group" aria-label={ariaLabel}>
      {URINE_TONES.map((tone, index) => {
        const level = index + 1;
        const checked = Number(value) === level;
        return (
          <button
            key={level}
            type="button"
            className="ip-urine-opt"
            aria-pressed={checked}
            aria-label={`Tom ${level} de 8, do mais claro ao mais escuro`}
            onClick={() => onChange(checked ? '' : level)}
          >
            <span className="ip-urine-swatch" style={{ background: tone }} />
            <span className="ip-urine-n" aria-hidden="true">{level}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Questionario Sim/Nao ─────────────────────────────────────────────────────

export function YesNoQuestionnaire({ questions, answers, onChange, ariaLabel }) {
  return (
    <div className="ip-qlist" role="group" aria-label={ariaLabel}>
      {questions.map((question) => {
        const current = answers?.[question.key];
        return (
          <div key={question.key} className="ip-qrow">
            <span className="ip-qrow-q">{question.label}</span>
            <span className="ip-qrow-a">
              {[false, true].map((option) => (
                <button
                  key={String(option)}
                  type="button"
                  className="ip-qbtn"
                  aria-pressed={current === option}
                  aria-label={`${option ? 'Sim' : 'Não'} — ${question.label}`}
                  onClick={() => onChange(question.key, current === option ? null : option)}
                >
                  {option ? 'Sim' : 'Não'}
                </button>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
