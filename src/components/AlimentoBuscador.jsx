import React, { useEffect, useId, useMemo, useState } from 'react';
import { Search, PlusCircle } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import './AlimentoBuscador.css';

const MEDIDAS_BASE = [
  { value: 'gramas', label: 'Gramas (g)', gramas: 1 },
  { value: 'xicara', label: 'Xicara (cha)', gramas: 160 },
  { value: 'colher_sopa', label: 'Colher de sopa', gramas: 15 },
  { value: 'colher_cha', label: 'Colher de cha', gramas: 5 },
  { value: 'unidade', label: 'Unidade media', gramas: 100 },
  { value: 'concha', label: 'Concha media', gramas: 130 }
];

// Base local de medidas caseiras inspirada na TACO complementar.
const MEDIDAS_POR_CHAVE = [
  {
    termos: ['arroz', 'feijao', 'lentilha', 'grao-de-bico', 'macarrao'],
    medidas: {
      xicara: 160,
      colher_sopa: 25,
      concha: 140,
      unidade: 100
    }
  },
  {
    termos: ['frango', 'carne', 'peixe', 'ovo'],
    medidas: {
      unidade: 50,
      colher_sopa: 20,
      xicara: 140
    }
  },
  {
    termos: ['banana', 'maca', 'laranja', 'mamao', 'abacaxi', 'pera'],
    medidas: {
      unidade: 120,
      colher_sopa: 20,
      xicara: 130
    }
  },
  {
    termos: ['leite', 'iogurte', 'suco'],
    medidas: {
      xicara: 200,
      colher_sopa: 15,
      colher_cha: 5
    }
  },
  {
    termos: ['azeite', 'oleo', 'manteiga', 'margarina'],
    medidas: {
      colher_sopa: 13,
      colher_cha: 4
    }
  },
  {
    termos: ['pao', 'biscoito', 'torrada'],
    medidas: {
      unidade: 30,
      xicara: 60
    }
  }
];

const normalizeToken = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
);

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getMedidasParaDescricao = (descricao) => {
  const token = normalizeToken(descricao);
  const match = MEDIDAS_POR_CHAVE.find((item) => item.termos.some((term) => token.includes(term)));

  if (!match) return MEDIDAS_BASE;

  return MEDIDAS_BASE.map((base) => ({
    ...base,
    gramas: Number.isFinite(match.medidas[base.value]) ? match.medidas[base.value] : base.gramas
  }));
};

