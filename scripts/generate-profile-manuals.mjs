import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(repoRoot, 'e2e-artifacts');
const manualsRoot = path.join(repoRoot, 'docs', 'manuals', 'perfis');
const htmlDir = path.join(manualsRoot, 'html');
const pdfDir = path.join(manualsRoot, 'pdf');

const manualDate = '03/04/2026';

// ─── DADOS DOS MANUAIS ────────────────────────────────────────────────────────

const manuals = [
  // ═══════════════════════════════════════════════════════════
  //  ADMIN
  // ═══════════════════════════════════════════════════════════
  {
    profile: 'Admin',
    output: 'Manual_Perfil_Admin.pdf',
    objective:
      'Gerir a operacao completa da plataforma: membros, participantes, agendamentos, avaliacoes, relatorios e governanca. O Admin tem acesso irrestrito a todos os modulos e e o unico perfil capaz de eliminar registos do sistema.',
    sections: [
      {
        title: '1. Login e acesso ao sistema',
        description: 'O passo de entrada. Certifique-se de usar as credenciais de administracao.',
        steps: [
          'Aceda ao endereco da plataforma no browser (ex: http://localhost:5173 em desenvolvimento).',
          'Na tela de login, insira o e-mail e a senha da conta de administracao.',
          'Clique em "Entrar". O sistema valida o token JWT e redireciona automaticamente para /admin.',
          'Se aparecer a mensagem "Altere a sua senha", siga o fluxo obrigatorio antes de continuar.',
          'Apos o login, o Dashboard e a primeira tela exibida com indicadores gerais da plataforma.',
          'A sessao expira apos inatividade prolongada. O sistema redireciona para o login automaticamente.',
          'Em caso de credenciais invalidas, uma mensagem de erro e exibida e a tentativa e registada para auditoria.'
        ],
        notes: [
          { type: 'tip', text: 'Use um gestor de palavras-passe para manter as credenciais de admin seguras.' },
          { type: 'warning', text: 'Nunca partilhe as credenciais de admin. Cada utilizador deve ter a sua propria conta.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa9_login_modal_open.png', caption: 'Modal de login com campos de e-mail e password.' },
          { file: 'qa_run_20260402_1026_etapa9_login_modal_focus.png', caption: 'Campo de login com foco ativo e acessibilidade.' },
          { file: 'qa_run_20260402_1026_etapa1_login_invalido.png', caption: 'Mensagem de erro para credenciais invalidas.' }
        ]
      },
      {
        title: '2. Dashboard — painel de controlo',
        description: 'A visao central do Admin. Apresenta indicadores operacionais em tempo real e acesso rapido a todas as funcoes.',
        steps: [
          'Apos o login, o Dashboard carrega automaticamente com os indicadores do dia.',
          'Os cards no topo mostram totais de membros, participantes ativos, consultas agendadas e avaliacoes pendentes.',
          'A secao de alertas destaca acoes urgentes: solicitacoes de acesso pendentes, avaliacoes sem aprovacao, etc.',
          'Use a sidebar esquerda para navegar entre os modulos: Membros, Participantes, Solicitacoes, Projetos, Ensino, Extensao, Relatorios, Configuracoes.',
          'Clicar num card de indicador redireciona diretamente para o modulo correspondente com o filtro aplicado.',
          'O icone de notificacoes no header mostra alertas do sistema em tempo real.',
          'Para pesquisar qualquer registo rapidamente, use a barra de pesquisa global no topo do painel.'
        ],
        notes: [
          { type: 'tip', text: 'O Dashboard actualiza os dados automaticamente. Pode forcar uma actualizacao com F5 ou recarregando a pagina.' },
          { type: 'note', text: 'Cada subrole admin ve apenas as abas disponiveis para o seu cargo. Um Diretor de Marketing ve Dashboard e Relatorios; um Coord. Atendimento ve Dashboard, Extensao e Participantes.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-admin-dashboard.png', caption: 'Dashboard administrativo com indicadores operacionais em desktop.' },
          { file: 'qa_run_20260402_1026_etapa3_admin_dashboard_desktop.png', caption: 'Visao do painel admin em alta resolucao.' },
          { file: 'qa_run_20260402_1026_etapa10_admin_dashboard_desktop.png', caption: 'Dashboard com dados atualizados apos operacoes de QA.' }
        ]
      },
      {
        title: '3. Gestao de membros (utilizadores)',
        description: 'Criar, editar, pesquisar e gerir todos os utilizadores registados na plataforma.',
        steps: [
          'Na sidebar, clique em "Membros" para abrir a listagem completa de utilizadores.',
          'A tabela mostra: nome, e-mail, cargo/perfil, data de criacao e estado da conta.',
          'Use o campo de pesquisa para filtrar por nome ou e-mail. A pesquisa e instantanea (sem necessidade de premir Enter).',
          'Clique em "Carregar mais" no final da lista para ver mais registos (paginacao incremental).',
          'Para criar um novo membro, clique no botao "+ Novo Membro" no canto superior direito.',
          'No modal de criacao, preencha: nome completo, e-mail, cargo/role, e opcionalmente uma senha temporaria.',
          'Para editar um membro existente, clique no icone de lapiz na linha correspondente. Pode alterar nome, e-mail, cargo e estado.',
          'Para repor a senha de um membro, use o botao "Repor Senha" dentro do modal de edicao.',
          'Para desativar uma conta sem a eliminar, altere o estado para "Inativo" no campo de estado.',
          'So o perfil Admin pode eliminar permanentemente uma conta. Clique no icone de lixo e confirme a acao.'
        ],
        notes: [
          { type: 'warning', text: 'A eliminacao de um membro e irreversivel. Avalie desativar a conta em vez de eliminar.' },
          { type: 'tip', text: 'Ao criar um membro, o sistema envia automaticamente um e-mail de boas-vindas com instrucoes de acesso.' },
          { type: 'note', text: 'Roles disponiveis: admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento, professor, profissional, pesquisador, colaborador, aluno, tecnico, atleta.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa11_users_after_load_more.png', caption: 'Listagem de membros com carregamento incremental ativo.' },
          { file: 'qa_run_20260402_1026_etapa9_user_modal.png', caption: 'Modal de criacao/edicao de utilizador com todos os campos.' },
          { file: 'qa_run_20260402_1026_etapa10_user_modal_mobile.png', caption: 'Modal de utilizador em dispositivo movel.' }
        ]
      },
      {
        title: '4. Gestao de participantes (pacientes)',
        description: 'Registar, consultar e gerir todos os pacientes/atletas acompanhados pela instituicao.',
        steps: [
          'Na sidebar, clique em "Participantes" para abrir a lista de todos os pacientes.',
          'A lista suporta filtros por nome, CPF, estado e tipo de participante. Use a caixa de pesquisa no topo.',
          'Para criar um novo participante, clique em "+ Novo Participante" e preencha os dados obrigatorios: nome, data de nascimento, CPF (opcional) e responsavel.',
          'Para abrir o prontuario completo de um participante, clique no nome ou no icone de prontuario na linha.',
          'Dentro do prontuario, navegue pelas abas: Visao Geral, Avaliacoes, Consultas, Anexos e Mensagens.',
          'Para anexar documentos (PDF, PNG, JPG — limite 10MB), aceda a aba "Anexos" e arraste o ficheiro ou clique em "Enviar Ficheiro".',
          'Para editar dados demograficos, clique em "Editar Perfil" dentro do prontuario.',
          'O Admin pode eliminar um participante permanentemente. Esta acao remove todos os dados associados: avaliacoes, consultas e anexos.',
          'Para adicionar uma mensagem interna ao prontuario, use o campo "Nova Mensagem" na aba de mensagens — visivel apenas para a equipa clinica.'
        ],
        notes: [
          { type: 'warning', text: 'Eliminar um participante remove TODOS os dados clinicos associados. Esta acao nao pode ser revertida.' },
          { type: 'tip', text: 'Use o campo de notas internas para comunicar informacoes relevantes sobre o participante sem expor ao proprio.' },
          { type: 'note', text: 'Participantes do tipo "Atleta" tem um perfil adicional com dados esportivos acessiveis na aba de onboarding.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa6_prontuario_visao_geral.png', caption: 'Prontuario do participante — aba Visao Geral.' },
          { file: 'qa_run_20260402_1026_etapa6_prontuario_tab_avaliacoes.png', caption: 'Prontuario — aba Avaliacoes com historico completo.' },
          { file: 'qa_run_20260402_1026_etapa6_prontuario_tab_consultas.png', caption: 'Prontuario — aba Consultas com rastreabilidade.' }
        ]
      },
      {
        title: '5. Solicitacoes de acesso',
        description: 'Gerir os pedidos de acesso de novos utilizadores que se registaram pela pagina publica.',
        steps: [
          'Na sidebar, clique em "Solicitacoes" para ver os pedidos pendentes de aprovacao.',
          'Cada solicitacao mostra: nome do solicitante, e-mail, cargo pretendido, data do pedido e estado (pendente / aprovado / recusado).',
          'Para aprovar um pedido, clique em "Aprovar". Um modal aparece para confirmar e atribuir o cargo definitivo na plataforma.',
          'Pode alterar o cargo sugerido pelo utilizador antes de aprovar — por exemplo, mudar de "aluno" para "professor".',
          'Para recusar um pedido, clique em "Recusar" e opcionalmente insira uma justificacao que e enviada por e-mail ao solicitante.',
          'Pedidos aprovados criam automaticamente uma conta e enviam as credenciais de acesso ao utilizador.',
          'Para eliminar uma solicitacao sem responder, clique no icone de lixo.',
          'O badge de notificacao na sidebar mostra o numero de solicitacoes pendentes em tempo real.'
        ],
        notes: [
          { type: 'tip', text: 'Reveja o e-mail institucional do solicitante antes de aprovar — confirme que e um membro legitimo da instituicao.' },
          { type: 'note', text: 'Apos aprovacao, o utilizador recebe um e-mail automatico com as instrucoes de primeiro acesso.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa3_admin_dashboard_desktop.png', caption: 'Painel administrativo com acesso rapido ao modulo de Solicitacoes.' }
        ]
      },
      {
        title: '6. Agendamentos e consultas',
        description: 'Criar, visualizar, editar e remarcar consultas para todos os perfis.',
        steps: [
          'O modulo de agendamentos e acessivel a partir do prontuario do participante (aba Consultas) ou do menu de agenda do professor/aluno.',
          'Para criar um novo agendamento, clique em "+ Nova Consulta", selecione o participante, a data/hora, o profissional responsavel e o tipo de consulta.',
          'O sistema valida conflitos de horario automaticamente. Se houver sobreposicao, um aviso e exibido.',
          'Para editar um agendamento existente, abra-o e clique em "Editar". Pode alterar data, hora, profissional e observacoes.',
          'Para remarcar uma consulta, use o botao "Remarcar" dentro do agendamento. Um modal mostra os horarios disponiveis.',
          'Apos selecionar o novo horario, confirme a remarcacao. O historico de alteracoes e registado automaticamente.',
          'O Admin pode cancelar ou eliminar qualquer agendamento. Cancelamentos enviam notificacao automatica ao participante.',
          'Para ver todos os agendamentos do dia, filtre por data no topo da lista de consultas.'
        ],
        notes: [
          { type: 'tip', text: 'Use o filtro de data e profissional para gerir a agenda de forma eficiente em dias de grande volume.' },
          { type: 'note', text: 'A rastreabilidade de remarcacoes e mantida automaticamente no historico da consulta.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa4_modal_remarcacao_horario_livre.png', caption: 'Modal de remarcacao com horarios disponiveis em destaque.' },
          { file: 'qa_run_20260402_1026_etapa4_aluno_agenda_pos_remarcacao.png', caption: 'Agenda atualizada apos remarcacao com rastreabilidade.' }
        ]
      },
      {
        title: '7. Avaliacoes clinicas — criar e gerir',
        description: 'O Admin tem acesso completo a todos os tipos de avaliacao e pode criar, editar, rever e aprovar avaliacoes de qualquer participante.',
        steps: [
          'Para criar uma avaliacao, aceda ao prontuario do participante e clique em "+ Nova Avaliacao" na aba Avaliacoes.',
          'Selecione o tipo de avaliacao. Tipos disponiveis: Anamnese inicial, Bioimpedancia, Dobras Cutaneas, Perimetros Corporais, Composicao Corporal, Gasto Energetico, Avaliacao Clinica, Alimentar, Hidratacao, Socioeconomica (EBIA), Fisioterapia, Psicologia, Exames Laboratoriais, Evolucao/Retorno.',
          'Preencha os campos do formulario de avaliacao. Campos obrigatorios estao marcados com asterisco (*).',
          'Use o botao "Salvar rascunho" para guardar progresso sem finalizar a avaliacao.',
          'Quando concluido, clique em "Finalizar Avaliacao". A avaliacao fica marcada como "Concluida" e aparece no historico.',
          'Uma avaliacao finalizada pode ser reaberta para edicao clicando em "Reabrir". O sistema regista quem reabriu e quando.',
          'Para comparar evolucao ao longo do tempo, use o botao "Ver Historico" disponivel em avaliacoes com suporte longitudinal (ex: Bioimpedancia, Perimetros).',
          'O Admin pode eliminar uma avaliacao clicando em "Eliminar" — confirmacao obrigatoria.'
        ],
        notes: [
          { type: 'tip', text: 'A maioria das avaliacoes suporta comparacao longitudinal — consulte o historico para acompanhar a evolucao do participante.' },
          { type: 'note', text: 'Avaliacoes em rascunho nao aparecem nas pendencias do participante. Finalize para que fique visivel.' },
          { type: 'warning', text: 'Eliminar uma avaliacao remove todos os dados clinicos associados permanentemente.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa5_clinica_finalizada_reabertura.png', caption: 'Avaliacao clinica finalizada com opcao de reabertura.' },
          { file: 'qa_run_20260402_1026_etapa5_clinica_cenario_extremo.png', caption: 'Formulario de avaliacao clinica com cenario de dados extremos.' },
          { file: 'qa_run_20260402_1026_etapa5_perimetros_grupos_anatomicos.png', caption: 'Formulario de perimetros corporais por grupos anatomicos.' },
          { file: 'qa_run_20260402_1026_etapa5_alimentar_kcal_percentuais.png', caption: 'Avaliacao alimentar com calculos de kcal e percentuais.' },
          { file: 'qa_run_20260402_1026_etapa5_hidratacao_validacoes_e_resultados.png', caption: 'Avaliacao de hidratacao com validacoes e resultados calculados.' }
        ]
      },
      {
        title: '8. Relatorios e analise de dados',
        description: 'Consultar indicadores operacionais, gerar graficos de correlacao e exportar dados para analise externa.',
        steps: [
          'Na sidebar, clique em "Relatorios" para aceder ao modulo de analytics.',
          'O painel de visao geral (Overview) mostra: total de consultas, avaliacoes realizadas, taxa de conclusao e evolucao mensal.',
          'Use os filtros de periodo (por data inicio/fim) para restringir os dados ao intervalo desejado.',
          'Para filtrar por projeto ou profissional, use os dropdowns de contexto no topo do painel.',
          'O modulo "Correlacoes" permite cruzar variaveis clinicas — por exemplo, IMC vs. hidratacao — e gerar graficos interativos.',
          'Para exportar os dados, clique em "Exportar" e escolha o formato: CSV ou PDF.',
          'O historico de relatorios gerados fica guardado na aba "Historico de Exportacoes" para referencia futura.',
          'O resumo do Dashboard (/analytics/dashboard/summary) mostra os KPIs mais importantes de forma consolidada.'
        ],
        notes: [
          { type: 'tip', text: 'Exporte os dados para CSV para analise avancada em Excel ou ferramentas de BI.' },
          { type: 'note', text: 'Os graficos de correlacao sao interativos: passe o rato por cima dos pontos para ver os valores exatos.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-admin-relatorios.png', caption: 'Modulo de relatorios com indicadores operacionais.' },
          { file: 'qa_run_20260402_1026_etapa9_reports_page.png', caption: 'Pagina de relatorios com filtros de periodo aplicados.' },
          { file: 'qa_run_20260402_1026_etapa11_reports_runtime.png', caption: 'Relatorios com dados em tempo real durante execucao.' },
          { file: 'qa_run_20260402_1026_etapa10_reports_mobile.png', caption: 'Relatorios acessiveis em dispositivo movel.' }
        ]
      },
      {
        title: '9. Notificacoes',
        description: 'Criar e gerir notificacoes do sistema para comunicar com todos os utilizadores ou grupos especificos.',
        steps: [
          'Clique no icone de sino no header para abrir o painel de notificacoes.',
          'O painel mostra notificacoes recebidas ordenadas por data (mais recentes primeiro).',
          'Para criar uma nova notificacao, clique em "+ Nova Notificacao". Preencha titulo, mensagem e destinatarios (todos, por cargo ou por utilizador especifico).',
          'Pode definir o nivel de prioridade: Normal, Importante ou Urgente. Notificacoes urgentes aparecem com destaque visual.',
          'Para editar uma notificacao enviada (so Admin/Coord/Presidente/Vice), clique no icone de lapiz.',
          'Para eliminar, clique no icone de lixo e confirme. Notificacoes eliminadas desaparecem para todos os destinatarios.',
          'O badge numerico no icone de sino mostra quantas notificacoes nao foram lidas.'
        ],
        notes: [
          { type: 'tip', text: 'Use notificacoes urgentes para comunicar manutencao do sistema ou eventos criticos.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-admin-dashboard.png', caption: 'Header com icone de notificacoes e badge de contagem.' }
        ]
      },
      {
        title: '10. Uso em dispositivos moveis',
        description: 'A plataforma e totalmente responsiva. Em dispositivos moveis, a sidebar transforma-se num menu hamburger.',
        steps: [
          'Em telemovel ou tablet, a sidebar lateral fica oculta por defeito para poupar espaco.',
          'Toque no icone de menu (tres linhas) no canto superior esquerdo para abrir o menu de navegacao.',
          'Todas as funcionalidades estao disponiveis no mobile — navegue pelos modulos da mesma forma que no desktop.',
          'Para fechar o menu, toque fora da area do menu ou no icone X.',
          'Formularios de avaliacao em mobile adaptam-se ao ecra com campos em coluna unica para melhor usabilidade.',
          'Em tablet, o layout muda para modo intermedio: a sidebar pode estar visivel em modo compacto.',
          'Para acoes criticas (eliminar, aprovar solicitacoes), confirme sempre que esta no dispositivo correto antes de prosseguir.'
        ],
        notes: [
          { type: 'tip', text: 'Para acoes de gestao complexas (criar utilizadores, gerir relatorios), prefira usar o desktop para melhor visibilidade.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa10_admin_mobile_menu_open.png', caption: 'Menu de navegacao aberto em dispositivo movel.' },
          { file: 'qa_run_20260402_1026_etapa10_admin_dashboard_mobile.png', caption: 'Dashboard administrativo em ecra de telemovel.' },
          { file: 'qa_run_20260402_1026_etapa10_admin_dashboard_tablet.png', caption: 'Dashboard em modo tablet com layout intermediario.' },
          { file: 'qa_run_20260402_1026_etapa3_admin_mobile.png', caption: 'Painel admin em mobile — visao geral.' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  //  PRESIDENTE / VICE
  // ═══════════════════════════════════════════════════════════
  {
    profile: 'Presidente / Vice',
    output: 'Manual_Perfil_Presidente_Vice.pdf',
    objective:
      'Perfil com duplo acesso: gestao administrativa completa (equivalente ao Admin) e acesso ao portal academico de aluno para apoio operacional. Pode navegar entre os dois contextos sem necessidade de novo login.',
    sections: [
      {
        title: '1. Login e navegacao inicial',
        description: 'O login do Presidente/Vice redireciona para a area administrativa com visao de gestao completa.',
        steps: [
          'Aceda a plataforma e insira as credenciais de Presidente ou Vice.',
          'O sistema redireciona automaticamente para /admin — identico ao fluxo do Admin.',
          'No painel, todas as abas administrativas estao disponiveis: Membros, Participantes, Solicitacoes, Projetos, Ensino, Extensao, Relatorios, Configuracoes.',
          'O header mostra o cargo do utilizador (Presidente ou Vice) ao lado do nome.',
          'Para alternar para o contexto academico de aluno, use a opcao "Area do Aluno" na sidebar (explicado na secao 6).'
        ],
        notes: [
          { type: 'note', text: 'Presidente e Vice tem permissoes equivalentes ao Admin em toda a area de gestao, exceto na eliminacao de registos que pode estar restrita por politica da instituicao.' }
        ],
        screens: [
          { file: 'journey-audit/presidente.png', caption: 'Painel inicial do Presidente apos login.' },
          { file: 'manual-qa-20260403/bloco3-admin-dashboard.png', caption: 'Dashboard de gestao partilhado com o perfil Admin.' }
        ]
      },
      {
        title: '2. Gestao de membros e participantes',
        description: 'Gerir utilizadores e pacientes com os mesmos poderes do Admin.',
        steps: [
          'Na sidebar, aceda a "Membros" para ver e gerir todos os utilizadores da plataforma.',
          'Use pesquisa, filtros por cargo e paginacao para localizar perfis.',
          'Para criar um novo membro, clique em "+ Novo Membro" e preencha os dados e o cargo.',
          'Para editar ou repor senha, clique no icone de lapiz na linha do utilizador.',
          'Para gerir participantes (pacientes), aceda a "Participantes" na sidebar.',
          'O prontuario de cada participante e acessivel com historico completo de avaliacoes e consultas.'
        ],
        notes: [
          { type: 'tip', text: 'Como Presidente, e recomendado rever periodicamente os acessos concedidos para garantir que correspondem aos cargos atuais.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa11_users_after_load_more.png', caption: 'Lista de membros com carregamento incremental.' },
          { file: 'qa_run_20260402_1026_etapa9_user_modal.png', caption: 'Modal de gestao de utilizador.' }
        ]
      },
      {
        title: '3. Solicitacoes de acesso',
        description: 'Aprovar ou recusar pedidos de novos utilizadores — funcao identica ao Admin.',
        steps: [
          'Na sidebar, clique em "Solicitacoes" para ver os pedidos pendentes.',
          'Avalie cada pedido: nome, e-mail, cargo pretendido e data.',
          'Para aprovar, clique em "Aprovar" e confirme/ajuste o cargo a atribuir.',
          'Para recusar, clique em "Recusar" e opcionalmente insira uma justificacao.',
          'O badge de notificacao na sidebar indica o numero de pedidos pendentes.'
        ],
        notes: [
          { type: 'warning', text: 'Valide sempre a identidade do solicitante antes de aprovar o acesso.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-admin-dashboard.png', caption: 'Acesso rapido a solicitacoes pendentes no painel de gestao.' }
        ]
      },
      {
        title: '4. Relatorios e indicadores',
        description: 'Consultar e exportar relatorios operacionais e academicos.',
        steps: [
          'Na sidebar, clique em "Relatorios".',
          'Defina o periodo de analise com os filtros de data.',
          'Consulte os indicadores: consultas realizadas, avaliacoes concluidas, evolucao mensal.',
          'Use o modulo de Correlacoes para cruzar variaveis clinicas.',
          'Exporte em CSV ou PDF para partilhar com a diretoria.'
        ],
        notes: [
          { type: 'tip', text: 'Use os relatorios para preparar reunioes de diretoria com dados concretos da operacao.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-admin-relatorios.png', caption: 'Modulo de relatorios com indicadores de gestao.' },
          { file: 'qa_run_20260402_1026_etapa9_reports_page.png', caption: 'Pagina de relatorios com filtros aplicados.' }
        ]
      },
      {
        title: '5. Alternancia para a area do aluno',
        description: 'O Presidente/Vice pode entrar no portal academico para apoiar operacoes de agenda e avaliacao sem novo login.',
        steps: [
          'Na sidebar do painel administrativo, localize a opcao "Area do Aluno" (pode estar no fundo da sidebar ou num menu de alternancia).',
          'Ao clicar, o sistema guarda o contexto atual (aba em que estava) e redireciona para /aluno.',
          'No portal do aluno, tem acesso a: Dashboard, Meus Pacientes, Minha Agenda.',
          'As permissoes do aluno aplicam-se neste contexto — ou seja, ve e age como um aluno normal.',
          'Pode criar e editar avaliacoes dos pacientes vinculados, remarcar consultas, etc.',
          'Para retornar ao contexto administrativo, use "Voltar para Presidencia" na sidebar do portal aluno (secao 6).'
        ],
        notes: [
          { type: 'note', text: 'Este fluxo e util para o Presidente/Vice que tambem atua academicamente sem precisar de duas contas.' },
          { type: 'tip', text: 'O sistema memoriza a aba em que estava no admin para retornar exatamente ao mesmo ponto.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-aluno-dashboard.png', caption: 'Portal do aluno apos alternancia do perfil Presidente.' }
        ]
      },
      {
        title: '6. Agenda e remarcacao no contexto do aluno',
        description: 'Enquanto no portal do aluno, gerir a agenda e remarcar consultas.',
        steps: [
          'Dentro do portal aluno, clique em "Minha Agenda" na sidebar.',
          'A agenda mostra todas as consultas vinculadas ao Presidente/Vice no papel de aluno.',
          'Para remarcar uma consulta, selecione-a e clique em "Remarcar".',
          'Um modal apresenta os horarios disponiveis. Selecione a nova data e hora.',
          'Confirme a remarcacao. O historico e atualizado automaticamente com a rastreabilidade da alteracao.',
          'A consulta aparece na agenda com a nova data e um indicador de "Remarcado".'
        ],
        notes: [
          { type: 'tip', text: 'A remarcacao so e possivel se o prazo de antecedencia definido nas configuracoes for respeitado.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-aluno-remarcacao-modal.png', caption: 'Modal de remarcacao com horarios livres.' },
          { file: 'manual-qa-20260403/bloco2-aluno-agenda-pos-remarcacao.png', caption: 'Agenda atualizada apos remarcacao com rastreabilidade.' }
        ]
      },
      {
        title: '7. Retorno para a area administrativa',
        description: 'Voltar ao contexto de gestao com um clique, sem perder o contexto.',
        steps: [
          'Na sidebar do portal do aluno, localize o botao "Voltar para Presidencia" (ou "Voltar para Admin").',
          'Ao clicar, o sistema redireciona para /admin, abrindo exatamente a aba em que estava antes de mudar para o aluno.',
          'O contexto administrativo e restaurado completamente — dados, filtros e posicao na lista sao mantidos.',
          'Continue a operacao de gestao normalmente.'
        ],
        notes: [
          { type: 'note', text: 'Se fechar o browser e voltar a abrir, o sistema redireciona para a area administrativa por defeito.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-admin-relatorios.png', caption: 'Contexto administrativo restaurado apos retorno do portal aluno.' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  //  PROFESSOR
  // ═══════════════════════════════════════════════════════════
  {
    profile: 'Professor',
    output: 'Manual_Perfil_Professor.pdf',
    objective:
      'Acompanhar pacientes e alunos, gerir a agenda de atendimentos, aceder ao prontuario clinico completo e adicionar feedback de supervisao. O Professor nao tem acesso a gestao administrativa do sistema.',
    sections: [
      {
        title: '1. Login e painel inicial',
        description: 'Apos o login, o Professor acede ao seu painel personalizado com visao dos pacientes e da agenda.',
        steps: [
          'Aceda a plataforma e insira as credenciais de professor/profissional/pesquisador/colaborador.',
          'O sistema redireciona automaticamente para /professor.',
          'O painel inicial mostra: total de pacientes em acompanhamento, proximas consultas e pendencias ativas.',
          'A sidebar mostra os modulos disponiveis: Visao Geral, Alunos e Pacientes, Agenda, Pesquisas.',
          'O header mostra o nome do professor e as notificacoes nao lidas.'
        ],
        notes: [
          { type: 'note', text: 'O Professor nao tem acesso ao painel de gestao administrativa (/admin).' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-professor-dashboard-desktop.png', caption: 'Dashboard do professor com visao geral em desktop.' },
          { file: 'qa_run_20260402_1026_etapa3_professor_dashboard_desktop.png', caption: 'Painel do professor em alta resolucao.' }
        ]
      },
      {
        title: '2. Lista de alunos e pacientes',
        description: 'Ver e gerir todos os pacientes sob supervisao do professor.',
        steps: [
          'Na sidebar, clique em "Alunos e Pacientes".',
          'A lista mostra os pacientes vinculados ao professor, com nome, aluno responsavel e ultima consulta.',
          'Use o campo de pesquisa para filtrar por nome de paciente ou aluno.',
          'Clique num paciente para abrir o prontuario completo.',
          'Para criar um novo paciente, clique em "+ Novo Paciente" e preencha os dados.',
          'Para adicionar uma mensagem de supervisao a um paciente, aceda ao prontuario e use o campo de "Mensagem do Professor" na aba correspondente.'
        ],
        notes: [
          { type: 'note', text: 'O Professor ve apenas os pacientes vinculados a si ou aos alunos que supervisiona.' },
          { type: 'tip', text: 'Use o filtro por aluno para acompanhar a carga de trabalho de cada aluno sob supervisao.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa6_professor_prontuario_visao_geral.png', caption: 'Prontuario do paciente na perspetiva do professor.' },
          { file: 'qa_run_20260402_1026_etapa6_professor_prontuario_visao_geral_top.png', caption: 'Cabecalho do prontuario com dados demograficos e indicadores.' }
        ]
      },
      {
        title: '3. Prontuario clinico do paciente',
        description: 'Aceder ao historico clinico completo de cada paciente: avaliacoes, consultas, anexos e evolucao.',
        steps: [
          'Abra um paciente a partir da lista de Alunos e Pacientes.',
          'O prontuario abre na aba "Visao Geral" com dados demograficos, indicadores de saude e resumo clinico.',
          'Navegue para a aba "Avaliacoes" para ver todas as avaliacoes realizadas, com status (concluida, rascunho, pendente).',
          'Clique numa avaliacao para ver os detalhes completos e os dados registados.',
          'Na aba "Consultas", veja o historico de agendamentos com rastreabilidade de remarcacoes.',
          'Na aba "Anexos", visualize e descarregue os documentos do paciente.',
          'Para acompanhar evolucao longitudinal, use o botao "Ver Historico" em avaliacoes que suportam comparacao.',
          'Para marcar uma avaliacao como "Pendente de Revisao", use a opcao correspondente dentro da avaliacao.'
        ],
        notes: [
          { type: 'tip', text: 'A aba Visao Geral e o melhor ponto de partida antes de uma consulta de supervisao — da uma visao rapida do estado do paciente.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-professor-prontuario.png', caption: 'Prontuario do paciente — visao completa no perfil professor.' },
          { file: 'qa_run_20260402_1026_etapa6_prontuario_tab_avaliacoes.png', caption: 'Aba de avaliacoes com historico e status de cada registo.' },
          { file: 'qa_run_20260402_1026_etapa6_prontuario_tab_consultas.png', caption: 'Aba de consultas com rastreabilidade completa.' }
        ]
      },
      {
        title: '4. Acompanhamento de avaliacoes',
        description: 'Rever, supervisionar e criar avaliacoes clinicas dos pacientes.',
        steps: [
          'Para criar uma avaliacao, aceda ao prontuario do paciente e clique em "+ Nova Avaliacao".',
          'Selecione o tipo de avaliacao (Anamnese, Antropometria, Alimentar, Hidratacao, Clinica, etc.).',
          'Preencha os campos e clique em "Salvar" ou "Finalizar".',
          'Para rever uma avaliacao criada por um aluno, abra-a e verifique os dados preenchidos.',
          'Se necessitar de correcoes, clique em "Reabrir" para editar (o historico de quem reabriu e registado).',
          'Para registar feedback, use o campo de notas internas dentro da avaliacao.',
          'A evolucao de dados como perimetros e bioimpedancia pode ser vista graficamente clicando em "Ver Historico".'
        ],
        notes: [
          { type: 'note', text: 'O Professor pode criar avaliacoes incluindo o tipo "atleta" se tiver atletas vinculados.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa5_clinica_finalizada_reabertura.png', caption: 'Avaliacao clinica com reabertura disponivel para supervisao.' },
          { file: 'qa_run_20260402_1026_etapa6_rastreabilidade_hidratacao_detalhe.png', caption: 'Detalhe de rastreabilidade na avaliacao de hidratacao.' }
        ]
      },
      {
        title: '5. Agenda e supervisoes',
        description: 'Gerir o calendario de consultas e supervisoes com os alunos.',
        steps: [
          'Na sidebar, clique em "Agenda" para ver o calendario de consultas.',
          'A agenda mostra todas as consultas vinculadas ao professor, organizadas por data e hora.',
          'Clique numa consulta para ver os detalhes: participante, aluno responsavel, tipo, status.',
          'Para criar uma nova consulta, clique em "+ Nova Consulta" e selecione participante, data/hora e tipo.',
          'Para editar uma consulta, abra-a e clique em "Editar".',
          'A agenda regista automaticamente o historico de alteracoes e remarcacoes para rastreabilidade.'
        ],
        notes: [
          { type: 'tip', text: 'Use os filtros da agenda (por aluno, por data, por estado) para gerir periodos de maior volume.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-professor-agenda.png', caption: 'Agenda do professor com consultas e supervisoes.' },
          { file: 'qa_run_20260402_1026_etapa4_professor_agenda_persistencia.png', caption: 'Agenda com persistencia de dados apos remarcacao.' }
        ]
      },
      {
        title: '6. Mensagens de supervisao',
        description: 'Adicionar feedback estruturado ao prontuario de um paciente visivel apenas para a equipa.',
        steps: [
          'Aceda ao prontuario do paciente.',
          'Localize a aba "Mensagens" ou a secao "Mensagem do Professor".',
          'Clique em "+ Adicionar Mensagem" e escreva o feedback de supervisao.',
          'O sistema regista a data, hora e nome do professor que adicionou a mensagem.',
          'As mensagens de supervisao sao visiveis para Admin, Coord e outros professores, mas NAO para o atleta/paciente.',
          'Para editar uma mensagem, clique no icone de lapiz. Para eliminar, clique no icone de lixo.'
        ],
        notes: [
          { type: 'warning', text: 'Mensagens de supervisao sao internas. Nao inclua informacoes que nao devam ser vistas pela equipa.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa6_professor_prontuario_visao_geral.png', caption: 'Prontuario onde as mensagens de supervisao sao adicionadas.' }
        ]
      },
      {
        title: '7. Uso em dispositivos moveis',
        description: 'O portal do professor e totalmente responsivo para uso em telemovel e tablet.',
        steps: [
          'Em telemovel, a sidebar aparece como menu hamburger no canto superior esquerdo.',
          'Toque no icone de menu para navegar entre modulos.',
          'A lista de pacientes, agenda e prontuarios sao acessiveis no mobile.',
          'Para acoes rapidas entre consultas, o mobile e ideal para verificar o estado de um paciente ou a agenda do dia.',
          'Formularios de avaliacao adaptam-se ao ecra com campos em coluna unica.'
        ],
        notes: [
          { type: 'tip', text: 'Use o mobile para consultar a agenda e o prontuario durante as rondas clinicas.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa3_professor_mobile.png', caption: 'Portal do professor em dispositivo movel.' },
          { file: 'journey-audit/professor-mobile.png', caption: 'Painel do professor em mobile — visao de jornada.' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  //  ALUNO
  // ═══════════════════════════════════════════════════════════
  {
    profile: 'Aluno',
    output: 'Manual_Perfil_Aluno.pdf',
    objective:
      'Conduzir o atendimento academico completo: gerir pacientes vinculados, realizar avaliacoes clinicas de todos os tipos, gerir a agenda e remarcar consultas. O Aluno ve apenas os pacientes que criou ou aos quais foi atribuido.',
    sections: [
      {
        title: '1. Login e primeiro acesso',
        description: 'Entrar na plataforma e entender o ambiente do aluno.',
        steps: [
          'Aceda a plataforma e insira as credenciais de aluno.',
          'Se for o primeiro acesso, pode aparecer um modal de mudanca de senha obrigatoria. Siga as instrucoes.',
          'Apos o login, o sistema redireciona para /aluno com o Dashboard personalizado.',
          'Se aparecer um modal de "Completar Perfil", preencha os dados solicitados antes de continuar.',
          'O Dashboard mostra: pacientes vinculados, proxima consulta, avaliacoes pendentes e atalhos rapidos.',
          'A sidebar tem os modulos: Visao Geral, Meus Pacientes, Minha Agenda.'
        ],
        notes: [
          { type: 'warning', text: 'Se o modal de mudanca de senha bloquear o acesso, complete o fluxo antes de tentar aceder a outros modulos.' },
          { type: 'note', text: 'Alunos com cargo Presidente ou Vice tem tambem acesso ao painel admin (ver secao 9).' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-aluno-dashboard.png', caption: 'Dashboard do aluno com resumo de atividades.' },
          { file: 'qa_run_20260402_1026_etapa3_aluno_dashboard_desktop.png', caption: 'Painel do aluno em desktop.' },
          { file: 'qa_run_20260402_1026_etapa1_aluno_dashboard_sem_modal_v2.png', caption: 'Dashboard limpo apos conclusao do perfil.' }
        ]
      },
      {
        title: '2. Gestao de pacientes',
        description: 'Criar, editar e aceder ao prontuario dos pacientes vinculados.',
        steps: [
          'Na sidebar, clique em "Meus Pacientes" para ver a lista de pacientes sob a sua responsabilidade.',
          'A lista mostra nome, data de nascimento, ultima avaliacao e status do prontuario.',
          'Use o campo de pesquisa para filtrar por nome.',
          'Para criar um novo paciente, clique em "+ Novo Paciente". Preencha: nome completo, data de nascimento, CPF (opcional) e tipo (participante / atleta).',
          'Apos criar, o paciente aparece na lista e pode ser editado ou acedido a qualquer momento.',
          'Para editar dados de um paciente, abra o prontuario e clique em "Editar Perfil".',
          'Para ver o prontuario completo, clique no nome do paciente na lista.'
        ],
        notes: [
          { type: 'note', text: 'O Aluno so ve os pacientes que criou ou aos quais foi atribuido pelo professor ou admin.' },
          { type: 'tip', text: 'Mantenha os dados demograficos atualizados — sao usados nos calculos de avaliacoes (IMC, gasto energetico, etc.).' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa2_aluno_meus_pacientes.png', caption: 'Lista de pacientes do aluno com filtro ativo.' },
          { file: 'qa_run_20260402_1026_etapa2_aluno_agenda_com_cadastro_completo.png', caption: 'Vista da agenda apos cadastro completo do paciente.' }
        ]
      },
      {
        title: '3. Prontuario do paciente — navegacao',
        description: 'O prontuario e o centro de toda a informacao clinica do paciente.',
        steps: [
          'Abra um paciente na lista de Meus Pacientes.',
          'O prontuario abre na aba "Visao Geral": dados demograficos, indicadores de saude, resumo das ultimas avaliacoes.',
          'Navegue para "Avaliacoes" para ver o historico completo com status de cada registo.',
          'A aba "Consultas" mostra o historico de agendamentos e remarcacoes.',
          'A aba "Anexos" permite visualizar e carregar documentos clinicos do paciente.',
          'Clique em qualquer avaliacao para ver os dados completos registados.',
          'Para iniciar uma nova avaliacao, clique em "+ Nova Avaliacao" na aba Avaliacoes.',
          'O botao "Ver Historico" (disponivel em certas avaliacoes) mostra a evolucao longitudinal em grafico.'
        ],
        notes: [
          { type: 'tip', text: 'Comece sempre pela Visao Geral antes de iniciar uma nova avaliacao — ajuda a contextualizar o estado atual do paciente.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-aluno-prontuario-visao-geral.png', caption: 'Prontuario do paciente — aba Visao Geral no contexto do aluno.' },
          { file: 'qa_run_20260402_1026_etapa6_prontuario_tab_avaliacoes.png', caption: 'Aba de avaliacoes com historico e indicadores de status.' }
        ]
      },
      {
        title: '4. Avaliacoes — Anamnese e Antropometria',
        description: 'Preencher os formularios de anamnese inicial e medicoes antropometricas.',
        steps: [
          'No prontuario do paciente, clique em "+ Nova Avaliacao" e selecione o tipo.',
          '** Anamnese Inicial **: Preencha historico clinico, queixas, habitos de vida, historico familiar e condicoes preexistentes. Salve com "Finalizar Anamnese".',
          '** Bioimpedancia **: Insira dados do aparelho (massa gorda, massa magra, % gordura, agua total). O sistema calcula o IMC e classifica automaticamente.',
          '** Dobras Cutaneas **: Insira as medidas de cada dobra (tricipital, subescapular, etc.). O sistema calcula o % de gordura pelo protocolo selecionado.',
          '** Perimetros Corporais **: Insira as medidas de perimetro por grupos anatomicos (cintura, abdomen, quadril, braco, etc.).',
          '** Composicao Corporal **: Combinacao de dados de bioimpedancia e perimetros para calculo integrado.',
          '** Gasto Energetico **: Calcule o GEB e o GET baseado em peso, altura, idade, sexo e nivel de atividade fisica.',
          'Todos os formularios permitem salvar como rascunho antes de finalizar.'
        ],
        notes: [
          { type: 'note', text: 'A data de nascimento e o sexo do paciente sao usados nos calculos automaticos. Verifique se estao corretos antes de preencher.' },
          { type: 'tip', text: 'Use "Salvar Rascunho" se nao tiver todos os dados disponiveis — pode retomar depois sem perder o progresso.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa5_perimetros_grupos_anatomicos.png', caption: 'Formulario de perimetros por grupos anatomicos.' },
          { file: 'manual-qa-20260403/bloco2-aluno-avaliacao-completa.png', caption: 'Avaliacao clinica completa com salvamento e reabertura.' }
        ]
      },
      {
        title: '5. Avaliacoes — Alimentar, Hidratacao e Clinica',
        description: 'Registar e analisar os habitos alimentares, hidratacao e o estado clinico do paciente.',
        steps: [
          '** Avaliacao Alimentar **: Registe o consumo alimentar por refeicao (desjejum, almoco, jantar, lanches). O sistema calcula automaticamente as kcal totais e os macronutrientes com percentuais.',
          '** Avaliacao de Hidratacao **: Insira o consumo diario de agua e bebidas. O sistema calcula o nivel de hidratacao e exibe alertas de deficit.',
          '** Avaliacao Clinica **: Registe sinais vitais (PA, FC, temperatura), condicoes clinicas observadas, medicamentos em uso e evolucao clinica.',
          'Para a avaliacao alimentar, use o campo de notas livres para registar padroes nao estruturados.',
          'Avaliacao clinica suporta cenarios extremos — o sistema valida os valores inseridos e alerta para valores fora do range normal.',
          'Apos finalizar, os dados ficam disponiveis para comparacao no modulo de historico.'
        ],
        notes: [
          { type: 'tip', text: 'Na avaliacao alimentar, os percentuais de macronutrientes sao calculados automaticamente — nao e necessario calcular manualmente.' },
          { type: 'note', text: 'A avaliacao de hidratacao usa o peso corporal atual do paciente. Certifique-se de que a bioimpedancia ou o peso foi registado primeiro.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa5_alimentar_kcal_percentuais.png', caption: 'Avaliacao alimentar com kcal e macronutrientes calculados.' },
          { file: 'qa_run_20260402_1026_etapa5_hidratacao_validacoes_e_resultados.png', caption: 'Avaliacao de hidratacao com validacoes e resultados.' },
          { file: 'qa_run_20260402_1026_etapa5_clinica_cenario_extremo.png', caption: 'Avaliacao clinica com alerta para valores extremos.' },
          { file: 'qa_run_20260402_1026_etapa6_rastreabilidade_hidratacao_detalhe.png', caption: 'Detalhe de rastreabilidade de hidratacao no historico.' }
        ]
      },
      {
        title: '6. Avaliacoes — Fisioterapia, Psicologia, Exames e Evolucao',
        description: 'Modulos complementares para avaliacao multiprofissional e acompanhamento longitudinal.',
        steps: [
          '** Fisioterapia **: Registe avaliacao funcional, amplitude de movimento, testes especificos e plano de tratamento. Indicado para casos com restricoes fisicas.',
          '** Psicologia **: Registe avaliacao psicologica estruturada com instrumentos padronizados (acesso restrito ao profissional habilitado).',
          '** Exames Laboratoriais **: Insira os resultados de exames de sangue, urina e outros. O sistema compara com valores de referencia e destaca alteracoes.',
          '** Evolucao / Retorno **: Registe a evolucao do paciente em relacao as avaliacoes anteriores. Use este tipo para consultas de retorno onde o foco e comparar antes/depois.',
          'Todas estas avaliacoes suportam notas livres para observacoes nao estruturadas.',
          'Apos finalizar, as avaliacoes ficam visiveis no prontuario para o professor revisar.'
        ],
        notes: [
          { type: 'warning', text: 'A avaliacao de psicologia deve ser preenchida apenas por profissional habilitado. Nao preencha fora da sua area de formacao.' },
          { type: 'tip', text: 'Use a Evolucao/Retorno como avaliacao principal nas consultas de acompanhamento — e mais rapida e foca nas mudancas em relacao ao baseline.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa5_clinica_finalizada_reabertura.png', caption: 'Avaliacao finalizada com opcao de reabertura para correcoes.' }
        ]
      },
      {
        title: '7. Agenda — visualizar e criar consultas',
        description: 'Gerir o calendario de consultas dos pacientes vinculados.',
        steps: [
          'Na sidebar, clique em "Minha Agenda".',
          'A agenda mostra todas as consultas vinculadas ao aluno por data e hora.',
          'Clique numa consulta para ver os detalhes: participante, tipo de consulta, status, notas.',
          'Para criar uma nova consulta, clique em "+ Nova Consulta". Selecione o participante, data, hora e tipo.',
          'O sistema verifica conflitos de horario automaticamente.',
          'Pode aceder ao prontuario do paciente diretamente a partir de uma consulta na agenda.'
        ],
        notes: [
          { type: 'tip', text: 'Use o filtro de data para ver apenas as consultas de hoje ou da semana.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa2_aluno_agenda_com_cadastro_completo.png', caption: 'Agenda do aluno com consultas apos cadastro completo.' }
        ]
      },
      {
        title: '8. Remarcacao de consultas',
        description: 'Alterar a data e hora de uma consulta ja agendada.',
        steps: [
          'Na "Minha Agenda", localize a consulta a remarcar.',
          'Clique na consulta para abrir os detalhes.',
          'Clique em "Remarcar". Um modal abre com o calendario de horarios disponiveis.',
          'Os horarios ocupados aparecem em cinzento — selecione apenas os horarios em verde (livres).',
          'Selecione a nova data e hora e confirme clicando em "Confirmar Remarcacao".',
          'A consulta e atualizada na agenda com a nova data e um indicador de remarcacao.',
          'O historico de alteracoes e registado automaticamente para rastreabilidade.'
        ],
        notes: [
          { type: 'warning', text: 'A remarcacao tem um prazo de antecedencia minimo definido pelo sistema. Nao e possivel remarcar com menos de X horas de antecedencia.' },
          { type: 'note', text: 'Apos a remarcacao, o participante (atleta) recebe uma notificacao automatica com a nova data.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco2-aluno-remarcacao-modal.png', caption: 'Modal de remarcacao com horarios livres disponiveis.' },
          { file: 'manual-qa-20260403/bloco2-aluno-agenda-pos-remarcacao.png', caption: 'Agenda atualizada apos remarcacao com rastreabilidade.' },
          { file: 'qa_run_20260402_1026_etapa4_modal_remarcacao_horario_livre.png', caption: 'Detalhe do selector de horario livre no modal.' }
        ]
      },
      {
        title: '9. Presidente / Vice: alternancia para admin',
        description: 'Alunos com cargo Presidente ou Vice podem aceder ao painel administrativo sem novo login.',
        steps: [
          'Na sidebar do portal aluno, localize o botao "Portal Admin" ou "Ir para Admin".',
          'Ao clicar, o sistema redireciona para /admin com o contexto completo do Presidente/Vice.',
          'No admin, tem acesso a todos os modulos de gestao (membros, participantes, relatorios, etc.).',
          'Para retornar ao portal aluno, use a opcao "Area do Aluno" na sidebar do admin.',
          'O sistema memoriza o contexto entre alternancas — voltara exatamente a aba onde estava.'
        ],
        notes: [
          { type: 'note', text: 'Este fluxo existe apenas para Presidente e Vice. Alunos com outro cargo nao tem acesso ao admin.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-admin-dashboard.png', caption: 'Painel admin acessivel ao Presidente/Vice a partir do portal aluno.' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  //  ATLETA
  // ═══════════════════════════════════════════════════════════
  {
    profile: 'Atleta',
    output: 'Manual_Perfil_Atleta.pdf',
    objective:
      'Acompanhar a propria evolucao de saude: consultar o prontuario pessoal, ver as avaliacoes realizadas, gerir a agenda de consultas e completar o onboarding obrigatorio. O Atleta so tem acesso aos proprios dados.',
    sections: [
      {
        title: '1. Login e primeiro acesso',
        description: 'O fluxo de primeiro acesso inclui modais obrigatorios de configuracao da conta.',
        steps: [
          'Aceda a plataforma e insira as credenciais de atleta.',
          'Se for o primeiro acesso, aparece o modal de mudanca de senha obrigatoria. Defina uma senha segura e confirme.',
          'A seguir, pode aparecer o modal de "Completar Perfil" — preencha os dados pessoais solicitados.',
          'O modal de Onboarding (EBIA — dados socioeconomicos e esportivos) pode aparecer de seguida. Ver secao 2.',
          'Apos concluir todos os modais obrigatorios, acede ao portal do atleta em /atleta.',
          'O Dashboard mostra: proxima consulta, indicadores de saude resumidos e atalhos para o prontuario e agenda.'
        ],
        notes: [
          { type: 'warning', text: 'Nao ignore os modais obrigatorios — o sistema nao permite prosseguir para o portal sem os concluir.' },
          { type: 'tip', text: 'Defina uma senha forte com pelo menos 8 caracteres, letras maiusculas, minusculas, numeros e simbolos.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa3_atleta_onboarding_modal.png', caption: 'Modal de onboarding no primeiro acesso do atleta.' },
          { file: 'qa_run_20260402_1026_etapa3_atleta_modal_completo_dashboard_desktop.png', caption: 'Dashboard apos conclusao de todos os modais obrigatorios.' }
        ]
      },
      {
        title: '2. Onboarding obrigatorio (EBIA e perfil esportivo)',
        description: 'Preencher as informacoes socioeconomicas (EBIA) e o perfil esportivo no primeiro acesso.',
        steps: [
          'O modal de onboarding aparece automaticamente no primeiro acesso (ou quando o perfil esta incompleto).',
          'A Escala Brasileira de Inseguranca Alimentar (EBIA) e um questionario socioeconomico padronizado. Responda com honestidade — os dados sao confidenciais e usados apenas para fins de pesquisa.',
          'Preencha tambem o perfil esportivo: modalidade praticada, frequencia de treinos, carga semanal e historico de lesoes.',
          'Alguns campos sao obrigatorios (marcados com *). Preencha pelo menos os obrigatorios para poder continuar.',
          'Clique em "Salvar e Continuar" para guardar o progresso e avancar.',
          'Pode atualizar estas informacoes posteriormente acedendo ao seu perfil no menu superior.',
          'Apos concluir, o modal fecha e acede ao portal completo.'
        ],
        notes: [
          { type: 'note', text: 'Os dados de onboarding sao usados pela equipa de pesquisa para correlacionar fatores socioeconomicos com indicadores de saude.' },
          { type: 'tip', text: 'Mesmo que nao tenha todos os dados no momento, salve o progresso. Pode completar depois.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa3_atleta_onboarding_modal.png', caption: 'Formulario de onboarding com secoes EBIA e perfil esportivo.' },
          { file: 'qa_run_20260402_1026_etapa3_atleta_mobile_onboarding.png', caption: 'Onboarding em dispositivo movel — layout adaptado.' }
        ]
      },
      {
        title: '3. Portal do atleta — dashboard',
        description: 'O painel central com visao geral da saude e atividade do atleta.',
        steps: [
          'Apos o login e onboarding, o Dashboard e a primeira tela.',
          'Os cards mostram: proxima consulta, ultima avaliacao, indicadores de saude recentes (se disponiveis).',
          'Alertas de saude aparecem no topo se houver valores fora do normal nas ultimas avaliacoes.',
          'Os atalhos rapidos levam diretamente para o Prontuario, Agenda e Avaliacoes.',
          'O header mostra o nome do atleta, o icone de notificacoes e o menu de perfil.',
          'A sidebar tem os modulos: Visao Geral, Meu Prontuario, Minha Agenda, Avaliacoes, Pendencias.'
        ],
        notes: [
          { type: 'note', text: 'O Atleta ve APENAS os proprios dados. Nao tem acesso a informacoes de outros participantes.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-atleta-dashboard.png', caption: 'Portal do atleta em desktop — visao do dashboard.' },
          { file: 'qa_run_20260402_1026_etapa3_atleta_dashboard_desktop.png', caption: 'Dashboard do atleta com indicadores de saude.' }
        ]
      },
      {
        title: '4. Meu prontuario — historico clinico',
        description: 'Consultar o historico completo de avaliacoes e consultas realizadas.',
        steps: [
          'Na sidebar, clique em "Meu Prontuario".',
          'O prontuario abre com a visao geral: dados demograficos, ultimo registo de peso/altura e indicadores de saude.',
          'Na aba "Avaliacoes", veja todas as avaliacoes realizadas com data, tipo e status.',
          'Clique numa avaliacao para ver os resultados detalhados.',
          'Na aba "Consultas", veja o historico de agendamentos com datas e profissionais responsaveis.',
          'Na aba "Anexos", pode visualizar e descarregar documentos partilhados pela equipa clinica.',
          'Use o botao "Ver Historico" para ver a evolucao grafica de indicadores ao longo do tempo (disponivel em avaliacoes de bioimpedancia e perimetros).'
        ],
        notes: [
          { type: 'tip', text: 'Acompanhe a evolucao dos seus indicadores ao longo do tempo para ver o impacto do acompanhamento nutricional e de saude.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa6_prontuario_visao_geral.png', caption: 'Visao geral do prontuario com dados demograficos e indicadores.' },
          { file: 'qa_run_20260402_1026_etapa6_prontuario_tab_avaliacoes.png', caption: 'Historico de avaliacoes com status de cada registo.' }
        ]
      },
      {
        title: '5. Minhas avaliacoes',
        description: 'Ver as avaliacoes realizadas e pendentes, e preencher as que estao em aberto.',
        steps: [
          'Na sidebar, clique em "Avaliacoes" para ver a lista de todas as suas avaliacoes.',
          'A lista mostra: tipo de avaliacao, data, quem realizou e status (concluida, rascunho, pendente).',
          'Avaliacoes com status "Pendente" estao a aguardar o seu preenchimento ou validacao.',
          'Clique numa avaliacao para ver os detalhes ou continuar o preenchimento (se for rascunho).',
          'Para criar uma autoavaliacao (se permitido pelo sistema), clique em "+ Nova Avaliacao".',
          'Avaliacoes concluidas mostram os resultados calculados automaticamente pelo sistema.'
        ],
        notes: [
          { type: 'note', text: 'Algumas avaliacoes so podem ser criadas e editadas pela equipa clinica (professor/aluno). O atleta ve os resultados mas pode nao conseguir criar todos os tipos.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa5_clinica_finalizada_reabertura.png', caption: 'Avaliacao concluida com resultados visiveis para o atleta.' }
        ]
      },
      {
        title: '6. Minha agenda — consultas e remarcacoes',
        description: 'Ver as proximas consultas e solicitar remarcacoes quando necessario.',
        steps: [
          'Na sidebar, clique em "Minha Agenda".',
          'A agenda mostra as proximas consultas com data, hora, profissional e local (se aplicavel).',
          'Clique numa consulta para ver os detalhes completos.',
          'Para remarcar, clique no botao "Remarcar" dentro da consulta.',
          'Um modal mostra os horarios disponiveis. Selecione a nova data e hora e confirme.',
          'A remarcacao so e possivel dentro do prazo de antecedencia permitido (ex: ate 24h antes).',
          'Apos confirmar, a agenda e atualizada e recebe uma notificacao de confirmacao.'
        ],
        notes: [
          { type: 'warning', text: 'Nao e possivel remarcar consultas com menos de X horas de antecedencia. Contacte a equipa se precisar de alterar com urgencia.' },
          { type: 'tip', text: 'Recebe uma notificacao automatica 24h antes da consulta como lembrete.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa4_atleta_pos_remarcacao.png', caption: 'Agenda do atleta apos remarcacao bem sucedida.' },
          { file: 'qa_run_20260402_1026_etapa4_modal_remarcacao_horario_livre.png', caption: 'Modal de remarcacao com horarios livres disponiveis.' }
        ]
      },
      {
        title: '7. Uso em dispositivos moveis',
        description: 'O portal do atleta foi otimizado para uso frequente em telemovel.',
        steps: [
          'Aceda a plataforma pelo browser do telemovel — nao e necessaria instalacao de app.',
          'O layout adapta-se automaticamente ao tamanho do ecra.',
          'A sidebar aparece como menu hamburger — toque no icone de tres linhas para navegar.',
          'O onboarding e as avaliacoes funcionam totalmente no mobile.',
          'Para remarcar uma consulta rapidamente, use o atalho do Dashboard que leva diretamente para a agenda.',
          'Adicione a pagina ao ecra inicial do telemovel para acesso rapido (no browser, use "Adicionar ao ecra principal").'
        ],
        notes: [
          { type: 'tip', text: 'Guardar o acesso no ecra inicial do telemovel e como ter uma app nativa — acesso rapido sem abrir o browser.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa3_atleta_modal_completo_mobile.png', caption: 'Portal do atleta em mobile apos conclusao do onboarding.' },
          { file: 'journey-audit/atleta-mobile.png', caption: 'Painel do atleta em telemovel durante auditoria de jornada.' }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  //  EQUIPE TECNICA
  // ═══════════════════════════════════════════════════════════
  {
    profile: 'Equipe Tecnica',
    output: 'Manual_Perfil_Equipe_Tecnica.pdf',
    objective:
      'Acompanhar os atletas vinculados, aceder ao prontuario clinico completo, criar e editar avaliacoes tecnicas e gerir a agenda de acompanhamentos. A Equipe Tecnica tem acesso exclusivo a atletas — sem acesso a gestao administrativa.',
    sections: [
      {
        title: '1. Login e acesso ao portal',
        description: 'O portal da equipe tecnica e dedicado ao acompanhamento de atletas.',
        steps: [
          'Aceda a plataforma e insira as credenciais de equipe tecnica (cargo: tecnico).',
          'O sistema redireciona automaticamente para /equipe.',
          'O painel inicial mostra a lista de atletas vinculados e as proximas consultas.',
          'A sidebar tem os modulos disponiveis: Atletas (e sub-modulos de prontuario, agenda).',
          'O header mostra o nome do tecnico e as notificacoes nao lidas.'
        ],
        notes: [
          { type: 'note', text: 'A Equipe Tecnica nao tem acesso ao painel administrativo (/admin) nem aos modulos de membros ou relatorios.' }
        ],
        screens: [
          { file: 'manual-qa-20260403/bloco3-equipe-dashboard.png', caption: 'Painel da equipe tecnica com lista de atletas.' },
          { file: 'qa_run_20260402_1026_etapa3_equipe_dashboard_desktop.png', caption: 'Dashboard da equipe em desktop.' }
        ]
      },
      {
        title: '2. Lista de atletas — pesquisar e filtrar',
        description: 'Aceder e gerir a lista de atletas sob acompanhamento da equipe tecnica.',
        steps: [
          'No modulo "Atletas", ve a lista de todos os atletas vinculados a equipe.',
          'A lista mostra: nome, modalidade, ultima avaliacao, proxima consulta e status.',
          'Use o campo de pesquisa para filtrar por nome ou modalidade.',
          'Clique num atleta para abrir o prontuario completo.',
          'Para criar um novo registo de atleta, clique em "+ Novo Atleta" e preencha os dados obrigatorios.',
          'Para editar os dados de um atleta, aceda ao prontuario e clique em "Editar Perfil".'
        ],
        notes: [
          { type: 'note', text: 'A Equipe Tecnica ve apenas os atletas que lhe foram atribuidos ou que criou.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa2_equipe_view.png', caption: 'Vista da lista de atletas da equipe tecnica.' }
        ]
      },
      {
        title: '3. Prontuario do atleta — acesso completo',
        description: 'Consultar o historico clinico e esportivo completo de cada atleta.',
        steps: [
          'Abra um atleta na lista.',
          'O prontuario abre com a aba "Visao Geral": dados demograficos, indicadores de saude e perfil esportivo.',
          'Na aba "Avaliacoes", consulte todas as avaliacoes com data, tipo e status.',
          'Clique numa avaliacao para ver os resultados detalhados (bioimpedancia, perimetros, clinica, etc.).',
          'Na aba "Consultas", acompanhe o historico de agendamentos e remarcacoes.',
          'Na aba "Anexos", aceda a documentos partilhados pela equipa clinica.',
          'Use "Ver Historico" para ver a evolucao grafica de indicadores ao longo do tempo.'
        ],
        notes: [
          { type: 'tip', text: 'Antes de uma sessao de treino, consulte a Visao Geral para verificar o estado clinico atual do atleta.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa6_prontuario_visao_geral.png', caption: 'Prontuario do atleta com visao geral clinica e esportiva.' },
          { file: 'qa_run_20260402_1026_etapa6_prontuario_tab_avaliacoes.png', caption: 'Historico de avaliacoes do atleta.' }
        ]
      },
      {
        title: '4. Criar e editar avaliacoes',
        description: 'Registar avaliacoes tecnicas e clinicas dos atletas acompanhados.',
        steps: [
          'No prontuario do atleta, clique em "+ Nova Avaliacao" na aba Avaliacoes.',
          'Selecione o tipo de avaliacao mais adequado: Antropometria, Bioimpedancia, Perimetros, Composicao Corporal, Avaliacao Clinica, Hidratacao, Fisioterapia ou Evolucao.',
          'Preencha os campos do formulario. Campos obrigatorios estao marcados com (*).',
          'Use "Salvar Rascunho" para guardar progresso sem finalizar.',
          'Clique em "Finalizar Avaliacao" para concluir. A avaliacao aparece no historico do prontuario.',
          'Para editar uma avaliacao finalizada, clique em "Reabrir" dentro da avaliacao (o historico de edicao e mantido).',
          'Para comparar com avaliacoes anteriores, use o botao "Ver Historico" (disponivel em avaliaciones longitudinais).'
        ],
        notes: [
          { type: 'tip', text: 'Registe avaliacoes antes e depois de ciclos de treino intensivo para acompanhar o impacto na composicao corporal.' },
          { type: 'note', text: 'As avaliacoes criadas pela Equipe Tecnica ficam visiveis para o professor e admin no prontuario do atleta.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa5_perimetros_grupos_anatomicos.png', caption: 'Formulario de perimetros por grupos anatomicos.' },
          { file: 'qa_run_20260402_1026_etapa5_clinica_finalizada_reabertura.png', caption: 'Avaliacao finalizada com opcao de reabertura.' }
        ]
      },
      {
        title: '5. Agenda de acompanhamentos',
        description: 'Gerir o calendario de sessoes e consultas com os atletas.',
        steps: [
          'Aceda ao modulo de Agenda (disponivel dentro do prontuario do atleta ou como modulo separado).',
          'A agenda mostra todas as sessoes e consultas agendadas.',
          'Para criar uma nova sessao, clique em "+ Nova Consulta". Selecione o atleta, data/hora e tipo de consulta.',
          'Para editar ou remarcar, selecione a consulta e clique em "Editar" ou "Remarcar".',
          'O sistema verifica conflitos de horario e alerta se houver sobreposicao.',
          'O historico de remarcacoes e mantido automaticamente para rastreabilidade.'
        ],
        notes: [
          { type: 'tip', text: 'Sincronize a agenda com os ciclos de treino para garantir que as avaliacoes ocorrem nos momentos mais relevantes.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa4_modal_remarcacao_horario_livre.png', caption: 'Modal de remarcacao com horarios disponiveis.' }
        ]
      },
      {
        title: '6. Boas praticas e limites de permissao',
        description: 'Orientacoes para usar o sistema de forma eficaz dentro do escopo da Equipe Tecnica.',
        steps: [
          'Confirme sempre o estado clinico atual do atleta no prontuario antes de iniciar uma avaliacao.',
          'Nao altere dados fora do seu escopo de permissao — a plataforma restringe automaticamente as acoes nao autorizadas.',
          'Se identificar inconsistencias nos dados (ex: valores fisiologicos fora do normal), registe na avaliacao e notifique o professor responsavel.',
          'Ao criar uma avaliacao, identifique claramente o objetivo (ex: avaliacao pre-treino, pos-treino, mensal).',
          'Mantenha as avaliacoes atualizadas — dados desatualizados podem comprometer decisoes clinicas.',
          'Em caso de erro num campo finalizado, use o botao "Reabrir" para corrigir — nao crie uma avaliacao duplicada.'
        ],
        notes: [
          { type: 'warning', text: 'Nao tente aceder a /admin diretamente. O sistema nega o acesso e regista a tentativa para auditoria.' },
          { type: 'tip', text: 'Coordene com o professor supervisor quando houver duvidas sobre o estado clinico de um atleta antes de criar avaliacoes.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa3_equipe_dashboard_desktop.png', caption: 'Painel da equipe — contexto focado em atletas.' }
        ]
      },
      {
        title: '7. Uso em dispositivos moveis',
        description: 'O portal da equipe tecnica e acessivel em mobile para acompanhamentos em campo.',
        steps: [
          'Aceda a plataforma pelo browser do telemovel.',
          'O layout adapta-se automaticamente ao ecra.',
          'A sidebar aparece como menu hamburger — toque no icone para navegar.',
          'A lista de atletas, o prontuario e a agenda sao totalmente acessiveis em mobile.',
          'Formularios de avaliacao funcionam no mobile — ideais para registo imediato apos sessoes de treino.',
          'Para acesso rapido, adicione a pagina ao ecra inicial do telemovel.'
        ],
        notes: [
          { type: 'tip', text: 'Use o mobile para registar medicoes imediatamente apos as sessoes de treino para maior precisao e frescura dos dados.' }
        ],
        screens: [
          { file: 'qa_run_20260402_1026_etapa3_equipe_mobile.png', caption: 'Portal da equipe tecnica em dispositivo movel.' },
          { file: 'journey-audit/tecnico-mobile.png', caption: 'Vista movel do portal durante auditoria de jornada.' }
        ]
      }
    ]
  }
];

// ─── CSS MELHORADO ────────────────────────────────────────────────────────────

const css = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Arial, sans-serif;
    color: #0f172a;
    background: #f8fafc;
  }
  .page {
    max-width: 860px;
    margin: 0 auto;
    padding: 28px 30px 36px;
    background: #ffffff;
  }
  .cover {
    border: 1px solid #dbe3ef;
    border-radius: 14px;
    padding: 20px 22px;
    background: linear-gradient(145deg, #ffffff 0%, #f5f8ff 100%);
    margin-bottom: 20px;
  }
  .kicker {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #1d4ed8;
    margin-bottom: 8px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 30px;
    line-height: 1.18;
    color: #0b1733;
  }
  .subtitle {
    margin: 0;
    font-size: 14px;
    color: #334155;
  }
  .meta {
    margin-top: 12px;
    font-size: 12px;
    color: #475569;
  }
  .objective {
    margin: 16px 0 22px;
    border-left: 4px solid #1d4ed8;
    background: #eff6ff;
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.55;
  }
  h2 {
    margin: 24px 0 4px;
    font-size: 20px;
    color: #0f172a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
  }
  .section-description {
    margin: 4px 0 10px;
    font-size: 13px;
    color: #475569;
    font-style: italic;
    line-height: 1.5;
  }
  .steps {
    margin: 0 0 12px 18px;
    padding: 0;
  }
  .steps li {
    margin-bottom: 8px;
    line-height: 1.6;
    font-size: 13px;
  }
  .steps li strong {
    color: #1e40af;
  }
  .callout {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 8px 0;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 12.5px;
    line-height: 1.5;
  }
  .callout-icon {
    font-size: 15px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .callout.tip {
    background: #f0fdf4;
    border-left: 3px solid #16a34a;
    color: #14532d;
  }
  .callout.warning {
    background: #fef9c3;
    border-left: 3px solid #ca8a04;
    color: #713f12;
  }
  .callout.note {
    background: #f1f5f9;
    border-left: 3px solid #64748b;
    color: #334155;
  }
  figure {
    margin: 10px 0 20px;
    border: 1px solid #dbe3ef;
    border-radius: 10px;
    overflow: hidden;
    background: #f8fafc;
  }
  figure img {
    display: block;
    width: 100%;
    height: auto;
  }
  figcaption {
    font-size: 12px;
    color: #334155;
    background: #eef2ff;
    border-top: 1px solid #dbe3ef;
    padding: 8px 10px;
  }
  .footer-note {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px dashed #cbd5e1;
    font-size: 11px;
    color: #64748b;
  }
  .break {
    page-break-before: always;
  }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const toDataUri = async (filePath) => {
  const file = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${file.toString('base64')}`;
};

const tryDataUri = async (filePath) => {
  try {
    return await toDataUri(filePath);
  } catch {
    return null;
  }
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const calloutIcon = (type) => {
  if (type === 'tip') return '&#x1F4A1;';
  if (type === 'warning') return '&#x26A0;&#xFE0F;';
  return 'ℹ️';
};

const renderManualHtml = async (manual) => {
  const renderedSections = [];

  for (let index = 0; index < manual.sections.length; index += 1) {
    const section = manual.sections[index];
    const stepsHtml = section.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');

    const notesHtml = (section.notes || [])
      .map(
        (n) => `
        <div class="callout ${escapeHtml(n.type)}">
          <span class="callout-icon">${calloutIcon(n.type)}</span>
          <span>${escapeHtml(n.text)}</span>
        </div>`
      )
      .join('');

    const screensHtml = [];
    for (const screen of section.screens) {
      const imagePath = path.join(artifactsDir, screen.file);
      const imageUri = await tryDataUri(imagePath);
      if (!imageUri) continue;
      screensHtml.push(`
        <figure>
          <img src="${imageUri}" alt="${escapeHtml(screen.caption)}" />
          <figcaption>${escapeHtml(screen.caption)}<br/><small>${escapeHtml(screen.file)}</small></figcaption>
        </figure>
      `);
    }

    const descHtml = section.description
      ? `<p class="section-description">${escapeHtml(section.description)}</p>`
      : '';

    renderedSections.push(`
      <section class="${index > 0 ? 'break' : ''}">
        <h2>${escapeHtml(section.title)}</h2>
        ${descHtml}
        <ol class="steps">
          ${stepsHtml}
        </ol>
        ${notesHtml}
        ${screensHtml.join('\n')}
      </section>
    `);
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Manual ${escapeHtml(manual.profile)}</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="page">
          <section class="cover">
            <span class="kicker">Laines App — Manual de Uso</span>
            <h1>Perfil: ${escapeHtml(manual.profile)}</h1>
            <p class="subtitle">Guia completo de funcionalidades, fluxos de trabalho e boas praticas.</p>
            <p class="meta">Versao do manual: ${manualDate} &nbsp;|&nbsp; ${manual.sections.length} secoes</p>
          </section>
          <div class="objective"><strong>Objetivo do perfil:</strong> ${escapeHtml(manual.objective)}</div>
          ${renderedSections.join('\n')}
          <div class="footer-note">
            Documento gerado automaticamente a partir de evidencias de QA em <code>e2e-artifacts</code>.
            Versao: ${manualDate}.
          </div>
        </div>
      </body>
    </html>
  `;
};

// ─── EXECUCAO ─────────────────────────────────────────────────────────────────

const ensureDirs = async () => {
  await fs.mkdir(htmlDir, { recursive: true });
  await fs.mkdir(pdfDir, { recursive: true });
};

const run = async () => {
  await ensureDirs();
  const browser = await chromium.launch({ headless: true });

  try {
    for (const manual of manuals) {
      // eslint-disable-next-line no-console
      console.log(`Gerando manual: ${manual.profile}...`);
      const html = await renderManualHtml(manual);
      const htmlName = manual.output.replace(/\.pdf$/i, '.html');
      const htmlPath = path.join(htmlDir, htmlName);
      const pdfPath = path.join(pdfDir, manual.output);

      await fs.writeFile(htmlPath, html, 'utf8');

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      });
      await page.close();

      // eslint-disable-next-line no-console
      console.log(`  ✓ HTML: ${htmlPath}`);
      // eslint-disable-next-line no-console
      console.log(`  ✓ PDF:  ${pdfPath}`);
    }
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao gerar manuais:', error);
  process.exit(1);
});
