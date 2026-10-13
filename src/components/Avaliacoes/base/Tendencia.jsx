import MiniSparkline from '../../shared/MiniSparkline';
import { classes } from './apoio';
import './avaliacao-base.css';

/* Cartão de tendência: o rótulo, o MiniSparkline compartilhado e um resumo
   em texto. Unifica os cinco cartões locais (BIA, Dobras, GET, Perímetros e
   Clínica), que diferem só no invólucro: `valores`, `alvo`, `largura` e
   `altura` vão para o MiniSparkline sem mudança (values, target, width,
   height), então a série desenhada é a mesma de antes.

   O gráfico fica escondido do leitor de tela (o SVG dele se anuncia só como
   "Tendencia"); quem não vê o traço ouve o resumo. A cor do traço vem do CSS
   (a regra de autor vence o atributo stroke do SVG). */

const numero = (v, casas) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas });

function resumoDaSerie({ valores, alvo, unidade, casas, rotuloAlvo }) {
  const serie = Array.isArray(valores) ? valores.filter((v) => Number.isFinite(v)) : [];
  // Mesmo texto do estado vazio do MiniSparkline.
  if (serie.length === 0) return 'Sem dados';
  const u = unidade ? ` ${unidade}` : '';
  const partes = serie.length === 1
    ? [`1 medição: ${numero(serie[0], casas)}${u}`]
    : [`${serie.length} medições`, `primeira ${numero(serie[0], casas)}${u}`, `última ${numero(serie[serie.length - 1], casas)}${u}`];
  if (Number.isFinite(alvo)) partes.push(`${rotuloAlvo} ${numero(alvo, casas)}${u}`);
  return `${partes.join('; ')}.`;
}

export function Tendencia({
  rotulo, valores, alvo = null, largura, altura, unidade, casas = 2, rotuloAlvo = 'linha de referência', className
}) {
  return (
    <figure className={classes('av-tendencia', className)}>
      <figcaption className="av-tendencia__rotulo">{rotulo}</figcaption>
      <div className="av-tendencia__grafico" aria-hidden="true">
        <MiniSparkline values={valores} target={alvo} width={largura} height={altura} />
      </div>
      <p className="av-sr">{resumoDaSerie({ valores, alvo, unidade, casas, rotuloAlvo })}</p>
    </figure>
  );
}
