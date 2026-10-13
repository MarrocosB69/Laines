import React, { useId } from 'react';
import { PainelSecao, PainelVisaoGeral } from '../../../../components/painel/Painel';
import usePerfilAtletas from '../hooks/usePerfilAtletas';
import './relatorios-novos.css';

/* Perfil dos atletas atendidos (WI-016, etapa 2). Só agregados: o servidor
   devolve null em todo grupo de 1 a 4 pessoas e a tela escreve "grupo pequeno
   demais" no lugar. Cada número vem com o denominador; a cor das barras é uma
   só, porque a classificação vai escrita e não deve virar sinal de alerta. */

const GRUPO_PEQUENO = 'grupo pequeno demais';

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

const numero = (valor) => (Number.isFinite(valor) ? valor : null);
const percentual = (n, denominador) => (
  numero(n) !== null && numero(denominador) && denominador > 0 ? Math.round((n / denominador) * 100) : null
);

const Sr = ({ children }) => <span className="painel-sr">{children}</span>;
const SemDado = () => <><span aria-hidden="true">—</span><Sr>sem dado</Sr></>;

// Linha de denominador: o "n" de cada bloco, escrito, nos três casos. Um
// denominador visível é sempre 5 ou mais, então o plural não falha.
function Denominador({ denominador, suprimido, texto = 'com essa avaliação no período' }) {
  if (suprimido) {
    return (
      <p className="rel-bloco__n rel-bloco__n--suprimido">
        <strong>Grupo pequeno demais</strong>: menos de 5 atletas {texto}. O número não é mostrado.
      </p>
    );
  }
  if (denominador === 0) return <p className="rel-bloco__n">Nenhum atleta {texto}.</p>;
  if (numero(denominador) === null) return <p className="rel-bloco__n"><SemDado /> atletas {texto}.</p>;
  return <p className="rel-bloco__n"><strong className="rel-bloco__n-valor">n = {denominador}</strong> atletas {texto}</p>;
}

function Valor({ celula, denominador }) {
  if (celula.suprimido) return <span className="rel-dist__valor rel-dist__valor--suprimido">{GRUPO_PEQUENO}</span>;
  if (numero(celula.n) === null) return <span className="rel-dist__valor"><SemDado /></span>;
  const pct = celula.n > 0 ? percentual(celula.n, denominador) : null;
  return (
    <span className="rel-dist__valor">
      <strong>{celula.n}</strong>
      {pct !== null && <span className="rel-dist__pct"> ({pct}%)</span>}
    </span>
  );
}

