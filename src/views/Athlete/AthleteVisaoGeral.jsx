import React from 'react';
import {
  Activity, AlertTriangle, Apple, Calendar, ClipboardList, Droplets, Dumbbell
} from 'lucide-react';
import {
  PainelVisaoGeral,
  PainelCabecalho,
  PainelIndicadores,
  PainelSecao,
  PainelLista,
  saudacaoPorHorario
} from '../../components/painel/Painel';

// Visão geral do atleta (docs/implementacao/visao-geral-v2, decisão 2).
// Invariante 2 — nenhum dado a mais: tudo chega por props, já calculado pelo
// AthletePortal a partir de /pacientes, /avaliacoes e /agendamentos. Este
// componente não faz chamada nenhuma.

const LIMITE_AGENDA = 5;

// Rótulo textual do nível — a cor do tom nunca carrega o significado sozinha.
const NIVEL_ROTULO = { high: 'Prioritário', medium: 'Pendente', info: 'Informativo' };

const AthleteVisaoGeral = ({
  nome,
  pendingItems = [],
  hasCriticalPending = false,
  onPendingItemClick,
  nextAppointment,
  upcomingAppointments = [],
  getAppointmentTypeLabel,
  evaluationsCount = 0,
  latestEvaluationDateLabel,
  composicaoPanel,
  hidratacaoPanel,
  alimentacaoPanel,
  treinoPanel,
  loadingDetails = false,
  detailsError = false,
  onTentarNovamente,
  formatDate,
  onNavigate
}) => {
  const irPara = (area) => (onNavigate ? () => onNavigate(area) : undefined);
  const semRegistroDeAvaliacao = !latestEvaluationDateLabel || latestEvaluationDateLabel === 'Sem registro';

  // Ausência é nulo: se a agenda e as avaliações não carregaram, os cards
  // dizem isso em vez de mostrar zero.
  const indicadores = [
    {
      id: 'pendencias',
      rotulo: 'Pendências',
      valor: detailsError ? null : pendingItems.length,
      detalhe: detailsError
        ? 'Erro ao carregar'
        : hasCriticalPending ? 'Há itens que pedem sua ação' : 'Nenhum item prioritário',
      icone: AlertTriangle,
      tom: !detailsError && hasCriticalPending ? 'atencao' : 'neutro',
      onClick: irPara('pendencias')
    },
    {
      id: 'proxima-consulta',
      rotulo: 'Próxima consulta',
      valor: !detailsError && nextAppointment ? formatDate(nextAppointment.dateObj) : null,
      detalhe: detailsError
        ? 'Erro ao carregar'
        : nextAppointment ? (nextAppointment.time || undefined) : 'Sem consultas agendadas',
      icone: Calendar,
      tom: 'neutro',
      onClick: irPara('pendencias')
    },
    {
      id: 'avaliacoes',
      rotulo: 'Avaliações',
      valor: detailsError ? null : evaluationsCount,
      detalhe: detailsError ? 'Erro ao carregar' : evaluationsCount === 0 ? 'Nenhuma registrada' : undefined,
      icone: ClipboardList,
      tom: 'neutro'
    },
    {
      id: 'ultima-avaliacao',
      rotulo: 'Última avaliação',
      valor: detailsError || semRegistroDeAvaliacao ? null : latestEvaluationDateLabel,
      detalhe: detailsError ? 'Erro ao carregar' : semRegistroDeAvaliacao ? 'Sem registro' : undefined,
      icone: Activity,
      tom: 'neutro'
    }
  ];

  const acaoPara = (rotulo, area) => (onNavigate ? { rotulo, onClick: () => onNavigate(area) } : undefined);
  const estadoDetalhes = loadingDetails ? 'carregando' : detailsError ? 'erro' : null;
  const erroDetalhes = {
    mensagem: 'Não foi possível carregar agenda e avaliações.',
    onTentarNovamente
  };

  // Mesmos itens da aba Pendências; os que abrem formulário continuam abrindo.
  const itensPendencias = pendingItems.map((item) => ({
    id: item.id,
    titulo: item.title,
    subtitulo: item.description,
    meta: NIVEL_ROTULO[item.level],
    tom: item.level === 'info' ? 'neutro' : 'atencao',
    icone: AlertTriangle,
    onClick: item.action && onPendingItemClick ? () => onPendingItemClick(item) : undefined
  }));

  const itensAgenda = upcomingAppointments.slice(0, LIMITE_AGENDA).map((appointment, index) => ({
    id: appointment.id || `consulta-${index}`,
    titulo: `${formatDate(appointment.dateObj)}${appointment.time ? ` · ${appointment.time}` : ''}`,
    subtitulo: `Tipo: ${getAppointmentTypeLabel(appointment)}`,
    meta: 'Agendada',
    icone: Calendar
  }));

  // Resumo que leva ao Acompanhamento: só data e situação de revisão de cada
  // domínio, sem os valores clínicos, que continuam naquela aba.
  const itensAcompanhamento = [
    { id: 'composicao', titulo: 'Composição corporal', painel: composicaoPanel, icone: Activity },
    { id: 'hidratacao', titulo: 'Hidratação', painel: hidratacaoPanel, icone: Droplets },
    { id: 'alimentacao', titulo: 'Alimentação', painel: alimentacaoPanel, icone: Apple },
    { id: 'treino', titulo: 'Treino', painel: treinoPanel, icone: Dumbbell }
  ].map(({ id, titulo, painel, icone }) => ({
    id,
    titulo,
    icone,
    subtitulo: painel ? `Última: ${painel.dateLabel || '—'}` : 'A equipe ainda não realizou esta avaliação.',
    meta: painel?.aguardando ? 'Aguardando revisão' : painel?.revisado ? 'Revisado pela equipe' : undefined,
    onClick: irPara('acompanhamento')
  }));

  return (
    <PainelVisaoGeral>
      <PainelCabecalho
        saudacao={saudacaoPorHorario(new Date())}
        nome={nome}
        papel="Atleta"
        data={new Date()}
      />

      <PainelIndicadores rotulo="Indicadores" carregando={loadingDetails} itens={indicadores} />

      <PainelSecao
        id="precisa-de-voce"
        titulo="O que precisa de você"
        acao={acaoPara('Ver pendências', 'pendencias')}
        estado={estadoDetalhes || (itensPendencias.length === 0 ? 'vazio' : 'pronto')}
        vazio={{ titulo: 'Tudo em dia', descricao: 'Nenhuma pendência no momento.' }}
        erro={erroDetalhes}
      >
        <PainelLista rotuloAcessivel="Pendências" itens={itensPendencias} />
      </PainelSecao>

      <PainelSecao
        id="agenda"
        titulo="Agenda"
        acao={upcomingAppointments.length > LIMITE_AGENDA ? acaoPara('Ver todas', 'acompanhamento') : undefined}
        estado={estadoDetalhes || (itensAgenda.length === 0 ? 'vazio' : 'pronto')}
        vazio={{ titulo: 'Sem consultas agendadas.' }}
        erro={erroDetalhes}
      >
        <PainelLista rotuloAcessivel="Próximas consultas" itens={itensAgenda} />
      </PainelSecao>

      <PainelSecao
        id="acompanhamento"
        titulo="Meu acompanhamento"
        acao={acaoPara('Ver acompanhamento', 'acompanhamento')}
        estado={estadoDetalhes || 'pronto'}
        erro={erroDetalhes}
      >
        <PainelLista rotuloAcessivel="Meu acompanhamento" itens={itensAcompanhamento} />
      </PainelSecao>
    </PainelVisaoGeral>
  );
};

export default AthleteVisaoGeral;
