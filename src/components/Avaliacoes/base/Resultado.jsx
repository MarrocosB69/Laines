import { AlertCircle, Check, CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import { classes, normalizarDica, normalizarTom, tomDaVariacao, valorAusente } from './apoio';
import { Dica } from './Dica';
import './avaliacao-base.css';

/* Resultado calculado, aviso e barra de ações dos formulários de avaliação.
   Só apresentação: o valor chega já calculado e formatado pelo formulário
   (arredondamento e casas decimais continuam lá). Contrato:
   docs/implementacao/avaliacoes-v2/contrato-avaliacao.md. */

const temConteudo = (no) => no !== undefined && no !== null && no !== false && no !== '';

// A variação chega escrita pelo formulário, com o sinal. O tom (só com
// `melhorQuando`) vem com um ícone de forma própria e o sentido por extenso
// para o leitor de tela, como em ValorAnterior.
function Variacao({ variacao, melhorQuando }) {
  const tomVariacao = tomDaVariacao(variacao, melhorQuando);
  return (
    <p className={classes('av-resultado__variacao', tomVariacao !== 'neutro' && `av-resultado__variacao--${tomVariacao}`)}>
      {tomVariacao === 'positivo' && <Check size={14} aria-hidden="true" />}
      {tomVariacao === 'atencao' && <TriangleAlert size={14} aria-hidden="true" />}
      <span className="av-sr">Variação em relação à avaliação anterior: </span>
      {variacao}
      {tomVariacao === 'positivo' && <span className="av-sr"> (na direção desejada)</span>}
      {tomVariacao === 'atencao' && <span className="av-sr"> (atenção: na direção oposta à desejada)</span>}
    </p>
  );
}

// Valor, unidade, classificação escrita, referência e método. O tom é só
// complemento: sem classificação escrita, ele não pinta nada.
//
// `valorEmTexto`: o próprio valor é a classificação ("Prioridade: Alta"),
// então vai em texto (não na voz de número) e leva o tom. Sem `rotulo`, a
// linha do rótulo não aparece. `dica` põe o "?" ao lado do rótulo.
export function ResultadoCalculado({
  rotulo, valor, unidade, classificacao, tom, referencia, metodo, semValor, className,
  dica, valorEmTexto = false, variacao, melhorQuando
}) {
  const ausente = valorAusente(valor);
  const temClassificacao = !valorAusente(classificacao);
  const emTexto = valorEmTexto && !ausente;
  const tomFinal = temClassificacao || emTexto ? normalizarTom(tom) : 'neutro';
  const conteudoDica = normalizarDica(dica);
  let conteudoValor;
  if (!ausente) conteudoValor = <span className={classes('av-resultado__numero', emTexto && 'av-resultado__numero--texto')}>{valor}</span>;
  else if (semValor) conteudoValor = <span className="av-resultado__numero av-resultado__numero--texto">{semValor}</span>;
  else {
    conteudoValor = (
      <span className="av-resultado__numero">
        <span aria-hidden="true">—</span>
        <span className="av-sr">sem valor</span>
      </span>
    );
  }
  const rotuloEl = temConteudo(rotulo) ? <p className="av-resultado__rotulo">{rotulo}</p> : null;
  // Com dica, o rótulo e o "?" dividem uma linha e o texto da dica fica
  // embaixo; sem dica, a marcação é a de antes. A variação entra no mesmo
  // espaço do valor, para a lista de filhos não mudar sem ela.
  const valorEl = (
    <p className={classes('av-resultado__valor', ausente && 'av-resultado__valor--ausente')}>
      {conteudoValor}
      {!ausente && unidade && <>{' '}<span className="av-resultado__unidade">{unidade}</span></>}
    </p>
  );
  return (
    <div className={classes('av-resultado', `av-resultado--${tomFinal}`, emTexto && 'av-resultado--texto', className)}>
      {conteudoDica ? (
        <div className="av-resultado__cabeca">
          {rotuloEl}
          <Dica texto={conteudoDica.linhas} rotulo={conteudoDica.rotulo} />
        </div>
      ) : rotuloEl}
      {temConteudo(variacao) ? <>{valorEl}<Variacao variacao={variacao} melhorQuando={melhorQuando} /></> : valorEl}
      {temClassificacao && <p className="av-resultado__classificacao">{classificacao}</p>}
      {referencia && <p className="av-resultado__referencia">{referencia}</p>}
      {metodo && <p className="av-resultado__metodo">{metodo}</p>}
    </div>
  );
}

const AVISOS = {
  info: { Icone: Info, rotulo: 'Informação' },
  atencao: { Icone: TriangleAlert, rotulo: 'Atenção' },
  perigo: { Icone: OctagonAlert, rotulo: 'Alerta' },
  sucesso: { Icone: CircleCheck, rotulo: 'Sucesso' }
};

// O tipo vem num ícone de forma própria e num prefixo lido pelo leitor de
// tela; o texto visível é o que o formulário já tinha. `rotuloTipo=""`
// tira o prefixo quando o texto já começa com "Atenção:" ou parecido.
export function AvisoAvaliacao({ tipo = 'info', titulo, rotuloTipo, anunciar = false, className, children }) {
  const chave = AVISOS[tipo] ? tipo : 'info';
  const { Icone, rotulo } = AVISOS[chave];
  const prefixo = rotuloTipo === undefined ? rotulo : rotuloTipo;
  let papel;
  if (anunciar) papel = chave === 'perigo' ? 'alert' : 'status';
  return (
    <div className={classes('av-aviso', `av-aviso--${chave}`, className)} role={papel}>
      <Icone className="av-aviso__icone" size={18} aria-hidden="true" />
      <div className="av-aviso__texto">
        {prefixo && <span className="av-sr">{`${prefixo}: `}</span>}
        {titulo && <strong className="av-aviso__titulo">{titulo}</strong>}
        {titulo && ' '}
        {children}
      </div>
    </div>
  );
}

// Os mesmos três textos que os formulários escrevem hoje ao lado do botão.
const TEXTOS_STATUS = { saving: 'Salvando...', saved: 'Salvo', error: 'Erro ao salvar' };

function textoDoStatus(status, textos) {
  if (!status) return '';
  if (status === 'saving') return textos.saving;
  if (status === 'saved') return textos.saved;
  return textos.error;
}

// A região de status existe sempre (vazia quando não há status): um
// aria-live só anuncia o que muda depois de ele já estar na página.
export function BarraAcoesAvaliacao({ status, textosStatus, className, children }) {
  const textos = { ...TEXTOS_STATUS, ...textosStatus };
  const texto = textoDoStatus(status, textos);
  const classeStatus = status ? classes('save-indicator', status === 'saving' || status === 'saved' ? status : 'error') : null;
  return (
    <div className={classes('av-acoes', className)}>
      <span className={classes('av-acoes__status', classeStatus)} role="status" aria-live="polite">
        {status === 'saved' && <Check size={16} aria-hidden="true" />}
        {status && status !== 'saving' && status !== 'saved' && <AlertCircle size={16} aria-hidden="true" />}
        {texto}
      </span>
      {children}
    </div>
  );
}
