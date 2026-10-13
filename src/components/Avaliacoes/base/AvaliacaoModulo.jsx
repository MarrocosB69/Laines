import { createContext, useContext, useId } from 'react';
import { classes, idTituloSecao, normalizarTom } from './apoio';
import './avaliacao-base.css';

/* Estrutura de um formulário de avaliação: a raiz `.av-modulo`, as seções
   com título e o índice "Neste formulário". Só apresentação: nenhum estado
   de negócio. Contrato: docs/implementacao/avaliacoes-v2/contrato-avaliacao.md.

   Títulos: a página já tem h1 (layout), h2 ("Avaliação completa") e h3 (nome
   do módulo na barra). O módulo é h3, a seção h4 e a subseção h5 — o nível
   que os formulários já usavam. O contexto abaixo deriva o nível de cada
   seção do nível do módulo, então uma seção dentro de outra vira subseção
   sem prop nenhuma. */

// Fora de um AvaliacaoModulo (raiz posta à mão), a seção continua h4.
const NivelTitulo = createContext({ nivel: 4, dentroDeSecao: false });
const nivelValido = (n) => Math.min(6, Math.max(1, Math.round(Number(n) || 3)));
const Titulo = ({ nivel, ...props }) => {
  const Tag = `h${nivelValido(nivel)}`;
  return <Tag {...props} />;
};

const dataValida = (data) => data instanceof Date && !Number.isNaN(data.getTime());
const formatoData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
// Dia local em AAAA-MM-DD: toISOString usa UTC e trocaria o dia à noite.
const diaLocal = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');

function DataModulo({ data }) {
  if (dataValida(data)) {
    return <time className="av-modulo__data" dateTime={diaLocal(data)}>{formatoData.format(data)}</time>;
  }
  return <span className="av-modulo__data">{data}</span>;
}

export function AvaliacaoModulo({
  titulo, descricao, icone, status, statusTom, data, acoes,
  nivelTitulo = 3, as: Elemento = 'div', className, children, ...resto
}) {
  const nivel = nivelValido(nivelTitulo);
  const temMeta = Boolean(status) || Boolean(data);
  return (
    <Elemento className={classes('av-modulo', className)} {...resto}>
      {titulo && (
        <div className="av-modulo__cabecalho">
          {icone && <span className="av-modulo__icone" aria-hidden="true">{icone}</span>}
          <div className="av-modulo__titulos">
            <Titulo nivel={nivel} className="av-modulo__titulo">{titulo}</Titulo>
            {descricao && <p className="av-modulo__descricao">{descricao}</p>}
            {temMeta && (
              <p className="av-modulo__meta">
                {status && <span className={`av-selo av-selo--${normalizarTom(statusTom)}`}>{status}</span>}
                {status && data && ' '}
                {data && <DataModulo data={data} />}
              </p>
            )}
          </div>
          {acoes && <div className="av-modulo__acoes">{acoes}</div>}
        </div>
      )}
      <NivelTitulo.Provider value={{ nivel: nivelValido(nivel + 1), dentroDeSecao: false }}>{children}</NivelTitulo.Provider>
    </Elemento>
  );
}

// O título recebe tabIndex -1 para o índice poder levar o foco até ele. O id
// dele é idTituloSecao(id) (`${id}-titulo`): um grupo, uma tabela ou uma região
// da seção pode usá-lo em aria-labelledby.
export function AvaliacaoSecao({ id, titulo, descricao, acoes, className, children, ...resto }) {
  const { nivel, dentroDeSecao: subsecao } = useContext(NivelTitulo);
  const gerado = useId().replace(/[^\w-]/g, '');
  const base = id || `av-secao-${gerado}`;
  const tituloId = idTituloSecao(base);
  return (
    <section
      id={id}
      className={classes('av-secao', subsecao && 'av-secao--sub', className)}
      aria-labelledby={tituloId}
      {...resto}
    >
      <div className="av-secao__cabeca">
        <div className="av-secao__titulos">
          <Titulo nivel={nivel} id={tituloId} className="av-secao__titulo" tabIndex={-1}>{titulo}</Titulo>
          {descricao && <p className="av-secao__descricao">{descricao}</p>}
        </div>
        {acoes && <div className="av-secao__acoes">{acoes}</div>}
      </div>
      <NivelTitulo.Provider value={{ nivel: nivelValido(nivel + 1), dentroDeSecao: true }}>{children}</NivelTitulo.Provider>
    </section>
  );
}

const movimentoReduzido = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/* Âncora sem mudar a URL: um "#id" nativo cria uma entrada de histórico com
   `state` nulo, e AvaliacaoCompleta lê `location.state` (returnTo, sessão) —
   o "Voltar" da tela iria para outro lugar. Por isso o clique rola até a
   seção e leva o foco ao título; o href fica para abrir em nova aba e para
   quem navega sem JavaScript. */
function irParaSecao(evento, id) {
  const secao = document.getElementById(id);
  if (!secao) return;
  evento.preventDefault();
  secao.scrollIntoView({ behavior: movimentoReduzido() ? 'auto' : 'smooth', block: 'start' });
  const titulo = document.getElementById(idTituloSecao(id));
  (titulo || secao).focus?.({ preventScroll: true });
}

export function AvaliacaoIndice({ itens, titulo = 'Neste formulário', className }) {
  const tituloId = `av-indice-${useId().replace(/[^\w-]/g, '')}`;
  const lista = (Array.isArray(itens) ? itens : []).filter((item) => item && item.id && item.titulo);
  if (lista.length === 0) return null;
  return (
    <nav className={classes('av-indice', className)} aria-labelledby={tituloId}>
      <p id={tituloId} className="av-indice__titulo">{titulo}</p>
      <ol className="av-indice__lista">
        {lista.map((item) => (
          <li key={item.id} className="av-indice__item">
            <a className="av-indice__link" href={`#${item.id}`} onClick={(e) => irParaSecao(e, item.id)}>
              {item.titulo}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
