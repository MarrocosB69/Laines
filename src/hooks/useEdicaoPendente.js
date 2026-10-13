import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * UPD-18 (UX-07) — protecao de edicao nao salva, separada do redirecionamento
 * de sessao.
 *
 * Duas situacoes que hoje se confundem em outras telas:
 *  1. Abandono deliberado (fechar aba / navegar para outro lugar) — o
 *     `beforeunload` cobre fechar aba; navegacao interna precisa ser
 *     confirmada por quem controla o botao "Voltar" da tela, porque o app usa
 *     BrowserRouter (sem useBlocker/unstable_usePrompt).
 *  2. Sessao expirada — o token vence, `api.js` dispara o evento de sessao
 *     expirada e a aplicacao redireciona para o login LEVANDO o que a pessoa
 *     digitou. Este hook guarda um rascunho local, isolado por usuario e por
 *     registro, no instante em que o evento chega — antes do redirecionamento
 *     desmontar a tela — para ser oferecido de volta quando a pessoa voltar.
 *
 * Este arquivo nao importa `src/services/api.js` de proposito: e um utilitario
 * de leaf, sem rede. O nome do evento abaixo precisa continuar igual a
 * `AUTH_EXPIRED_EVENT` exportado por `services/api.js` ('laines:auth-expired');
 * duplicar a string aqui evita arrastar axios/import.meta.env para este hook
 * (e para o teste puro em Node que exercita a logica sem o Vite).
 */
const AUTH_EXPIRED_EVENT = 'laines:auth-expired';

const DRAFT_KEY_PREFIX = 'laines:rascunho';

/**
 * Normaliza um valor para comparacao de "sujo": string vazia, null e
 * undefined viram a mesma coisa (ausencia), numeros nao-finitos idem, objetos
 * tem chaves ordenadas e chaves vazias omitidas. Isso garante que reabrir uma
 * tela e nao tocar em nada — ou tocar e devolver o mesmo valor — nunca conta
 * como pendencia.
 */
const normalizeForCompare = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map(normalizeForCompare);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const normalized = normalizeForCompare(value[key]);
      if (normalized !== null) out[key] = normalized;
    }
    return out;
  }
  return value;
};

/**
 * Deteccao de "sujo": edicao igual ao salvo nao e pendencia; qualquer
 * alteracao real e. Pura, sem estado — testavel isoladamente.
 */
export const isDirty = (atual, salvo) => (
  JSON.stringify(normalizeForCompare(atual)) !== JSON.stringify(normalizeForCompare(salvo))
);

/**
 * Chave de rascunho local: isola por tela, por usuario e por registro. Sem os
 * tres, nao ha chave — o rascunho simplesmente nao e persistido, em vez de
 * arriscar colisao entre contas no mesmo navegador.
 */
export const buildDraftKey = (screenId, userId, recordId) => {
  const s = String(screenId || '').trim();
  const u = String(userId || '').trim();
  const r = String(recordId || '').trim();
  if (!s || !u || !r) return null;
  return `${DRAFT_KEY_PREFIX}:${s}:${u}:${r}`;
};

const getSafeStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // Alguns navegadores expoem localStorage mas lancam ao usar (modo
    // privado em certas versoes de Safari, cota estourada). Um toque de
    // leitura/escrita aqui garante que o retorno so acontece se funcionar.
    const probeKey = '__laines_edicao_pendente_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
};

export const salvarRascunho = (key, { userId, recordId, dados } = {}) => {
  const storage = getSafeStorage();
  if (!storage || !key) return false;
  try {
    storage.setItem(key, JSON.stringify({
      userId: String(userId || ''),
      recordId: String(recordId || ''),
      dados,
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch {
    // Cota estourada ou modo privado: a tela segue funcionando sem rascunho
    // local. Perder o rascunho e melhor que quebrar a tela.
    return false;
  }
};

export const lerRascunho = (key, { userId, recordId } = {}) => {
  const storage = getSafeStorage();
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Defesa em profundidade: a chave ja isola por usuario/registro, mas o
    // conteudo e conferido antes de devolver, para o caso de a chave ter sido
    // escrita por uma versao antiga do formato.
    if (userId !== undefined && String(parsed.userId || '') !== String(userId || '')) return null;
    if (recordId !== undefined && String(parsed.recordId || '') !== String(recordId || '')) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const limparRascunho = (key) => {
  const storage = getSafeStorage();
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {
    // nada a fazer — se remover falhar, o proximo salvarRascunho sobrescreve.
  }
};

/**
 * Protege edicao nao salva de duas formas:
 *  - `beforeunload` enquanto `dirty` for verdadeiro (fechar aba / atualizar).
 *  - Rascunho local ao receber o evento de sessao expirada, para sobreviver
 *    ao redirecionamento para o login e ser oferecido de volta depois.
 *
 * Navegacao interna (botao "Voltar" da tela) fica por conta de quem chama —
 * o app usa BrowserRouter, sem bloqueio de rota disponivel; o padrao e
 * confirmar no proprio handler de saida usando o `dirty` devolvido aqui.
 *
 * `dirty` pode vir pronto (telas que ja calculam a propria pendencia, como
 * `usePrescricaoApi.alterado`) ou ser calculado a partir de `atual`/`salvo`.
 */
export function useEdicaoPendente({
  ativo = true,
  dirty: dirtyProp,
  atual,
  salvo,
  dados,
  screenId,
  userId,
  recordId
}) {
  const computedDirty = dirtyProp !== undefined ? Boolean(dirtyProp) : isDirty(atual, salvo);
  const dirty = Boolean(ativo) && computedDirty;

  const draftKey = useMemo(
    () => buildDraftKey(screenId, userId, recordId),
    [screenId, userId, recordId]
  );

  const [rascunhoDisponivel, setRascunhoDisponivel] = useState(false);
  useEffect(() => {
    setRascunhoDisponivel(Boolean(draftKey && lerRascunho(draftKey, { userId, recordId })));
  }, [draftKey, userId, recordId]);

  // Refs para o listener do evento de sessao expirada ler o valor mais
  // recente sem precisar re-registrar o listener a cada tecla digitada.
  // Atualizados em useEffect (nao durante o render): mutar ref.current no
  // corpo do componente e o que o lint react-hooks/refs proibe, porque uma
  // renderizacao pode ser descartada pelo React antes de confirmar na tela.
  const dirtyRef = useRef(dirty);
  const draftPayload = dados !== undefined ? dados : atual;
  const draftPayloadRef = useRef(draftPayload);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    draftPayloadRef.current = draftPayload;
  }, [draftPayload]);

  useEffect(() => {
    if (typeof window === 'undefined' || !dirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleAuthExpired = () => {
      if (!dirtyRef.current || !draftKey) return;
      const saved = salvarRascunho(draftKey, {
        userId,
        recordId,
        dados: draftPayloadRef.current
      });
      if (saved) setRascunhoDisponivel(true);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [draftKey, userId, recordId]);

  const recuperarRascunho = useCallback(() => {
    if (!draftKey) return null;
    const parsed = lerRascunho(draftKey, { userId, recordId });
    return parsed ? parsed.dados : null;
  }, [draftKey, userId, recordId]);

  const descartarRascunho = useCallback(() => {
    if (draftKey) limparRascunho(draftKey);
    setRascunhoDisponivel(false);
  }, [draftKey]);

  return { dirty, rascunhoDisponivel, recuperarRascunho, descartarRascunho };
}

export default useEdicaoPendente;
