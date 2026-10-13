import React, { useId } from 'react';
import { PainelSecao, PainelVisaoGeral } from '../../../../components/painel/Painel';
import useProducaoLiga from '../hooks/useProducaoLiga';
import './relatorios-novos.css';

/* Produção da liga (WI-016, etapa 3): contagens por área no período. Um total
   null é fonte indisponível e aparece como "—", nunca como 0; zero só quando
   a fonte respondeu. Projetos ativos são situação atual, e a tela diz isso. */

const formatarDia = (valor) => {
  const [ano, mes, dia] = String(valor || '').split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—';
};

const formatoGeracao = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
});
const formatarGeracao = (iso) => {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '—' : formatoGeracao.format(data);
};

const Sr = ({ children }) => <span className="painel-sr">{children}</span>;
const temNumero = (valor) => Number.isFinite(valor);

function ItemProducao({ item }) {
  const situacoes = Array.isArray(item.porSituacao) ? item.porSituacao : [];
  return (
    <li className="rel-producao__item">
      <span className="rel-producao__valor">
        {temNumero(item.total) ? item.total : <><span aria-hidden="true">—</span><Sr>sem dado</Sr></>}
      </span>
      <span className="rel-producao__texto">
        <span className="rel-producao__rotulo">
          {item.rotulo}
          {item.recorte === 'situacao_atual' && <span className="rel-tag">Situação atual</span>}
        </span>
        {!item.fonteDisponivel && (
          <span className="rel-producao__detalhe">Fonte indisponível no momento: o número não foi lido.</span>
        )}
        {item.fonteDisponivel && situacoes.length > 0 && (
          <span className="rel-producao__detalhe">
            {situacoes.map((situacao, index) => (
              <span key={situacao.chave}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                {situacao.rotulo}: {temNumero(situacao.n) ? situacao.n : '—'}
              </span>
            ))}
          </span>
        )}
      </span>
    </li>
  );
}

function Area({ area }) {
  const tituloId = useId();
  const itens = Array.isArray(area.itens) ? area.itens : [];
  return (
    <article className="rel-bloco rel-area" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="rel-bloco__titulo">{area.rotulo}</h3>
      <ul role="list" className="rel-producao">
        {itens.map((item) => <ItemProducao key={item.chave} item={item} />)}
      </ul>
    </article>
  );
}

const ProducaoLigaPanel = ({ range = 'month', capabilities }) => {
  // Mesma capacidade dos endpoints de Relatórios (canAccessAnalyticsReports).
  const permitido = Boolean(capabilities?.gestao?.relatorios?.exportacao);
  const { dados, estado, erro, recarregar } = useProducaoLiga({ range, habilitado: permitido });
  if (!permitido) return null;

  const areas = Array.isArray(dados?.areas) ? dados.areas : [];
  const estadoSecao = estado === 'pronto' ? (areas.length ? 'pronto' : 'vazio') : estado === 'erro' ? 'erro' : 'carregando';
  const periodo = dados?.periodo;

  return (
    <PainelVisaoGeral className="rel-novos">
      <PainelSecao
        id="relatorio-producao-liga"
        titulo="Produção da liga"
        descricao="O que a liga produziu no período, por área. Só contagens, sem nomes nem títulos."
        estado={estadoSecao}
        erro={{ mensagem: erro, onTentarNovamente: recarregar }}
        vazio={{ titulo: 'Sem dados de produção', descricao: 'O servidor não devolveu nenhuma área.' }}
      >
        {periodo && (
          <p className="rel-novos__contexto">
            Período de {formatarDia(periodo.inicio)} a {formatarDia(periodo.fim)}
            <span aria-hidden="true"> · </span>
            {/* O servidor não recorta a produção por projeto: o filtro de
                projeto da página não vale aqui, e a tela diz isso. */}
            Toda a liga, sem recorte por projeto
            <span aria-hidden="true"> · </span>
            Gerado em {formatarGeracao(dados?.geradoEm)}
          </p>
        )}
        <div className="rel-novos__grade rel-novos__grade--areas">
          {areas.map((area) => <Area key={area.chave} area={area} />)}
        </div>
        <p className="rel-novos__rodape">
          Conteúdos contam pela data do item (ou pela criação, quando não há data); rascunhos e arquivados ficam de fora.
          {' '}Produções e ideias contam pela data de cadastro, com a situação de hoje. &quot;—&quot; quer dizer que a fonte não pôde ser lida.
        </p>
      </PainelSecao>
    </PainelVisaoGeral>
  );
};

export default ProducaoLigaPanel;
