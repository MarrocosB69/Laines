import React from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../../services/api';
import { useSidebarAccessibility } from '../../hooks/useSidebarAccessibility';
import { getAcademicRootTab } from '../../constants/academicNavigation';
import SidebarHeader from '../../views/shared/SidebarHeader';
import SidebarFooter from '../../views/shared/SidebarFooter';
import ProfileSwitcher from '../../views/shared/ProfileSwitcher';
import '../../views/SidebarShell.css';
import '../../views/shared/sidebar-tokens.css';

import {
  LayoutDashboard, Users, UserCircle, FlaskConical, BookOpen, Users2, Megaphone,
  Inbox, FileText, Settings, GraduationCap, ShieldCheck, Calendar, CalendarDays,
  Landmark, Camera, Shield, ClipboardCheck, UserRound, TrendingUp, UserCog,
  ChevronLeft, ChevronRight
} from 'lucide-react';

// Nome (string) -> componente. sidebarModel.js guarda só o nome porque é
// JS puro, sem React; a resolução fica aqui, no único lugar que desenha.
const ICONES = {
  LayoutDashboard, Users, UserCircle, FlaskConical, BookOpen, Users2, Megaphone,
  Inbox, FileText, Settings, GraduationCap, ShieldCheck, Calendar, CalendarDays,
  Landmark, Camera, Shield, ClipboardCheck, UserRound, TrendingUp, ChevronLeft,
  // "Membros" na página única (WI-015): o mesmo ícone do cabeçalho do painel,
  // para não repetir o "Users" de "Meus Atletas"/"Alunos e Atletas".
  UserCog
};

const Icone = ({ nome, ...props }) => {
  const Comp = ICONES[nome];
  return Comp ? <Comp {...props} /> : null;
};

// Acento de cor e ícone/cor do bloco de identidade (sb-identity), por
// portal - mesma casca visual de hoje (StudentSideBar/ProfessorSidebar/
// TeamSidebar tinham cada um o seu; admin e atleta não têm o bloco).
const PORTAL_VISUAL = Object.freeze({
  admin: { acento: 'blue' },
  aluno: { acento: 'green', identidadeIcone: 'GraduationCap', identidadeCor: '#34d399' },
  professor: { acento: 'blue', identidadeIcone: 'GraduationCap', identidadeCor: '#60a5fa' },
  // TeamSidebar tinha um segundo par (verde) para o ramo "profissional"
  // (isMulti), inalcançável em /equipe - não reproduzido (ver relatório).
  equipe: { acento: 'blue', identidadeIcone: 'Shield', identidadeCor: '#a78bfa' },
  atleta: { acento: 'green' }
});

const FALLBACK_MENU_LABEL = 'Menu principal';

/**
 * Componente único das cinco sidebars: renderiza o modelo de
 * src/navigation/sidebarModel.js com o markup/classes laines-sidebar* de
 * hoje. As cinco *Sidebar.jsx viram invólucros finos que só buscam
 * user/capabilities, chamam buildSidebarModel e passam activeTab/isOpen/
 * onToggle/isMobile adiante - ver docs/implementacao/sidebars-v2/change-intent.md.
 */
