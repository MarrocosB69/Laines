import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../../../services/api';

// Perfil agregado dos atletas (WI-016). O servidor decide o acesso e já
// devolve null no lugar de todo grupo com menos de 5 pessoas; a tela só
// mostra. Sem `habilitado`, nada é pedido: quem não tem a capacidade não
// dispara um 403 à toa.
export const usePerfilAtletas = ({ range, projectId, habilitado = true }) => {
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
    api.get('/analytics/reports/perfil-atletas', { params: { range, projectId }, signal: controller.signal })
      .then(({ data }) => {
        setDados(data || null);
        setEstado(data ? 'pronto' : 'erro');
        if (!data) setErro('O servidor não devolveu o perfil dos atletas.');
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setDados(null);
        setErro(getApiErrorMessage(requestError, 'Não foi possível carregar o perfil dos atletas.'));
        setEstado('erro');
      });
    return () => controller.abort();
  }, [habilitado, range, projectId, versao]);

  const recarregar = useCallback(() => setVersao((valor) => valor + 1), []);

  return { dados, estado, erro, recarregar };
};

export default usePerfilAtletas;
