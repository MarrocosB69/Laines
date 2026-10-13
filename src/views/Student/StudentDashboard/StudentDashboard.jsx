import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  CalendarCheck,
  CalendarDays,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  CalendarPlus,
  ClipboardList,
  Link2,
  Info,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { toDateKey } from '../../../utils/dateUtils';

import {
  PainelVisaoGeral,
  PainelCabecalho,
  PainelIndicadores,
  PainelSecao,
  PainelLista,
  saudacaoPorHorario
} from '../../../components/painel/Painel';
import { FeedbackState } from '../../../components/ui';
import './StudentDashboard.css';

const CalendarWidget = ({ items }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
  const year = currentDate.getFullYear();

  const getDaysInMonth = (date) => {
    const yearValue = date.getFullYear();
    const monthValue = date.getMonth();
    return {
      days: new Date(yearValue, monthValue + 1, 0).getDate(),
      firstDay: new Date(yearValue, monthValue, 1).getDay()
    };
  };

  const { days, firstDay } = getDaysInMonth(currentDate);
  const today = new Date().getDate();
  const isCurrentMonth = new Date().getMonth() === currentDate.getMonth();

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
    setCurrentDate(new Date(newDate));
  };

  const appointmentsByDay = useMemo(() => {
    const map = new Map();
    (items || []).forEach((item) => {
      if (!item.dateObj) return;
      const key = toDateKey(item.dateObj);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [items]);

  const getDayKey = (day) => {
    const month = currentDate.getMonth() + 1;
    const yearValue = currentDate.getFullYear();
    return `${yearValue}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const statusLabel = {
    agendada: 'Agendada',
    remarcada: 'Remarcada',
    falta: 'Falta',
    realizada: 'Realizada'
  };

  return (
    <div className="student-calendar">
      <div className="student-calendar-header">
        <div className="student-calendar-title">
          <span className="month">{monthName}</span>
          <span className="year">{year}</span>
        </div>
        <div className="student-calendar-nav">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="student-calendar-grid">
        {weekDays.map((day) => (
          <div key={day} className="student-weekday">{day}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const isToday = isCurrentMonth && day === today;
          const key = getDayKey(day);
          const dayAppointments = appointmentsByDay.get(key) || [];
          const hasAppointments = dayAppointments.length > 0;
          const statusCounts = dayAppointments.reduce((acc, item) => {
            const status = item.status || 'agendada';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          const groupedStatuses = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count
          }));

          return (
            <div key={day} className={`student-calendar-day ${isToday ? 'today' : ''} ${hasAppointments ? 'has-event' : ''}`}>
              {day}
              {hasAppointments && (
                <>
                  <div className="student-event-dots">
                    {groupedStatuses.slice(0, 3).map((item) => (
                      <span key={item.status} className={`student-event-dot status-${item.status || 'agendada'}`}>
                        {item.count > 1 && <span className="student-dot-count">{item.count}</span>}
                      </span>
                    ))}
                  </div>
                  <div className="student-calendar-tooltip">
                    <strong>{`${dayAppointments.length} compromisso(s)`}</strong>
                    <ul>
                      {groupedStatuses.map((item) => (
                        <li key={item.status} className={`status-${item.status || 'agendada'}`}>
                          {item.count}x {statusLabel[item.status] || item.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
// UX-07 / CLI cadastro (UPD-18): decide o que a área "Meus Atletas" mostra
// quando não há pacientes para listar. `capabilities.atendimento` (UPD-12,
// server/src/auth/authorization.ts) já sabe o motivo — sem vínculo de
// supervisor/projeto, ou perfil que não atende — mas nenhuma tela lia esse
// campo antes desta entrega. Função pura (sem JSX, sem hooks) para que
// scripts/test-vinculo-atendimento.cjs possa provar que os quatro estados
// (erro de carregamento, sem vínculo, perfil sem atendimento, vazio
// legítimo) nunca colapsam na mesma saída. Decide só o texto; a autorização
// continua sendo decidida pelo servidor. Exportada (não só local) para que
// scripts/test-vinculo-atendimento.cjs possa importá-la sem duplicar a regra.
// eslint-disable-next-line react-refresh/only-export-components
export const resolveAthletesPanelState = ({ loading, error, atendimento, totalPacientes }) => {
  if (loading) {
    return { kind: 'loading' };
  }
  if (error) {
    return {
      kind: 'erro',
      title: 'Não foi possível carregar seus atletas',
      description: error
    };
  }
  const habilitado = Boolean(atendimento?.habilitado);
  if (!habilitado) {
    if (atendimento?.motivo === 'sem_vinculo') {
      return {
        kind: 'sem_vinculo',
        title: 'Habilitação para atendimento pendente',
        description: 'Para atender pacientes, você precisa de professor supervisor e projeto vinculados. Procure a coordenação do seu curso para vincular esses dados.'
      };
    }
    // motivo === 'perfil_sem_atendimento' (ou ausente): o papel da pessoa
    // não inclui atendimento clínico. A área não se apresenta como um
    // caminho a seguir — só explica e aponta para a Liga, sem convidar a
    // nenhuma ação que o servidor recusaria.
    return {
      kind: 'perfil_sem_atendimento',
      title: 'Este perfil não atende pacientes',
      description: 'Seu papel na liga não inclui atendimento clínico. Acompanhe atividades, materiais e resultados publicados nas áreas da Liga, no menu ao lado.'
    };
  }
  if (!totalPacientes) {
    return {
      kind: 'vazio',
      title: 'Nenhum atleta vinculado ainda.',
      description: 'Acesse "Meus Atletas" na barra lateral para adicionar o primeiro.'
    };
  }
  return { kind: 'lista' };
};

const getCurrentSemester = () => {
  const now = new Date();
  const year = now.getFullYear();
  const semester = now.getMonth() < 6 ? 1 : 2;
  return `${year}.${semester}`;
};

const StudentDashboard = ({ onSelectPatient, onAgendar, defaultViewMode = 'cards', showTips = true }) => {
  const {
    pacientes,
    loading,
    error: pacientesError,
    refreshPacientes,
    convertFirebaseDate,
    formatDate
  } = usePacientes();
  const { user, capabilities } = useAuth();
  const { notify } = useUiFeedback();
  const [viewMode, setViewMode] = useState(defaultViewMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [appointments, setAppointments] = useState([]);
  // Só distingue "ainda carregando" e "falhou" de "sem compromissos" na
  // Visão geral — a chamada a /agendamentos continua a mesma.
  const [agendaStatus, setAgendaStatus] = useState('carregando');

  const firstName = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const first = base.trim().split(/\s+/)[0];
    return first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}` : 'Estudante';
  }, [user]);

  const pacientesOrdenados = useMemo(() => {
    const filtered = pacientes.filter((p) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.nome?.toLowerCase().includes(term) ||
        p.cpf?.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
      );
    });
    return [...filtered].sort((a, b) => {
      const aDate = a.updatedAt || a.createdAt || a.dataCadastro || 0;
      const bDate = b.updatedAt || b.createdAt || b.dataCadastro || 0;
      return new Date(bDate) - new Date(aDate);
    });
  }, [pacientes, searchTerm]);

  // "O que precisa de você" não depende da busca de "Meus Atletas": as duas
  // ficam na mesma página, e com o filtro a seção esvaziava enquanto os
  // indicadores seguiam contando todos (revisão de 27/09/2026). Mesma
  // ordenação de pacientesOrdenados, sem o filtro da busca.
  const pacientesSemBusca = useMemo(() => [...pacientes].sort((a, b) => {
    const aDate = a.updatedAt || a.createdAt || a.dataCadastro || 0;
    const bDate = b.updatedAt || b.createdAt || b.dataCadastro || 0;
    return new Date(bDate) - new Date(aDate);
  }), [pacientes]);

  const panelState = useMemo(() => resolveAthletesPanelState({
    loading,
    error: pacientesError,
    atendimento: capabilities?.atendimento,
    totalPacientes: pacientesOrdenados.length
  }), [loading, pacientesError, capabilities, pacientesOrdenados.length]);

  const loadAppointments = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { data } = await api.get('/agendamentos', { params: { alunoId: user.uid } });
      const items = Array.isArray(data) ? data : [];
      const normalized = items.map((item) => ({
        ...item,
        dateObj: convertFirebaseDate(item.scheduledAt || item.date)
      }));
      setAppointments(normalized);
      setAgendaStatus('pronto');
    } catch (error) {
      setAppointments([]);
      setAgendaStatus('erro');
      notify({
        type: 'warning',
        title: 'Agenda indisponível',
        message: getApiErrorMessage(error, 'Não foi possível carregar os agendamentos agora.')
      });
    }
  }, [convertFirebaseDate, notify, user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const proximasAcoesItems = useMemo(() => {
    const items = [];
    const now = new Date();

    const upcoming = appointments
      .filter((a) => a.dateObj && a.dateObj >= now && (a.status || 'agendada') === 'agendada')
      .sort((a, b) => a.dateObj - b.dateObj)
      .slice(0, 5);

    for (const apt of upcoming) {
      items.push({
        id: `consulta-${apt.id}`,
        tipo: 'consulta',
        label: 'Consulta agendada',
        pacienteNome: apt.pacienteNome || 'Atleta',
        detalhe: `${formatDate(apt.dateObj)}${apt.time ? ` · ${apt.time}` : ''}`,
        onClick: () => {
          const patient = pacientesSemBusca.find((p) => p.id === apt.pacienteId);
          if (patient) onSelectPatient(patient);
        }
      });
    }

    const pendentes = pacientesSemBusca
      .filter((p) => (p.status || '').toLowerCase() === 'pendente')
      .slice(0, 5);

    for (const p of pendentes) {
      items.push({
        id: `avaliacao-${p.id}`,
        tipo: 'avaliacao',
        label: 'Avaliação pendente',
        pacienteNome: p.nome || 'Atleta',
        detalhe: null,
        onClick: () => onSelectPatient(p)
      });
    }

    return items;
  }, [appointments, pacientesSemBusca, formatDate, onSelectPatient]);

  // Visão geral: tudo abaixo é derivado de `pacientes` e `appointments`, que
  // já estavam carregados. Nenhuma chamada nova. O filtro de consultas
  // futuras é o mesmo de proximasAcoesItems, sem o corte em 5.
  const consultasFuturas = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((a) => a.dateObj && a.dateObj >= now && (a.status || 'agendada') === 'agendada')
      .sort((a, b) => a.dateObj - b.dateObj);
  }, [appointments]);

  const indicadores = useMemo(() => {
    // Ausência é nulo: sem acesso aos atletas (erro, sem vínculo, perfil sem
    // atendimento), o card mostra o motivo, nunca um zero.
    const motivoSemAtletas = {
      erro: 'Erro ao carregar',
      sem_vinculo: 'Vínculo pendente',
      perfil_sem_atendimento: 'Não se aplica ao seu perfil'
    }[panelState.kind];
    const ativos = pacientes.filter((p) => p.status === 'Ativo').length;
    const pendentes = pacientes.filter((p) => (p.status || '').toLowerCase() === 'pendente').length;
    const proxima = consultasFuturas[0];
    const agendaFalhou = agendaStatus === 'erro';
    return [
      {
        id: 'atletas',
        rotulo: 'Atletas vinculados',
        valor: motivoSemAtletas ? null : pacientes.length,
        detalhe: motivoSemAtletas
          || (pacientes.length === 0 ? 'Nenhum atleta vinculado ainda' : `${ativos} com status Ativo`),
        icone: Users,
        tom: 'neutro'
      },
      {
        id: 'consultas',
        rotulo: 'Consultas agendadas',
        valor: agendaFalhou ? null : consultasFuturas.length,
        detalhe: agendaFalhou
          ? 'Agenda indisponível'
          : proxima ? `Próxima: ${formatDate(proxima.dateObj)}` : 'Sem consultas futuras',
        icone: CalendarCheck,
        tom: 'neutro'
      },
      {
        id: 'pendentes',
        rotulo: 'Avaliações pendentes',
        valor: motivoSemAtletas ? null : pendentes,
        detalhe: motivoSemAtletas || (pendentes > 0 ? 'Atletas com status Pendente' : 'Nenhum atleta pendente'),
        icone: ClipboardList,
        tom: !motivoSemAtletas && pendentes > 0 ? 'atencao' : 'neutro'
      }
    ];
  }, [agendaStatus, consultasFuturas, formatDate, pacientes, panelState.kind]);

  // "O que precisa de você" mostra os mesmos itens de proximasAcoesItems.
  const precisaDeVoceItens = useMemo(() => proximasAcoesItems.map((item) => ({
    id: item.id,
    titulo: item.pacienteNome,
    subtitulo: item.label,
    meta: item.detalhe || undefined,
    icone: item.tipo === 'consulta' ? CalendarDays : ClipboardList,
    tom: item.tipo === 'avaliacao' ? 'atencao' : 'neutro',
    onClick: item.onClick
  })), [proximasAcoesItems]);

  const precisaDeVoceEstado = (loading || agendaStatus === 'carregando')
    ? 'carregando'
    : (pacientesError || agendaStatus === 'erro') && precisaDeVoceItens.length === 0
      ? 'erro'
      : precisaDeVoceItens.length === 0 ? 'vazio' : 'pronto';

  const tentarAgendaNovamente = () => {
    setAgendaStatus('carregando');
    loadAppointments();
  };

  // Busca, alternância cards/lista e selo do semestre: os mesmos controles de
  // antes, reaproveitados na Visão geral e na área "Meus Atletas".
  const buscaEAlternancia = (
    <>
      <div className="search-box">
        <input
          type="text"
          placeholder="Buscar atleta..."
          aria-label="Buscar atleta"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="view-toggle">
        <button
          className={`toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
          onClick={() => setViewMode('cards')}
          type="button"
          aria-pressed={viewMode === 'cards'}
        >
          <LayoutGrid size={16} /> Cards
        </button>
        <button
          className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
          type="button"
          aria-pressed={viewMode === 'list'}
        >
          <List size={16} /> Lista
        </button>
      </div>
    </>
  );

  const seloSemestre = (
    <div className="semester-badge">
      <CalendarCheck size={18} />
      Semestre {getCurrentSemester()}
    </div>
  );

  const conteudoAtletas = panelState.kind === 'loading' ? (
            <FeedbackState loading skeletonLines={4} />
          ) : panelState.kind === 'erro' ? (
            <FeedbackState
              error
              title={panelState.title}
              description={panelState.description}
              onRetry={refreshPacientes}
            />
          ) : panelState.kind === 'sem_vinculo' ? (
            <FeedbackState
              icon={Link2}
              title={panelState.title}
              description={panelState.description}
            />
          ) : panelState.kind === 'perfil_sem_atendimento' ? (
            <FeedbackState
              icon={Info}
              title={panelState.title}
              description={panelState.description}
            />
          ) : panelState.kind === 'vazio' ? (
            <FeedbackState
              empty
              icon={UserPlus}
              title={panelState.title}
              description={panelState.description}
            />
          ) : viewMode === 'list' ? (
            <div className="patients-list">
              {pacientesOrdenados.map((p) => (
                <div key={p.id} className="patient-list-item">
                  <button
                    type="button"
                    className="patient-list-item__info"
                    onClick={() => onSelectPatient(p)}
                  >
                    <div className="patient-avatar">
                      {p.nome?.charAt(0).toUpperCase() || 'P'}
                    </div>
                    <div className="patient-list-info">
                      <h4 className="patient-name">{p.nome || 'Atleta'}</h4>
                      <p className="last-visit">
                        {p.modalidade || `Cadastro: ${p.dataCadastroFormatada || '---'}`}
                      </p>
                    </div>
                  </button>
                  <span className={`status-badge ${p.status === 'Ativo' ? 'badge-ok' : 'badge-attention'}`}>
                    {p.status || 'Pendente'}
                  </span>
                  <div className="patient-list-item__actions">
                    <button
                      type="button"
                      className="pat-action-btn"
                      onClick={() => onSelectPatient(p)}
                      title="Abrir prontuário"
                      aria-label={`Abrir prontuário de ${p.nome || 'atleta'}`}
                    >
                      <ClipboardList size={14} />
                    </button>
                    {onAgendar && (
                      <button
                        type="button"
                        className="pat-action-btn"
                        onClick={() => onAgendar(p)}
                        title="Agendar consulta"
                        aria-label={`Agendar consulta para ${p.nome || 'atleta'}`}
                      >
                        <CalendarPlus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="patients-grid">
              {pacientesOrdenados.map((p) => (
                <div key={p.id} className="patient-card">
                  <button
                    type="button"
                    className="patient-card__body"
                    onClick={() => onSelectPatient(p)}
                  >
                    <div className={`card-decoration ${p.status === 'Ativo' ? 'decor-ok' : 'decor-attention'}`} />
                    <div className="card-top">
                      <div className="patient-avatar">
                        {p.nome?.charAt(0).toUpperCase() || 'P'}
                      </div>
                    </div>
                    <h4 className="patient-name">{p.nome || 'Atleta'}</h4>
                    <p className="last-visit">
                      {p.modalidade || `Cadastro: ${p.dataCadastroFormatada || '---'}`}
                    </p>
                    <div className={`status-badge ${p.status === 'Ativo' ? 'badge-ok' : 'badge-attention'}`}>
                      {p.status || 'Pendente'}
                    </div>
                  </button>
                  <div className="patient-card__actions">
                    <button
                      type="button"
                      className="pat-action-btn pat-action-btn--labeled"
                      onClick={() => onSelectPatient(p)}
                    >
                      <ClipboardList size={16} aria-hidden="true" />
                      <span>Prontuário</span>
                    </button>
                    {onAgendar && (
                      <button
                        type="button"
                        className="pat-action-btn pat-action-btn--labeled"
                        onClick={() => onAgendar(p)}
                      >
                        <CalendarPlus size={16} aria-hidden="true" />
                        <span>Agendar</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );

  // Área "Meus Atletas" (StudentView passa showTips=false): o mesmo layout de
  // antes, sem os blocos da Visão geral.
  if (!showTips) {
    return (
      <div className="student-dashboard">
        <div className="dashboard-header">
          <div className="welcome-text">
            <h1>Olá, {firstName}</h1>
            <p>Aqui estão seus atletas vinculados.</p>
          </div>
          <div className="header-actions">
            {buscaEAlternancia}
            {seloSemestre}
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <div className="section-header">
              <div className="section-icon icon-blue">
                <Users size={20} />
              </div>
              <h3 className="section-title">Meus Atletas</h3>
            </div>
            {conteudoAtletas}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-dashboard student-dashboard--painel">
      <PainelVisaoGeral>
        <PainelCabecalho
          saudacao={saudacaoPorHorario(new Date())}
          nome={firstName}
          papel="Estudante"
          data={new Date()}
          acoes={seloSemestre}
        />

        <PainelIndicadores
          rotulo="Indicadores"
          carregando={loading || agendaStatus === 'carregando'}
          itens={indicadores}
        />

        <PainelSecao
          id="precisa-de-voce"
          titulo="O que precisa de você"
          estado={precisaDeVoceEstado}
          vazio={{ titulo: 'Tudo em dia', descricao: 'Nenhuma pendência no momento.' }}
          erro={{
            mensagem: pacientesError
              ? 'Não foi possível carregar seus atletas'
              : 'Não foi possível carregar os agendamentos agora.',
            onTentarNovamente: pacientesError ? refreshPacientes : tentarAgendaNovamente
          }}
        >
          <PainelLista rotuloAcessivel="Próximas ações" itens={precisaDeVoceItens} />
        </PainelSecao>

        <PainelSecao
          id="agenda"
          titulo="Agenda"
          estado={agendaStatus}
          erro={{
            mensagem: 'Não foi possível carregar os agendamentos agora.',
            onTentarNovamente: tentarAgendaNovamente
          }}
        >
          <CalendarWidget items={appointments} />
        </PainelSecao>

        <PainelSecao
          id="meus-atletas"
          titulo="Meus Atletas"
          descricao="Aqui estão seus atletas vinculados."
          estado="pronto"
        >
          <div className="student-atletas-toolbar">{buscaEAlternancia}</div>
          {conteudoAtletas}
        </PainelSecao>
      </PainelVisaoGeral>
    </div>
  );
};

export default StudentDashboard;
