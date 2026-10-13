import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../../../services/api';

// Produção da liga (WI-016). Contagens por área no período; um total null
// quer dizer fonte indisponível, nunca zero.
export const useProducaoLiga = ({ range, habilitado = true }) => {
  const [dados, setDados] = useState(null);
  const [estado, setEstado] = useState(habilitado ? 'carregando' : 'inativo');
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!habilitado) {
      setDados(null);
      setEstado('inativo');
      return undefined;
    }
    const controller = new AbortController();
    setEstado('carregando');
    setErro('');
    api.get('/analytics/reports/producao', { params: { range }, signal: controller.signal })
      .then(({ data }) => {
        setDados(data || null);
        setEstado(data ? 'pronto' : 'erro');
        if (!data) setErro('O servidor não devolveu a produção da liga.');
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setDados(null);
        setErro(getApiErrorMessage(requestError, 'Não foi possível carregar a produção da liga.'));
        setEstado('erro');
      });
    return () => controller.abort();
  }, [habilitado, range, versao]);

  const recarregar = useCallback(() => setVersao((valor) => valor + 1), []);

  return { dados, estado, erro, recarregar };
};

export default useProducaoLiga;