const LainesSidebar = ({ portal, model, activeTab, setActiveTab, isOpen, onToggle, isMobile = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarId, sidebarRef, triggerRef } = useSidebarAccessibility(isMobile, isOpen);
  const { logout } = useAuth();
  const { notify } = useUiFeedback();

  const visual = PORTAL_VISUAL[portal] || PORTAL_VISUAL.admin;
  const isCollapsed = !isOpen && !isMobile;
  const shouldRenderSidebar = isMobile ? isOpen : true;
  const fecharNoCelular = () => { if (window.innerWidth <= 768 && isOpen) onToggle(); };

  const handleSelectTab = (id) => {
    setActiveTab(id);
    fecharNoCelular();
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha ao sair',
        message: getApiErrorMessage(error, 'Não foi possível sair do sistema.')
      });
    }
  };

  // As quatro variações de navegação que os atalhos de hoje usam, unificadas
  // num só lugar: destino simples, estado fixo (professor -> admin), estado
  // com o activeTab atual (admin -> aluno) ou leitura do estado de chegada
  // para montar a querystring (aluno -> presidência/admin).
  const handleAtalho = (atalho) => {
    if (atalho.lerRetornoDaLocalizacao) {
      const retorno = String(location.state?.returnAdminTab || 'dashboard');
      navigate(`/admin?tab=${encodeURIComponent(retorno)}`);
    } else if (atalho.usarActiveTabComoRetorno) {
      navigate(atalho.destino, { state: { returnAdminTab: activeTab || 'dashboard' } });
    } else if (atalho.estado) {
      navigate(atalho.destino, { state: atalho.estado });
    } else {
      navigate(atalho.destino);
    }
    fecharNoCelular();
  };

  const tooltipDoItem = (item) => {
    if (item.dica) return `${item.rotulo}: ${item.dica}`;
    if (item.aviso) return `${item.rotulo} (${item.aviso})`;
    return item.rotulo; // como antes: sem dica, a sidebar recolhida mostra só o nome
  };

  return (
    <>
      <motion.aside
        id={sidebarId}
        ref={sidebarRef}
        role={isMobile ? 'dialog' : undefined}
        aria-label={FALLBACK_MENU_LABEL}
        aria-modal={isMobile && isOpen ? true : undefined}
        aria-hidden={isMobile && !isOpen ? true : undefined}
        inert={isMobile && !isOpen ? true : undefined}
        tabIndex={-1}
        className={`laines-sidebar laines-sidebar--admin laines-sidebar--accent-${visual.acento} ${isCollapsed ? 'laines-sidebar--collapsed' : ''}`}
        initial={false}
        animate={{ x: shouldRenderSidebar ? 0 : -264 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="laines-sidebar__header">
          <div className="laines-sidebar__brand">
            <SidebarHeader roleLabel={model.papel.titulo} isCollapsed={isCollapsed} />
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="laines-sidebar__collapse"
            aria-label={isMobile ? 'Fechar menu' : isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            title={isMobile ? 'Fechar menu' : isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {isCollapsed ? <ChevronRight size={18} strokeWidth={1.8} /> : <ChevronLeft size={18} strokeWidth={1.8} />}
          </button>
        </div>

        {/* Bloco de identidade (sb-identity): só existia em aluno/professor/
            equipe - admin e atleta não têm, então só aparece quando o modelo
            traz subtitulo. */}
        {!isCollapsed && model.papel.subtitulo && (
          <div className="sb-identity">
            <div className="sb-identity__icon-box" aria-hidden="true">
              <Icone nome={visual.identidadeIcone} size={16} strokeWidth={1.8} color={visual.identidadeCor} />
            </div>
            <div>
              <p className="sb-identity__role">{model.papel.titulo}</p>
              <p className="sb-identity__profile-name">{model.papel.subtitulo}</p>
            </div>
          </div>
        )}

        <nav className="laines-sidebar__nav custom-scrollbar" aria-label="Navegação principal">
          {model.secoes.map((secao, indice) => (
            <React.Fragment key={secao.id}>
              <section className="laines-sidebar__section" aria-label={secao.titulo}>
                {!isCollapsed && <h3 className="laines-sidebar__section-title">{secao.titulo}</h3>}
                {isCollapsed && <div className="laines-sidebar__section-divider" aria-hidden="true" />}
                <div className="laines-sidebar__section-items">
                  {secao.itens.map((item) => {
                    const isActive = activeTab === item.id || getAcademicRootTab(activeTab) === item.id;
                    const filhos = Array.isArray(item.filhos) ? item.filhos : [];
                    const showChildren = !isCollapsed && isActive && filhos.length > 0;
                    return (
                      <React.Fragment key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectTab(item.id)}
                          className={`laines-sidebar__item ${isActive ? 'laines-sidebar__item--active' : ''}`}
                          // Aberta: sem aria-label, o nome vem do texto visível e inclui o
                          // aviso "Sem vínculo" e a contagem (um aria-label os calaria).
                          aria-label={isCollapsed ? tooltipDoItem(item) : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          title={isCollapsed ? undefined : item.rotulo}
                          data-tooltip={isCollapsed ? tooltipDoItem(item) : undefined}
                          aria-expanded={filhos.length > 0 ? showChildren : undefined}
                        >
                          <div className="laines-sidebar__item-icon" aria-hidden="true">
                            <Icone nome={item.icone} size={18} strokeWidth={1.8} />
                            {isCollapsed && item.seloPontoRecolhido && item.selo && (
                              <span className="laines-sidebar__badge laines-sidebar__badge--dot" aria-hidden="true" />
                            )}
                          </div>
                          {!isCollapsed && <span className="laines-sidebar__item-label">{item.rotulo}</span>}
                          {!isCollapsed && item.aviso && (
                            <span className="laines-sidebar__aviso">{item.aviso}</span>
                          )}
                          {!isCollapsed && item.selo && (
                            <span
                              className={`laines-sidebar__badge ${isActive ? 'laines-sidebar__badge--active' : ''}`}
                              aria-label={item.seloDescricao}
                            >
                              {item.selo}
                            </span>
                          )}
                          {isActive && <div className="laines-sidebar__item-indicator" aria-hidden="true" />}
                        </button>
                        {showChildren && (
                          <div className="laines-sidebar__subitems" role="group" aria-label={`${item.rotulo}: subsecoes`}>
                            {filhos.map((filho) => (
                              <button
                                key={filho.id}
                                type="button"
                                className={`laines-sidebar__subitem ${activeTab === filho.id ? 'laines-sidebar__subitem--active' : ''}`}
                                onClick={() => handleSelectTab(filho.id)}
                              >
                                <span className="laines-sidebar__subitem-dot" aria-hidden="true" />
                                <span>{filho.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                {!isCollapsed && secao.dica && (
                  <p className="laines-sidebar__aviso-dica">{secao.dica}</p>
                )}
              </section>
              {!isCollapsed && indice < model.secoes.length - 1 && (
                <div className="laines-sidebar__group-divider" aria-hidden="true" />
              )}
            </React.Fragment>
          ))}

          {/* Atalhos entre portais: colapsado vira um botão só com ícone
              (como o admin já fazia); expandido usa o ProfileSwitcher
              compartilhado. O rótulo acessível "Ir para X" agora é igual
              nos dois estados - antes o admin colapsado dizia "Abrir X",
              só o ProfileSwitcher (estado expandido) já dizia "Ir para X". */}
          {model.atalhos.map((atalho) => (
            <React.Fragment key={atalho.id}>
              {isCollapsed ? (
                <section className="laines-sidebar__section laines-sidebar__section--profile-switch" aria-label={atalho.rotulo}>
                  <div className="laines-sidebar__section-divider" aria-hidden="true" />
                  <div className="laines-sidebar__section-items">
                    <button
                      type="button"
                      onClick={() => handleAtalho(atalho)}
                      className="laines-sidebar__item laines-sidebar__item--profile-switch"
                      aria-label={`Ir para ${atalho.rotulo}`}
                      data-tooltip={`Ir para ${atalho.rotulo}`}
                    >
                      <div className="laines-sidebar__item-icon" aria-hidden="true">
                        <Icone nome={atalho.icone} size={18} strokeWidth={1.8} />
                      </div>
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="laines-sidebar__group-divider laines-sidebar__group-divider--profile" aria-hidden="true" />
                  <ProfileSwitcher
                    targetProfileLabel={atalho.rotulo}
                    targetProfileIcon={<Icone nome={atalho.icone} size={13} strokeWidth={2} color={atalho.cor} />}
                    onClick={() => handleAtalho(atalho)}
                    show
                  />
                </>
              )}
            </React.Fragment>
          ))}
        </nav>

        <SidebarFooter
          displayName={model.rodape.nome}
          userInitials={model.rodape.iniciais}
          onLogout={handleLogout}
          isCollapsed={isCollapsed}
        />

        {!isCollapsed && model.rodape.tag && <p className="sb-bottom-tag">{model.rodape.tag}</p>}
      </motion.aside>

      {isMobile && (
        <button
          type="button"
          onClick={onToggle}
          className="laines-sidebar__toggle"
          ref={triggerRef}
          hidden={isOpen}
          aria-expanded={isOpen}
          aria-controls={sidebarId}
          aria-haspopup="dialog"
          aria-label="Abrir menu"
        >
          <ChevronRight size={20} strokeWidth={1.8} />
        </button>
      )}
    </>
  );
};

export default LainesSidebar;
