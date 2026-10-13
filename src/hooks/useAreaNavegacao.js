import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * UX-07 / UPD-18 — "contexto na navegação".
 *
 * StudentView, ProfessorView, TeamPortal e AthleteView guardavam a área ativa
 * em `useState`, então F5, voltar no navegador ou compartilhar o endereço não
 * recuperavam onde a pessoa estava — a URL ficava sempre em /aluno ou
 * /professor, não importa quantos cliques acontecessem depois. AdminView.jsx
 * já resolvia isso com `useSearchParams`; este hook generaliza o mesmo padrão
 * para reuso nos demais shells, sem repetir a lógica em cada um.
 *
 * As funções `resolveArea` e `buildAreaSearchParams` abaixo são puras de
 * propósito — nenhuma delas toca React — para poderem ser testadas fora do
 * DOM em scripts/test-contexto-navegacao.cjs.
 */

function toParams(value) {
  if (value instanceof URLSearchParams) return value;
  if (typeof value === 'string') return new URLSearchParams(value);
  if (value && typeof value === 'object') return new URLSearchParams(value);
  return new URLSearchParams();
}

/**
 * Lê a área ativa a partir da query string. Valor ausente ou não reconhecido
 * (lixo, ou área que este perfil não pode ver) volta ao padrão em silêncio —
 * nunca lança erro nem deixa a tela em branco.
 *
 * @param {URLSearchParams|string|object} searchParams
 * @param {string[]} allowedAreas - áreas que este perfil/shell pode receber;
 *   se omitido (não é array), a leitura fica sem restrição.
 * @param {string} defaultArea
 * @param {string} [paramName='area']
 */
export function resolveArea(searchParams, allowedAreas, defaultArea, paramName = 'area') {
  const params = toParams(searchParams);
  const requested = String(params.get(paramName) || '').trim();
  if (!requested) return defaultArea;
  if (Array.isArray(allowedAreas) && !allowedAreas.includes(requested)) return defaultArea;
  return requested;
}

/**
 * Produz o próximo conjunto de parâmetros da URL com a área definida, sem
 * descartar os demais parâmetros já presentes (ex.: paciente, filtros).
 *
 * @param {URLSearchParams|string|object} currentParams
 * @param {string} area
 * @param {string} [paramName='area']
 */
export function buildAreaSearchParams(currentParams, area, paramName = 'area') {
  const next = new URLSearchParams(toParams(currentParams));
  next.set(paramName, area);
  return next;
}

/**
 * Hook compartilhado: área ativa espelhada na query string da rota atual.
 *
 * Devolve `area`/`setArea` para substituir diretamente um par
 * `useState('algumaAba')` existente, mais `searchParams`/`setParam` para os
 * shells que também precisam guardar outro valor na URL (ex.: paciente
 * selecionado) usando a mesma instância de `useSearchParams`.
 *
 * @param {{allowedAreas: string[], defaultArea: string, paramName?: string}} options
 */
export function useAreaNavegacao({ allowedAreas, defaultArea, paramName = 'area' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const area = resolveArea(searchParams, allowedAreas, defaultArea, paramName);

  // Corrige a URL quando o valor pedido é lixo ou não é permitido para este
  // perfil — troca silenciosa para o padrão, com `replace` para não sujar o
  // histórico com um passo que a pessoa nunca escolheu.
  useEffect(() => {
    const requested = String(searchParams.get(paramName) || '').trim();
    if (requested && requested !== area) {
      setSearchParams((prev) => buildAreaSearchParams(prev, area, paramName), { replace: true });
    }
  }, [area, paramName, searchParams, setSearchParams]);

  const setArea = useCallback((nextArea) => {
    setSearchParams((prev) => buildAreaSearchParams(prev, nextArea, paramName));
  }, [paramName, setSearchParams]);

  // Setter genérico para outros valores de contexto (ex.: paciente aberto),
  // reaproveitando a mesma instância de searchParams/setSearchParams — evita
  // que duas chamadas independentes de useSearchParams pisem uma na outra.
  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null || value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    });
  }, [setSearchParams]);

  return { area, setArea, searchParams, setParam };
}
