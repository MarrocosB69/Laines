import React, { useMemo } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { paraNumero } from './historicoDeCampo';
import { ESTILO_SO_LEITOR } from '../base/apoio';

// O valor anterior importa no instante em que se digita o novo: e ele que
// responde "esse numero faz sentido?". Ate aqui ele morava numa faixa no topo
// da tela, a ~900px do campo, onde ja nao servia a ninguem durante o
// atendimento. Este modulo leva o contexto para junto do campo.
//
// O historico chega a todos os formularios via prop `moduleHistory` (ver
// AvaliacaoCompleta: formProps.moduleHistory), ordenado do mais novo para o
// mais antigo.

const formatarNumero = (n, casas = 1) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

// "em 3 meses" diz mais que uma data absoluta quando a pergunta e sobre ritmo
// de mudanca; abaixo de um mes a data seca informa melhor.
const distanciaLegivel = (data) => {
  if (!data) return '';
  const entao = new Date(data);
  if (Number.isNaN(entao.getTime())) return '';
  const agora = new Date();
  const dias = Math.round((agora.getTime() - entao.getTime()) / 86400000);
  if (dias < 1) return 'hoje';
  if (dias < 31) return `há ${dias} d`;

  // Mes de 30 dias arredondava para cima na fronteira: um intervalo de 3 meses
  // e meio virava "4 meses". Contar meses de calendario e o que a equipe le.
  let meses = (agora.getFullYear() - entao.getFullYear()) * 12
    + (agora.getMonth() - entao.getMonth());
  if (agora.getDate() < entao.getDate()) meses -= 1;
  if (meses < 1) return `há ${dias} d`;
  if (meses < 24) return `em ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  return `em ${anos} ${anos === 1 ? 'ano' : 'anos'}`;
};

/**
 * Dica inline com o valor anterior e a variacao.
 * Renderiza nada quando nao ha historico — campo novo nao ganha ruido.
 */
const ValorAnterior = ({ anterior, atual, casas = 1, unidade = '', melhorQuando = null }) => {
  const delta = useMemo(() => {
    const a = paraNumero(atual);
    if (a === null || !anterior || !Number.isFinite(anterior.valor)) return null;
    return a - anterior.valor;
  }, [anterior, atual]);

  if (!anterior || !Number.isFinite(anterior.valor)) return null;

  // O tom so aparece quando o modulo diz qual direcao e desejavel. Sem essa
  // informacao, colorir seria adivinhar o sentido clinico da mudanca.
  let tom = 'neutro';
  if (delta !== null && Math.abs(delta) > 0 && melhorQuando) {
    const bom = melhorQuando === 'menor' ? delta < 0 : delta > 0;
    tom = bom ? 'bom' : 'atencao';
  }

  const quando = distanciaLegivel(anterior.data);

  // O tom nao fica so na cor: um icone de forma propria acompanha a
  // variacao, e o leitor de tela ouve o sentido por extenso. O "Valor
  // anterior:" tambem e so para ele; quem ve tem a posicao junto do campo.
  // O estilo vai em linha porque esta peca aparece fora de `.av-modulo`.
  return (
    <span className={`valor-anterior tom-${tom}`}>
      <span style={ESTILO_SO_LEITOR}>Valor anterior: </span>
      <span className="valor-anterior__base">
        {formatarNumero(anterior.valor, casas)}{unidade}
      </span>
      {delta !== null && Math.abs(delta) >= 10 ** -casas && (
        <span className="valor-anterior__delta">
          {tom === 'bom' && <Check size={11} aria-hidden="true" />}
          {tom === 'atencao' && <TriangleAlert size={11} aria-hidden="true" />}
          {delta > 0 ? '+' : '−'}{formatarNumero(Math.abs(delta), casas)}{unidade}
          {tom === 'bom' && <span style={ESTILO_SO_LEITOR}> (na direção desejada)</span>}
          {tom === 'atencao' && <span style={ESTILO_SO_LEITOR}> (atenção: na direção oposta à desejada)</span>}
        </span>
      )}
      {quando && <span className="valor-anterior__quando">{quando}</span>}
    </span>
  );
};

export default ValorAnterior;