// Barras horizontais com rótulo e valor em texto; a barra é só desenho.
function Distribuicao({ titulo, dist, vazio = 'Nenhum atleta neste grupo.' }) {
  const tituloId = useId();
  const categorias = Array.isArray(dist?.categorias) ? dist.categorias : [];
  let corpo;
  if (dist?.suprimido) corpo = <p className="rel-dist__aviso"><strong>Grupo pequeno demais</strong> para mostrar.</p>;
  else if (dist?.denominador === 0 || categorias.length === 0) corpo = <p className="rel-dist__aviso">{vazio}</p>;
  else {
    corpo = (
      <ul role="list" className="rel-dist__lista" aria-labelledby={titulo ? tituloId : undefined}>
        {categorias.map((celula) => {
          const pct = celula.suprimido ? null : percentual(celula.n, dist.denominador);
          return (
            <li key={celula.chave} className={`rel-dist__linha${celula.suprimido ? ' rel-dist__linha--suprimida' : ''}`}>
              <span className="rel-dist__rotulo">{celula.rotulo}</span>
              {' '}
              <Valor celula={celula} denominador={dist.denominador} />
              <span className="rel-dist__trilho" aria-hidden="true">
                {pct !== null && pct > 0 && <span className="rel-dist__barra" style={{ '--rel-pct': `${pct}%` }} />}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="rel-dist">
      {titulo && <h4 id={tituloId} className="rel-dist__titulo">{titulo}</h4>}
      {corpo}
    </div>
  );
}

function Bloco({ bloco, children, rodape, textoDenominador }) {
  const tituloId = useId();
  if (!bloco) return null;
  const aberto = !bloco.suprimido && numero(bloco.denominador) !== null && bloco.denominador > 0;
  return (
    <article className="rel-bloco" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="rel-bloco__titulo">{bloco.titulo}</h3>
      {bloco.descricao && <p className="rel-bloco__descricao">{bloco.descricao}</p>}
      <Denominador denominador={bloco.denominador} suprimido={bloco.suprimido} texto={textoDenominador} />
      {aberto && children}
      {aberto && rodape && <p className="rel-bloco__nota">{rodape}</p>}
      <p className="rel-bloco__geracao">Gerado em {formatarGeracao(bloco.geradoEm)}</p>
    </article>
  );
}

function Metodos({ dist }) {
  const categorias = Array.isArray(dist?.categorias) ? dist.categorias : [];
  if (dist?.suprimido || categorias.length === 0) return null;
  return (
    <p className="rel-metodos">
      <span className="rel-metodos__rotulo">Por método:</span>
      {categorias.map((celula, index) => (
        <span key={celula.chave} className="rel-metodos__item">
          {index > 0 && <span aria-hidden="true"> · </span>}
          {celula.rotulo}:{' '}
          {celula.suprimido
            ? <span className="rel-dist__valor--suprimido">{GRUPO_PEQUENO}</span>
            : numero(celula.n) === null ? <SemDado /> : <strong>{celula.n}</strong>}
        </span>
      ))}
    </p>
  );
}

function GrupoSexo({ grupo }) {
  const titulo = !grupo.suprimido && numero(grupo.denominador) !== null && grupo.denominador > 0
    ? `${grupo.rotulo} · n = ${grupo.denominador}`
    : grupo.rotulo;
  return (
    <Distribuicao
      titulo={titulo}
      dist={grupo}
      vazio="Nenhum atleta com composição corporal no período."
    />
  );
}

const PerfilAtletasPanel = ({ range = 'month', projectId = 'all', capabilities }) => {
  const permitido = Boolean(capabilities?.gestao?.relatorios?.perfilAtletas);
  const { dados, estado, erro, recarregar } = usePerfilAtletas({ range, projectId, habilitado: permitido });
  if (!permitido) return null;

  const blocos = dados?.blocos || {};
  const quemSao = blocos.quemSao;
  const semNinguem = estado === 'pronto' && quemSao?.denominador === 0;
  const estadoSecao = estado === 'pronto' ? (semNinguem ? 'vazio' : 'pronto') : estado === 'erro' ? 'erro' : 'carregando';
  const periodo = dados?.periodo;
  const composicao = blocos.composicaoCorporal;

  return (
    <PainelVisaoGeral className="rel-novos">
      <PainelSecao
        id="relatorio-perfil-atletas"
        titulo="Perfil dos atletas atendidos"
        descricao="Sempre em grupo, nunca por pessoa. Grupos com menos de 5 atletas não aparecem."
        estado={estadoSecao}
        erro={{ mensagem: erro, onTentarNovamente: recarregar }}
        vazio={{
          titulo: 'Nenhum atleta com avaliação finalizada no período',
          descricao: 'Nenhuma avaliação finalizada entrou neste recorte. Escolha outro período para ver o perfil.'
        }}
      >
        {periodo && (
          <p className="rel-novos__contexto">
            Período de {formatarDia(periodo.inicio)} a {formatarDia(periodo.fim)}
            <span aria-hidden="true"> · </span>
            Grupo mínimo de {dados?.grupoMinimo ?? 5} atletas
          </p>
        )}
        <div className="rel-novos__grade">
          <Bloco bloco={quemSao} textoDenominador="com alguma avaliação finalizada no período">
            <Distribuicao titulo="Modalidade principal" dist={quemSao?.modalidade} />
            <Distribuicao titulo="Sexo biológico" dist={quemSao?.sexo} />
            <Distribuicao titulo="Faixa etária" dist={quemSao?.faixaEtaria} />
          </Bloco>
          <Bloco bloco={composicao} rodape={dados?.definicao?.composicao} textoDenominador="com composição corporal no período">
            <Metodos dist={composicao?.metodos} />
            {(composicao?.porSexo || []).map((grupo) => <GrupoSexo key={grupo.chave} grupo={grupo} />)}
          </Bloco>
          {[blocos.disponibilidadeEnergetica, blocos.insegurancaAlimentar, blocos.padraoAlimentarNova, blocos.hidratacao]
            .filter(Boolean)
            .map((bloco) => (
              <Bloco key={bloco.instrumento} bloco={bloco}>
                <Distribuicao dist={bloco} />
              </Bloco>
            ))}
        </div>
        {dados?.definicao && (
          <p className="rel-novos__rodape">
            {dados.definicao.instrumento} {dados.definicao.supressao}
          </p>
        )}
      </PainelSecao>
    </PainelVisaoGeral>
  );
};

export default PerfilAtletasPanel;