const AlimentoBuscador = ({ disabled = false, onAdd, grupoFiltro = '' }) => {
  const idPrefix = useId();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selecionado, setSelecionado] = useState(null);
  const [medida, setMedida] = useState('gramas');
  const [quantidade, setQuantidade] = useState('100');

  const medidasDisponiveis = useMemo(
    () => getMedidasParaDescricao(selecionado?.descricao || ''),
    [selecionado?.descricao]
  );

  useEffect(() => {
    if (!selecionado) return;
    const medidaExiste = medidasDisponiveis.some((item) => item.value === medida);
    if (!medidaExiste) {
      setMedida(medidasDisponiveis[0]?.value || 'gramas');
    }
  }, [medida, medidasDisponiveis, selecionado]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResultados([]);
      setLoading(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/taco/buscar', {
          params: {
            q: term,
            limit: 12,
            ...(grupoFiltro ? { grupo: grupoFiltro } : {})
          }
        });
        setResultados(Array.isArray(data) ? data : []);
      } catch (requestError) {
        setResultados([]);
        setError(getApiErrorMessage(requestError, 'Nao foi possivel buscar alimentos na TACO.'));
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const quantidadeNum = toNumber(quantidade) || 0;
  const medidaSelecionada = medidasDisponiveis.find((item) => item.value === medida) || medidasDisponiveis[0] || MEDIDAS_BASE[0];
  const quantidadeGramas = quantidadeNum > 0
    ? Number((quantidadeNum * Number(medidaSelecionada.gramas || 0)).toFixed(2))
    : 0;

  const handleSelect = (item) => {
    setSelecionado(item);
    setQuery(item.descricao || '');
    setResultados([]);
    setError('');
    setMedida('gramas');
  };

  const handleAdd = () => {
    if (!selecionado) {
      setError('Selecione um alimento da lista de sugestoes.');
      return;
    }
    if (!Number.isFinite(quantidadeNum) || quantidadeNum <= 0 || quantidadeGramas <= 0) {
      setError('Informe uma quantidade valida para adicionar o alimento.');
      return;
    }
    const fator = quantidadeGramas / 100;
    const energiaKcal = Number(((toNumber(selecionado.energiaKcal) || 0) * fator).toFixed(2));
    const cho = Number(((toNumber(selecionado.carboidrato) || 0) * fator).toFixed(2));
    const ptn = Number(((toNumber(selecionado.proteina) || 0) * fator).toFixed(2));
    const lip = Number(((toNumber(selecionado.lipidios) || 0) * fator).toFixed(2));
    const fibra = Number(((toNumber(selecionado.fibra) || 0) * fator).toFixed(2));

    onAdd?.({
      alimentoId: Number(selecionado.id),
      codigo: Number(selecionado.codigo || 0),
      descricao: selecionado.descricao || '',
      grupo: selecionado.grupo || '',
      medida,
      medidaLabel: medidaSelecionada.label,
      fatorGramas: Number(medidaSelecionada.gramas || 0),
      quantidadeMedida: Number(quantidadeNum.toFixed(2)),
      quantidadeGramas,
      calorias: energiaKcal,
      cho,
      ptn,
      lip,
      fibra,
      nutrientesPor100g: {
        energiaKcal: Number(toNumber(selecionado.energiaKcal) || 0),
        carboidrato: Number(toNumber(selecionado.carboidrato) || 0),
        proteina: Number(toNumber(selecionado.proteina) || 0),
        lipidios: Number(toNumber(selecionado.lipidios) || 0),
        fibra: Number(toNumber(selecionado.fibra) || 0)
      }
    });

    setSelecionado(null);
    setQuery('');
    setResultados([]);
    setQuantidade('100');
    setMedida('gramas');
    setError('');
  };

  const kcalPreview = selecionado && quantidadeGramas > 0
    ? Number(((toNumber(selecionado.energiaKcal) || 0) * quantidadeGramas / 100).toFixed(0))
    : null;

  return (
    <div className="alimento-buscador">
      <div className="alimento-buscador__row-search">
        <label className="sr-only" htmlFor={`${idPrefix}-query`}>Buscar alimento</label>
        <div className="alimento-buscador__search">
          <Search size={16} />
          <input
            id={`${idPrefix}-query`}
            className="busca-input"
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim()) setSelecionado(null);
            }}
            placeholder={grupoFiltro ? `Buscar preparação (ex.: arroz cozido, frango grelhado...)` : `Buscar alimento TACO (ex.: arroz, banana, frango...)`}
            disabled={disabled}
            aria-required="true"
          />
        </div>
      </div>

      <div className="alimento-buscador__row-controls">
        <label className="sr-only" htmlFor={`${idPrefix}-medida`}>Medida caseira</label>
        <select
          id={`${idPrefix}-medida`}
          className="busca-unidade"
          value={medida}
          onChange={(event) => setMedida(event.target.value)}
          disabled={disabled || !selecionado}
          aria-required="true"
        >
          {medidasDisponiveis.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${idPrefix}-quantidade`}>Quantidade</label>
        <input
          id={`${idPrefix}-quantidade`}
          className="busca-qty"
          type="number"
          min="0.1"
          step="0.1"
          value={quantidade}
          onChange={(event) => setQuantidade(event.target.value)}
          disabled={disabled}
          placeholder="Qtd."
          aria-required="true"
        />
        <button
          type="button"
          className="btn-adicionar-alimento"
          onClick={handleAdd}
          disabled={disabled}
        >
          <PlusCircle size={16} /> Adicionar
        </button>
      </div>

      <div className="alimento-buscador__meta">
        {selecionado ? (
          <>
            <span className="alimento-buscador__meta-nome">{selecionado.descricao}</span>
            {quantidadeGramas > 0 && (
              <span className="alimento-buscador__meta-grams">{quantidadeGramas.toFixed(1)} g</span>
            )}
            {kcalPreview !== null && kcalPreview > 0 && (
              <span className="alimento-buscador__meta-kcal">{kcalPreview} kcal</span>
            )}
          </>
        ) : (
          <span>Selecione um alimento para adicionar na refeicao.</span>
        )}
      </div>

      {loading && <div className="alimento-buscador__status">Buscando...</div>}
      {error && <div className="alimento-buscador__error">{error}</div>}

      {!loading && resultados.length > 0 && (
        <ul className="alimento-buscador__results">
          {resultados.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                disabled={disabled}
              >
                <span className="alimento-buscador__result-nome">{item.descricao}</span>
                <span className="alimento-buscador__result-side">
                  {item.energiaKcal != null && (
                    <span className="alimento-buscador__result-kcal">
                      {Number(item.energiaKcal).toFixed(0)} kcal/100g
                    </span>
                  )}
                  <span className="alimento-buscador__result-grupo">{item.grupo}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AlimentoBuscador;
