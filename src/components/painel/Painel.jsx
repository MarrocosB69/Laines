import { useId } from 'react';
import { AlertCircle, ArrowRight, ChevronRight, Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import './painel.css';

/* Peças compartilhadas da "Visão geral" dos cinco portais. A interface é a
   de docs/implementacao/visao-geral-v2/contrato-painel.md; o visual segue a
   landing (tokens --lt-*, par Sofia Sans) e está todo em painel.css.
   StatCard e FeedbackState de components/ui não foram reaproveitados: o
   primeiro não tem tom, detalhe nem versão clicável, e o esqueleto do
   segundo pulsa em laço infinito (ui-shimmer), o que o briefing proíbe. */

const TONS = new Set(['neutro', 'atencao', 'positivo']);
const tomValido = (tom) => (TONS.has(tom) ? tom : 'neutro');
const classes = (...lista) => lista.filter(Boolean).join(' ');
const dataValida = (data) => data instanceof Date && !Number.isNaN(data.getTime());

const formatoData = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

// Dia local em AAAA-MM-DD para o atributo datetime: toISOString usa UTC e,
// no horário de Brasília, trocaria o dia depois das 21h.
const diaLocal = (data) => [
  data.getFullYear(),
  String(data.getMonth() + 1).padStart(2, '0'),
  String(data.getDate()).padStart(2, '0')
].join('-');

// Mesma regra de getGreeting em src/views/admin/Dashboard/DashboardStats.jsx
// (linhas 258–260 em 26/09/2026). scripts/test-painel.cjs guarda a cópia
// literal daquela função e testa as fronteiras de hora.
// eslint-disable-next-line react-refresh/only-export-components -- o contrato exporta a regra deste arquivo
export function saudacaoPorHorario(date) {
  const h = (dataValida(date) ? date : new Date()).getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const Sr = ({ children }) => <span className="painel-sr">{children}</span>;

// "Atenção" escrito, não só a cor: nenhum estado depende apenas do tom.
const MarcaAtencao = () => (
  <span className="painel-tag painel-tag--atencao">
    <TriangleAlert size={12} aria-hidden="true" />
    Atenção
  </span>
);

export function PainelVisaoGeral({ children, className }) {
  return <div className={classes('painel', className)}>{children}</div>;
}

export function PainelCabecalho({ saudacao, nome, papel, data, acoes }) {
  const temData = dataValida(data);
  const inicio = saudacao || (temData ? saudacaoPorHorario(data) : '');
  const titulo = [inicio, nome].filter(Boolean).join(', ');

  return (
    <div className="painel-cabecalho">
      <div className="painel-cabecalho__texto">
        {/* h2, não h1: o cabeçalho de cada portal já tem o h1 com o título da
            página ("Visão Geral"); dois h1 confundiriam a navegação por títulos. */}
        <h2 className="painel-cabecalho__titulo">{titulo}</h2>
        {(papel || temData) && (
          <p className="painel-cabecalho__apoio">
            {papel && <span className="painel-cabecalho__papel">{papel}</span>}
            {papel && temData && ' '}
            {temData && (
              <time className="painel-cabecalho__data" dateTime={diaLocal(data)}>
                {formatoData.format(data)}
              </time>
            )}
          </p>
        )}
      </div>
      {acoes && <div className="painel-cabecalho__acoes">{acoes}</div>}
    </div>
  );
}

const semValor = (valor) => valor === null || valor === undefined || valor === '';
const ESQUELETO_INDICADORES = 4;

function Indicador({ item }) {
  const { rotulo, valor, detalhe, icone: Icone, onClick } = item;
  const tom = tomValido(item.tom);
  const clicavel = typeof onClick === 'function';
  const temTopo = Icone || tom === 'atencao' || clicavel;
  const conteudo = (
    <>
      {temTopo && (
        <span className="painel-indicador__topo">
          {Icone && <span className="painel-indicador__icone" aria-hidden="true"><Icone size={20} /></span>}
          <span className="painel-indicador__marcas">
            {tom === 'atencao' && <MarcaAtencao />}
            {clicavel && <ArrowRight className="painel-indicador__seta" size={18} aria-hidden="true" />}
          </span>
        </span>
      )}
      {' '}
      {/* Ausência não vira zero: sem valor, um traço e "sem dado" por extenso. */}
      <span className="painel-indicador__valor">
        {semValor(valor) ? <><span aria-hidden="true">—</span><Sr>sem dado</Sr></> : valor}
      </span>
      {' '}
      <span className="painel-indicador__rotulo">{rotulo}</span>
      {detalhe && <>{' '}<span className="painel-indicador__detalhe">{detalhe}</span></>}
    </>
  );
  const classe = classes(
    'painel-indicador', 'stat-card', `painel-indicador--${tom}`,
    clicavel && 'stat-card-action painel-indicador--acao',
    item.expandido && 'painel-indicador--ativo'
  );
  // `expandido` (opcional): o item abre/fecha um detalhe na página. Anuncia o
  // estado (aria-expanded) e o mostra (--ativo), como fazia o `.active` antigo.
  const expandido = typeof item.expandido === 'boolean' ? item.expandido : undefined;
  return clicavel
    ? <button type="button" className={classe} onClick={onClick} aria-expanded={expandido}>{conteudo}</button>
    : <div className={classe}>{conteudo}</div>;
}

const IndicadorEsqueleto = () => (
  <div className="painel-indicador painel-indicador--esqueleto">
    <span className="painel-esqueleto__bloco painel-esqueleto__bloco--icone" />
    <span className="painel-esqueleto__bloco painel-esqueleto__bloco--valor" />
    <span className="painel-esqueleto__bloco painel-esqueleto__bloco--rotulo" />
  </div>
);

export function PainelIndicadores({ rotulo = 'Indicadores', itens, carregando = false }) {
  const lista = Array.isArray(itens) ? itens : [];
  const quantidade = carregando ? (lista.length || ESQUELETO_INDICADORES) : lista.length;
  if (quantidade === 0) return null;
  // Na faixa larga, a grade tem tantas colunas quantos itens (até 4).
  const estilo = { '--painel-colunas': Math.min(quantidade, 4) };

  return (
    <section className="painel-indicadores" aria-label={rotulo} aria-busy={carregando || undefined}>
      {carregando && <Sr>Carregando indicadores</Sr>}
      <ul role="list" className="painel-indicadores__lista" style={estilo}>
        {carregando
          ? Array.from({ length: quantidade }, (_, i) => (
            <li key={i} className="painel-indicadores__item" aria-hidden="true"><IndicadorEsqueleto /></li>
          ))
          : lista.map((item, i) => (
            <li key={item.id ?? i} className="painel-indicadores__item"><Indicador item={item} /></li>
          ))}
      </ul>
    </section>
  );
}

const EsqueletoLinhas = () => (
  <div className="painel-esqueleto">
    <Sr>Carregando…</Sr>
    <span className="painel-esqueleto__linha" aria-hidden="true" />
    <span className="painel-esqueleto__linha" aria-hidden="true" />
    <span className="painel-esqueleto__linha" aria-hidden="true" />
  </div>
);

function EstadoVazio({ vazio }) {
  const { titulo, descricao } = vazio || {};
  return (
    <div className="painel-estado">
      <span className="painel-estado__icone" aria-hidden="true"><Inbox size={22} /></span>
      <p className="painel-estado__titulo">{titulo || 'Nada por aqui'}</p>
      {descricao && <p className="painel-estado__descricao">{descricao}</p>}
    </div>
  );
}

// Sem onTentarNovamente não há botão: um "Tentar novamente" que não faz
// nada seria pior que nenhum.
function EstadoErro({ erro }) {
  const { mensagem, onTentarNovamente } = erro || {};
  return (
    <div className="painel-estado painel-estado--erro">
      <span className="painel-estado__icone" aria-hidden="true"><AlertCircle size={22} /></span>
      <p className="painel-estado__titulo" role="alert">{mensagem || 'Não foi possível carregar.'}</p>
      {typeof onTentarNovamente === 'function' && (
        <button type="button" className="painel-botao" onClick={onTentarNovamente}>
          <RefreshCw size={16} aria-hidden="true" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function PainelSecao({ id, titulo, descricao, acao, estado = 'pronto', vazio, erro, children, className }) {
  const gerado = useId().replace(/[^\w-]/g, '');
  const tituloId = `${id || `painel-secao-${gerado}`}-titulo`;
  const carregando = estado === 'carregando';
  let corpo = children;
  if (carregando) corpo = <EsqueletoLinhas />;
  else if (estado === 'erro') corpo = <EstadoErro erro={erro} />;
  else if (estado === 'vazio') corpo = <EstadoVazio vazio={vazio} />;

  return (
    <section
      id={id}
      className={classes('painel-secao', className)}
      aria-labelledby={tituloId}
      aria-busy={carregando || undefined}
    >
      <div className="painel-secao__cabeca">
        <div className="painel-secao__titulos">
          <h2 id={tituloId} className="painel-secao__titulo">{titulo}</h2>
          {descricao && <p className="painel-secao__descricao">{descricao}</p>}
        </div>
        {acao && typeof acao.onClick === 'function' && (
          <button type="button" className="painel-secao__acao" onClick={acao.onClick}>
            {acao.rotulo}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="painel-secao__corpo">{corpo}</div>
    </section>
  );
}

function LinhaLista({ item }) {
  const { titulo, subtitulo, meta, icone: Icone, onClick } = item;
  const tom = tomValido(item.tom);
  const clicavel = typeof onClick === 'function';
  const temMeta = Boolean(meta) || tom === 'atencao';
  const conteudo = (
    <>
      {Icone && <span className="painel-lista__icone" aria-hidden="true"><Icone size={18} /></span>}
      <span className="painel-lista__corpo">
        <span className="painel-lista__texto">
          <span className="painel-lista__titulo">{titulo}</span>
          {subtitulo && <>{' '}<span className="painel-lista__subtitulo">{subtitulo}</span></>}
        </span>
        {temMeta && (
          <>
            {' '}
            <span className="painel-lista__meta">
              {tom === 'atencao' && <MarcaAtencao />}
              {meta && <span>{meta}</span>}
            </span>
          </>
        )}
      </span>
      {clicavel && <ChevronRight className="painel-lista__seta" size={18} aria-hidden="true" />}
    </>
  );
  const classe = classes('painel-lista__linha', `painel-lista__linha--${tom}`, clicavel && 'painel-lista__linha--acao', item.expandido && 'painel-lista__linha--ativa');
  const expandido = typeof item.expandido === 'boolean' ? item.expandido : undefined;
  return clicavel
    ? <button type="button" className={classe} onClick={onClick} aria-expanded={expandido}>{conteudo}</button>
    : <div className={classe}>{conteudo}</div>;
}

// Lista vazia não vira um <ul> sem itens: o vazio é estado da PainelSecao.
export function PainelLista({ rotuloAcessivel, itens, className }) {
  const lista = Array.isArray(itens) ? itens : [];
  if (lista.length === 0) return null;
  return (
    <ul role="list" className={classes('painel-lista', className)} aria-label={rotuloAcessivel}>
      {lista.map((item, i) => (
        <li key={item.id ?? i} className="painel-lista__item"><LinhaLista item={item} /></li>
      ))}
    </ul>
  );
}
