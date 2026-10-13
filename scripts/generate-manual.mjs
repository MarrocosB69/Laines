/**
 * Gerador do Manual LAINES em HTML
 *
 * Lê os screenshots de e2e-artifacts/manual-screenshots/
 * e gera docs/manual/manual-laines.html com o manual completo.
 *
 * Execute: node scripts/generate-manual.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT, 'e2e-artifacts', 'manual-screenshots');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'manual');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'manual-laines.html');

// ─────────────────────────────────────────────────────────────
// ESTRUTURA DO MANUAL
// Cada item: { id, title, screenshot, description, tips, fields }
// ─────────────────────────────────────────────────────────────
const CAPITULOS = [
  {
    id: 'intro',
    titulo: 'Introdução ao Sistema',
    descricao: 'O LAINES é o sistema de gestão clínica da Liga Acadêmica Interprofissional de Nutrição Esportiva da UFRN. Centraliza prontuários digitais, avaliações multiprofissionais, agendamentos e supervisão acadêmica numa única plataforma.',
    secoes: [
      {
        id: 'perfis',
        titulo: 'Perfis de usuário',
        screenshot: null,
        descricao: `
          <p>O sistema possui seis grupos de acesso, cada um com funcionalidades específicas:</p>
          <table class="info-table">
            <thead><tr><th>Perfil</th><th>E-mail padrão</th><th>Acesso principal</th></tr></thead>
            <tbody>
              <tr><td><strong>Admin / Coordenação</strong></td><td>@laines.ufrn.br</td><td>Gestão completa: membros, atletas, relatórios, configurações</td></tr>
              <tr><td><strong>Presidente / Vice</strong></td><td>@laines.ufrn.br</td><td>Acesso duplo: visão admin + visão de aluno</td></tr>
              <tr><td><strong>Professor</strong></td><td>@laines.ufrn.br</td><td>Supervisão de alunos, visualização de prontuários</td></tr>
              <tr><td><strong>Aluno</strong></td><td>@laines.ufrn.br</td><td>Atendimento clínico, avaliações, planos alimentares</td></tr>
              <tr><td><strong>Atleta</strong></td><td>@laines.ufrn.br</td><td>Acesso ao próprio prontuário e agenda</td></tr>
              <tr><td><strong>Equipe Técnica</strong></td><td>@laines.ufrn.br</td><td>Acompanhamento de atletas vinculados</td></tr>
            </tbody>
          </table>
        `,
        tips: []
      }
    ]
  },
  {
    id: 'login',
    titulo: 'Acesso e Login',
    descricao: 'A tela de login é o ponto de entrada de todos os usuários. Após autenticação, o sistema redireciona automaticamente para a área correspondente ao perfil.',
    secoes: [
      {
        id: '00_01',
        titulo: 'Tela inicial de login',
        screenshot: '00_01_login_tela_inicial',
        descricao: '<p>A tela exibe os campos de CPF ou e-mail e senha, além do botão <strong>"Entrar"</strong>. O link <strong>"Solicitar acesso"</strong> permite que novos usuários solicitem cadastro ao administrador.</p>',
        tips: ['Use o e-mail institucional no formato nome@laines.ufrn.br', 'A senha deve ser alterada no primeiro acesso']
      },
      {
        id: '00_02',
        titulo: 'Preenchimento das credenciais',
        screenshot: '00_02_login_preenchido',
        descricao: '<p>Preencha o campo <strong>E-mail</strong> com o endereço institucional e o campo <strong>Senha</strong> com a senha definida pelo administrador ou alterada no primeiro acesso.</p>',
        tips: ['A senha diferencia maiúsculas de minúsculas', 'Clique em "Entrar" ou pressione Enter para confirmar']
      },
      {
        id: '00_03',
        titulo: 'Solicitar acesso',
        screenshot: '00_03_login_solicitar_acesso',
        descricao: '<p>Novos membros da liga podem clicar em <strong>"Solicitar acesso"</strong> para abrir o modal de solicitação. O administrador receberá a notificação e poderá aprovar ou rejeitar o pedido.</p>',
        tips: ['Informe nome completo, e-mail institucional e perfil desejado', 'O administrador aprova o acesso pelo painel de Solicitações']
      },
      {
        id: '00_04',
        titulo: 'Mensagem de erro de credencial',
        screenshot: '00_04_login_erro_credencial',
        descricao: '<p>Caso as credenciais estejam incorretas, o sistema exibe uma mensagem de erro abaixo do formulário. O usuário deve verificar o e-mail e a senha antes de tentar novamente.</p>',
        tips: ['Verifique se o Caps Lock está ativo', 'Caso tenha esquecido a senha, entre em contato com o administrador']
      }
    ]
  },
  {
    id: 'admin',
    titulo: 'Perfil Admin / Coordenação',
    descricao: 'O administrador tem acesso total ao sistema: gerencia membros, atletas, projetos, relatórios e configurações da liga. O usuário de exemplo usado neste manual é <strong>Carlos Eduardo Mendonça</strong>.',
    secoes: [
      {
        id: '01_01',
        titulo: 'Dashboard do admin',
        screenshot: '01_01_admin_dashboard',
        descricao: '<p>O painel central exibe métricas gerais da liga: total de atletas ativos, alunos, sessões realizadas no mês e indicadores operacionais. Os atalhos rápidos facilitam o acesso às seções mais utilizadas.</p>',
        tips: ['Os números no dashboard são atualizados em tempo real', 'Clique em qualquer card de métrica para ver a lista detalhada']
      },
      {
        id: '01_02',
        titulo: 'Lista de membros (usuários)',
        screenshot: '01_02_admin_membros_lista',
        descricao: '<p>A aba <strong>Membros</strong> exibe todos os usuários cadastrados na liga. É possível filtrar por perfil, pesquisar pelo nome e ver o status de cada membro (ativo, inativo, pendente).</p>',
        tips: ['Use o filtro de perfil para visualizar apenas alunos ou professores', 'Clique no nome do membro para editar seus dados']
      },
      {
        id: '01_03',
        titulo: 'Cadastro de novo membro — formulário vazio',
        screenshot: '01_03_admin_modal_novo_membro_vazio',
        descricao: '<p>O botão <strong>"Novo membro"</strong> abre o modal de cadastro. Campos obrigatórios são marcados com asterisco (*).</p>',
        fields: [
          { nome: 'Nome completo *', descricao: 'Nome oficial do membro da liga' },
          { nome: 'E-mail *', descricao: 'Endereço institucional (@laines.ufrn.br ou @ufrn.edu.br)' },
          { nome: 'CPF *', descricao: 'CPF válido, usado como identificador único' },
          { nome: 'Perfil *', descricao: 'Selecione o nível de acesso: aluno, professor, técnico, etc.' },
          { nome: 'Telefone', descricao: 'Número com DDD para contato' }
        ],
        tips: ['O sistema envia automaticamente um e-mail com a senha temporária ao novo membro', 'O membro deverá trocar a senha no primeiro acesso']
      },
      {
        id: '01_04',
        titulo: 'Cadastro de novo membro — formulário preenchido',
        screenshot: '01_04_admin_modal_novo_membro_preenchido',
        descricao: '<p>Exemplo de formulário preenchido com os dados de um novo aluno. Após clicar em <strong>"Salvar"</strong>, o usuário é criado e aparece na lista de membros.</p>',
        tips: ['Confira o e-mail antes de salvar — não é possível alterar o e-mail depois', 'O campo CPF não aceita duplicatas']
      },
      {
        id: '01_05',
        titulo: 'Lista de atletas',
        screenshot: '01_05_admin_atletas_lista',
        descricao: '<p>A aba <strong>Atletas</strong> lista todos os participantes cadastrados. Exibe prontuário, nome, modalidade, aluno responsável e status. A busca por nome ou prontuário facilita o acesso rápido.</p>',
        tips: ['Clique no prontuário para abrir o registro completo do atleta', 'A coluna "Aluno responsável" indica quem está conduzindo o atendimento']
      },
      {
        id: '01_06',
        titulo: 'Cadastro de novo atleta — passo 1: identificação',
        screenshot: '01_06_admin_wizard_atleta_passo1',
        descricao: '<p>O wizard de cadastro de atleta guia o admin em 3 passos. No passo 1 são preenchidos os dados pessoais.</p>',
        fields: [
          { nome: 'Nome completo *', descricao: 'Nome oficial do atleta' },
          { nome: 'CPF *', descricao: 'Documento de identificação único' },
          { nome: 'Data de nascimento *', descricao: 'Usado para calcular idade nas avaliações' },
          { nome: 'Gênero', descricao: 'Identificação de gênero do atleta' },
          { nome: 'E-mail', descricao: 'E-mail de contato (e acesso ao portal do atleta)' },
          { nome: 'Telefone', descricao: 'Número para contato com DDD' }
        ],
        tips: []
      },
      {
        id: '01_07',
        titulo: 'Cadastro de novo atleta — passo 2: modalidade esportiva',
        screenshot: '01_07_admin_wizard_atleta_passo2',
        descricao: '<p>O segundo passo registra o perfil esportivo do atleta. Essas informações são usadas como contexto nas avaliações.</p>',
        fields: [
          { nome: 'Modalidade principal *', descricao: 'Esporte praticado: natação, futebol, corrida, etc.' },
          { nome: 'Tempo de prática', descricao: 'Há quanto tempo pratica a modalidade' },
          { nome: 'Frequência semanal', descricao: 'Número de treinos por semana' },
          { nome: 'Duração da sessão (min)', descricao: 'Tempo médio de cada treino em minutos' },
          { nome: 'Objetivo', descricao: 'Performance, saúde geral, emagrecimento, etc.' }
        ],
        tips: ['Esses dados são pré-carregados na anamnese inicial', 'Podem ser atualizados a qualquer momento pelo aluno responsável']
      },
      {
        id: '01_08',
        titulo: 'Cadastro de novo atleta — passo 3: vínculo ao projeto',
        screenshot: '01_08_admin_wizard_atleta_passo3',
        descricao: '<p>No terceiro passo, o atleta é vinculado a um projeto da liga, a um aluno responsável e ao professor supervisor. Esse vínculo determina quem tem acesso ao prontuário.</p>',
        fields: [
          { nome: 'Projeto *', descricao: 'Projeto da liga ao qual o atleta pertence' },
          { nome: 'Aluno responsável *', descricao: 'Aluno que conduzirá os atendimentos' },
          { nome: 'Professor supervisor', descricao: 'Professor que supervisiona os atendimentos' }
        ],
        tips: ['Um atleta pode ser vinculado a apenas um projeto por vez', 'O vínculo pode ser transferido pelo admin em caso de mudança de turma']
      },
      {
        id: '01_09',
        titulo: 'Relatórios',
        screenshot: '01_09_admin_relatorios',
        descricao: '<p>A aba de relatórios oferece visão analítica das atividades da liga: número de atendimentos por período, distribuição por modalidade, taxa de conclusão de avaliações e indicadores de desempenho académico.</p>',
        tips: ['Use os filtros de período para comparar semestres', 'O relatório pode ser exportado em PDF']
      },
      {
        id: '01_10',
        titulo: 'Solicitações de acesso',
        screenshot: '01_10_admin_solicitacoes',
        descricao: '<p>Lista todas as solicitações pendentes de novos membros. O admin pode aprovar ou rejeitar cada solicitação individualmente. Ao aprovar, o sistema cria automaticamente o usuário e envia as credenciais por e-mail.</p>',
        tips: ['Solicitações aprovadas são removidas desta lista', 'Solicitações rejeitadas podem ser visualizadas no histórico']
      },
      {
        id: '01_11',
        titulo: 'Configurações do sistema',
        screenshot: '01_11_admin_configuracoes',
        descricao: '<p>Painel de configurações gerais da liga: dados institucionais, parâmetros de notificação e preferências da plataforma.</p>',
        tips: ['Apenas o admin e coordenação têm acesso a esta seção', 'Alterações nas configurações entram em vigor imediatamente']
      }
    ]
  },
  {
    id: 'presidente',
    titulo: 'Perfil Presidente / Vice-Presidente',
    descricao: 'O presidente e o vice-presidente possuem acesso duplo: visualizam o sistema tanto como administradores quanto como alunos, podendo alternar entre os dois contextos. O usuário de exemplo é <strong>Fernanda Oliveira Santos</strong>.',
    secoes: [
      {
        id: '02_01',
        titulo: 'Dashboard do presidente',
        screenshot: '02_01_presidente_dashboard',
        descricao: '<p>Ao fazer login, o presidente acessa inicialmente o painel administrativo, com as mesmas funcionalidades do admin (membros, atletas, relatórios). A diferença está na opção de troca de perfil.</p>',
        tips: []
      },
      {
        id: '02_02',
        titulo: 'Troca de perfil (switcher)',
        screenshot: '02_02_presidente_troca_perfil',
        descricao: '<p>O botão de troca de perfil permite ao presidente alternar entre a visão de <strong>Admin</strong> e a visão de <strong>Aluno</strong>, mantendo o mesmo login. Isso permite que ele conduza atendimentos como qualquer outro aluno da liga.</p>',
        tips: ['A troca de perfil não encerra a sessão', 'Cada contexto tem seu próprio menu e funcionalidades']
      }
    ]
  },
  {
    id: 'professor',
    titulo: 'Perfil Professor',
    descricao: 'O professor supervisiona os atendimentos realizados pelos alunos. Visualiza os prontuários dos atletas, acompanha o progresso e orienta a conduta clínica. O usuário de exemplo é <strong>Anderson Vieira Melo</strong>.',
    secoes: [
      {
        id: '03_01',
        titulo: 'Dashboard do professor',
        screenshot: '03_01_professor_dashboard',
        descricao: '<p>O dashboard exibe métricas da turma: alunos sob supervisão, atletas em atendimento, sessões agendadas e pendências de revisão. O painel de KPIs permite identificar rapidamente os atletas que necessitam de atenção.</p>',
        tips: ['Alertas vermelhos indicam atletas com pendências críticas', 'Clique em qualquer número para ver a lista detalhada']
      },
      {
        id: '03_02',
        titulo: 'Turma — lista de alunos',
        screenshot: '03_02_professor_turma_alunos',
        descricao: '<p>Exibe os alunos sob supervisão com seus respectivos atletas vinculados, número de sessões realizadas e status dos atendimentos.</p>',
        tips: ['Clique no nome do aluno para ver seus atletas e o andamento dos atendimentos']
      },
      {
        id: '03_03',
        titulo: 'Lista de atletas do professor',
        screenshot: '03_03_professor_atletas',
        descricao: '<p>Visão consolidada de todos os atletas dos alunos supervisionados, com status de cada um e próximas consultas agendadas.</p>',
        tips: []
      },
      {
        id: '03_04',
        titulo: 'Prontuário do atleta (visão do professor)',
        screenshot: '03_04_professor_prontuario_atleta',
        descricao: '<p>O professor visualiza o prontuário completo do atleta em modo de leitura. Pode acompanhar todas as avaliações realizadas, resultados e conduta definida pelo aluno.</p>',
        tips: ['O professor pode adicionar comentários e anotações de supervisão', 'As avaliações ficam travadas para edição do professor (apenas leitura)']
      },
      {
        id: '03_05',
        titulo: 'Agenda do professor',
        screenshot: '03_05_professor_agenda',
        descricao: '<p>Calendário com todos os atendimentos agendados pelos alunos supervisionados. Permite ao professor planejar sua presença nas sessões.</p>',
        tips: ['Clique em um agendamento para ver os detalhes e o aluno responsável']
      },
      {
        id: '03_06',
        titulo: 'Projetos vinculados',
        screenshot: '03_06_professor_projetos',
        descricao: '<p>Lista os projetos da liga nos quais o professor atua como coordenador ou colaborador, com dados de equipe, alunos e progresso.</p>',
        tips: []
      }
    ]
  },
  {
    id: 'aluno',
    titulo: 'Perfil Aluno',
    descricao: 'O aluno realiza os atendimentos clínicos: conduz avaliações, elabora planos alimentares e agenda sessões. É o perfil de maior interação com o sistema. A usuária de exemplo é <strong>Ana Carolina Medeiros Silva</strong>.',
    secoes: [
      {
        id: '04_01',
        titulo: 'Dashboard do aluno',
        screenshot: '04_01_aluno_dashboard',
        descricao: '<p>O dashboard exibe um resumo dos atendimentos recentes, próximas sessões agendadas e indicadores de progresso dos atletas sob responsabilidade do aluno.</p>',
        tips: ['O card "Próximas ações" destaca as pendências mais urgentes', 'Clique em "Ver todos" para expandir cada seção']
      },
      {
        id: '04_02',
        titulo: 'Painel de próximas ações',
        screenshot: '04_02_aluno_proximas_acoes',
        descricao: '<p>A sidebar exibe as consultas futuras e os atletas com avaliações pendentes, permitindo ao aluno priorizar seu trabalho com eficiência.</p>',
        tips: []
      },
      {
        id: '04_03',
        titulo: 'Meus atletas — lista',
        screenshot: '04_03_aluno_meus_atletas',
        descricao: '<p>Tabela com todos os atletas vinculados ao aluno: prontuário, nome, modalidade, data do último atendimento e status. A busca por nome ou prontuário facilita o acesso rápido.</p>',
        tips: ['Clique no nome do atleta para abrir o prontuário completo', 'A coluna "Último atendimento" ajuda a identificar atletas sem sessões recentes']
      },
      {
        id: '04_04',
        titulo: 'Prontuário — Visão geral',
        screenshot: '04_04_aluno_prontuario_visao_geral',
        descricao: '<p>A visão geral do prontuário consolida as informações principais do atleta: dados pessoais, modalidade, objetivo e histórico de atendimentos. É o ponto de partida para todas as ações clínicas.</p>',
        tips: ['Os dados pessoais foram preenchidos no cadastro inicial', 'Clique em "Editar" para atualizar informações do atleta']
      },
      {
        id: '04_05',
        titulo: 'Prontuário — Dashboard de avaliações',
        screenshot: '04_05_aluno_prontuario_avaliacoes',
        descricao: '<p>Exibe o histórico de todas as avaliações realizadas, organizadas por sessão e tipo. Permite comparar resultados entre avaliações diferentes e acompanhar a evolução do atleta.</p>',
        tips: ['Clique em qualquer avaliação para ver o resultado detalhado', 'Use o filtro de tipo para visualizar apenas dobras, por exemplo']
      },
      {
        id: '04_06',
        titulo: 'Prontuário — Situação clínica',
        screenshot: '04_06_aluno_prontuario_situacao_clinica',
        descricao: '<p>Painel de síntese clínica com os principais indicadores do atleta: prioridade de cuidado, flags de risco, disponibilidade energética e conduta em andamento.</p>',
        tips: ['Flags vermelhas indicam riscos que exigem atenção imediata', 'A disponibilidade energética é calculada automaticamente após a triagem']
      },
      {
        id: '04_07',
        titulo: 'Tela de avaliação completa',
        screenshot: '04_07_aluno_avaliacao_completa_visao_geral',
        descricao: '<p>A tela de avaliação completa organiza todos os módulos em etapas clínicas (triagem, composição corporal, demanda, rotina alimentar, multiprofissional e conduta). A barra de progresso indica quais etapas foram concluídas.</p>',
        tips: [
          'As etapas devem ser preenchidas preferencialmente na ordem apresentada',
          'Módulos com dependência ficam desbloqueados após as avaliações necessárias',
          'O sistema salva automaticamente a cada 3,5 segundos de inatividade'
        ]
      }
    ]
  },
  {
    id: 'avaliacoes',
    titulo: 'Avaliações Clínicas',
    descricao: 'As avaliações clínicas são organizadas em módulos dentro da tela de avaliação completa. Cada módulo tem campos específicos e gera resultados calculados automaticamente. Os dados são salvos por sessão e comparados longitudinalmente.',
    secoes: [
      {
        id: '05_01',
        titulo: 'Anamnese inicial — Identificação e objetivo',
        screenshot: '05_01_anamnese_aba_identificacao',
        descricao: '<p>A anamnese inicial é a primeira avaliação de qualquer atleta. Coletora de contexto clínico e esportivo, gera um score de risco que orienta a prioridade de atendimento.</p><p><strong>Aba 1 — Identificação e objetivo:</strong> Dados pessoais e objetivos principais do atleta.</p>',
        fields: [
          { nome: 'Data da avaliação', descricao: 'Preenchida automaticamente com a data atual' },
          { nome: 'Nome *', descricao: 'Nome completo do atleta (pré-preenchido do cadastro)' },
          { nome: 'Data de nascimento', descricao: 'Utilizada para cálculo de idade nas avaliações' },
          { nome: 'Sexo biológico *', descricao: 'Masculino ou Feminino — determina os protocolos de cálculo' },
          { nome: 'Identidade de gênero', descricao: 'Campo opcional de autoidentificação' },
          { nome: 'Objetivos principais *', descricao: 'Checkboxes: emagrecimento, hipertrofia, saúde geral, performance, reabilitação, gestação ou outros' },
          { nome: 'Queixa principal', descricao: 'Texto livre descrevendo a motivação do atendimento' }
        ],
        tips: [
          'Os campos com * são obrigatórios para salvar a anamnese',
          'Selecione todos os objetivos relevantes — influenciam o score de risco'
        ]
      },
      {
        id: '05_02',
        titulo: 'Anamnese inicial — Histórico clínico',
        screenshot: '05_02_anamnese_aba_historico',
        descricao: '<p><strong>Aba 2 — Histórico clínico:</strong> Registro de patologias, medicamentos e suplementos em uso. Cada item é adicionado individualmente para permitir detalhamento de dose e frequência.</p>',
        fields: [
          { nome: 'Patologias', descricao: 'Checkboxes: diabetes, hipertensão, dislipidemia, doença renal, hepática, hipotireoidismo, SOPK, doença cardiovascular, transtorno alimentar e outras' },
          { nome: 'Medicamentos em uso', descricao: 'Nome, dose e frequência de cada medicamento. Clique em "+ Adicionar medicamento" para incluir novos' },
          { nome: 'Suplementos em uso', descricao: 'Nome, dose e frequência de cada suplemento' },
          { nome: 'Alergias / intolerâncias', descricao: 'Campo de texto livre para alergias alimentares e intolerâncias' },
          { nome: 'Cirurgias relevantes', descricao: 'Histórico cirúrgico com impacto nutricional' }
        ],
        tips: [
          'Cada patologia marcada incrementa o score de risco da anamnese',
          'Suplementos devem ser registrados mesmo os de venda livre'
        ]
      },
      {
        id: '05_03',
        titulo: 'Anamnese inicial — Estilo de vida e contexto esportivo',
        screenshot: '05_03_anamnese_aba_estilo_esportivo',
        descricao: '<p><strong>Aba 3 — Estilo de vida:</strong> Hábitos cotidianos e contexto esportivo detalhado. As informações de carga de treino são pré-carregadas no módulo de Gasto Energético.</p>',
        fields: [
          { nome: 'Tipo de atividade', descricao: 'Descrição da atividade física principal' },
          { nome: 'Frequência semanal', descricao: 'Número de treinos por semana' },
          { nome: 'Duração média (min)', descricao: 'Tempo médio por sessão de treino' },
          { nome: 'Sono — horas/noite', descricao: 'Média de horas dormidas por noite' },
          { nome: 'Qualidade do sono (1-5)', descricao: '1 = péssima, 5 = excelente' },
          { nome: 'Nível de estresse (1-10)', descricao: '1 = sem estresse, 10 = estresse máximo' },
          { nome: 'Álcool', descricao: 'Frequência de consumo: não, eventual, frequente, alto/diário' },
          { nome: 'Tabaco', descricao: 'Uso de tabaco: não, eventual, sim' },
          { nome: 'Ciclo menstrual', descricao: 'Regularidade e uso de contraceptivo (quando aplicável)' },
          { nome: 'Modalidade esportiva', descricao: 'Modalidade principal: futebol, natação, musculação, etc.' },
          { nome: 'Posição / função', descricao: 'Posição específica dentro da modalidade' },
          { nome: 'Nível competitivo', descricao: 'Amador, semi-pro, elite ou federado' },
          { nome: 'Clube', descricao: 'Nome do clube ou time' },
          { nome: 'Carga técnica / tática / física / preventiva (h/sem)', descricao: 'Horas semanais de cada tipo de treinamento' },
          { nome: 'Fase de periodização', descricao: 'Pré-temporada, temporada ou off-season' },
          { nome: 'Histórico de lesões', descricao: 'Local da lesão e tempo de afastamento. Clique em "+ Adicionar lesão" para incluir mais' },
          { nome: 'Próximas competições', descricao: 'Nome e data de competições previstas' },
          { nome: 'Histórico sugestivo de baixa disponibilidade energética', descricao: 'Checkbox disponível para atletas do sexo feminino' }
        ],
        tips: [
          'A carga física (h/sem) é calculada automaticamente se frequência e duração forem preenchidas',
          'O histórico de baixa disponibilidade energética aparece apenas para atletas do sexo feminino'
        ]
      },
      {
        id: '05_04',
        titulo: 'Anamnese inicial — Histórico familiar e resumo de risco',
        screenshot: '05_04_anamnese_aba_familiar_risco',
        descricao: '<p><strong>Aba 4 — Histórico familiar:</strong> Fatores hereditários que influenciam o risco clínico. Ao final do formulário, o sistema exibe o resumo de risco calculado com base em todas as informações preenchidas.</p>',
        fields: [
          { nome: 'Doença cardiovascular familiar', descricao: 'Checkbox: histórico familiar de doenças cardiovasculares' },
          { nome: 'Diabetes familiar', descricao: 'Checkbox: histórico familiar de diabetes' },
          { nome: 'Câncer familiar', descricao: 'Checkbox: histórico familiar de câncer' },
          { nome: 'Obesidade familiar', descricao: 'Checkbox: histórico familiar de obesidade' },
          { nome: 'Observações', descricao: 'Campo de texto livre para anotações adicionais' }
        ],
        tips: [
          'O resumo de risco mostra prioridade (baixa/moderada/alta), score numérico e encaminhamentos sugeridos',
          'Flags de alerta são geradas automaticamente para combinações de fatores de risco elevados',
          'Clique em "Salvar anamnese" após preencher todas as abas'
        ]
      },
      {
        id: '05_05',
        titulo: 'Perímetros corporais — campos obrigatórios',
        screenshot: '05_05_perimetros_obrigatorios',
        descricao: '<p>O módulo de perímetros corporais registra medidas antropométricas. Peso e estatura são obrigatórios para o cálculo do IMC. Os demais campos são opcionais e ativam indicadores adicionais.</p>',
        fields: [
          { nome: 'Peso atual (kg) *', descricao: 'Peso em quilogramas com uma casa decimal (ex: 78,5). Base para IMC e fórmulas energéticas' },
          { nome: 'Estatura (cm) *', descricao: 'Altura em centímetros (ex: 182). Faixa válida: 50 a 250 cm' }
        ],
        tips: [
          'Use uma balança calibrada em superfície plana para o peso',
          'Meça a estatura com o atleta descalço e em posição ereta'
        ]
      },
      {
        id: '05_06',
        titulo: 'Perímetros corporais — campos opcionais',
        screenshot: '05_06_perimetros_campos_opcionais',
        descricao: '<p>Os campos opcionais ativam cálculos de risco cardiometabólico (RCQ, ICE) e estimativas de composição corporal. Cada campo exibe um tooltip com a técnica de medição recomendada.</p>',
        fields: [
          { nome: 'Circunferência da cintura (cm)', descricao: 'Ponto médio entre a última costela e a crista ilíaca. Usada no ICE e RCQ' },
          { nome: 'Circunferência do quadril (cm)', descricao: 'Maior perímetro na região glútea. Usada no RCQ' },
          { nome: 'Circunferência do pescoço (cm)', descricao: 'Abaixo da laringe. Medida complementar de risco' },
          { nome: 'Braço relaxado (cm)', descricao: 'Ponto médio do braço dominante em repouso' },
          { nome: 'Braço contraído (cm)', descricao: 'Braço dominante em flexão máxima' },
          { nome: 'Panturrilha (cm)', descricao: 'Maior perímetro da panturrilha dominante' },
          { nome: 'Coxa (cm)', descricao: 'Ponto médio da coxa dominante' },
          { nome: 'Tórax (cm)', descricao: 'Perímetro torácico na linha mamilar' },
          { nome: 'Abdômen (cm)', descricao: 'Ao nível da cicatriz umbilical' }
        ],
        tips: [
          'Realize todas as medições 3 vezes e use a mediana para maior precisão',
          'Registre o lado de medição (direito ou esquerdo) para consistência longitudinal'
        ]
      },
      {
        id: '05_07',
        titulo: 'Perímetros corporais — resultados calculados',
        screenshot: '05_07_perimetros_resultados',
        descricao: '<p>Após o preenchimento, o sistema calcula automaticamente os indicadores: IMC com classificação OMS, índice cintura-estatura (ICE), relação cintura-quadril (RCQ) e estimativa de TMB pelas fórmulas Harris-Benedict e Mifflin-St Jeor.</p>',
        tips: [
          'IMC entre 18,5 e 24,9 = peso normal (OMS)',
          'ICE < 0,5 = baixo risco cardiometabólico',
          'O TMB estimado é exibido como referência — use o módulo de Gasto Energético para o cálculo completo'
        ]
      },
      {
        id: '05_08',
        titulo: 'Dobras cutâneas — seleção de protocolo',
        screenshot: '05_08_dobras_tela_inicial',
        descricao: '<p>O módulo de dobras cutâneas usa protocolos validados para estimar a composição corporal. O protocolo deve ser selecionado antes de qualquer preenchimento, pois determina quais dobras são obrigatórias.</p>',
        fields: [
          { nome: 'Protocolo *', descricao: 'Pollock 3 Homens, Pollock 3 Mulheres, Pollock 7, Durnin-Womersley ou Guedes' },
          { nome: 'Conversão de % gordura', descricao: 'Siri (padrão clínico) ou Brozek (atletas com alta musculatura)' },
          { nome: 'Avaliador', descricao: 'Nome do técnico que realizou a medição' },
          { nome: 'Equipamento', descricao: 'Marca e modelo do adipômetro utilizado' },
          { nome: 'Lado da medição', descricao: 'Direito (padrão) ou Esquerdo' },
          { nome: 'Limitação técnica', descricao: 'Marque se houve dificuldade técnica na coleta e descreva o motivo' }
        ],
        tips: [
          'Pollock 7 é o protocolo mais completo e indicado para alta precisão',
          'Pollock 3 Homens/Mulheres é mais ágil e suficiente para monitoramento de rotina',
          'Durnin-Womersley é indicado para populações não atletas',
          'Registre sempre o mesmo protocolo nas avaliações consecutivas para garantir comparabilidade'
        ]
      },
      {
        id: '05_09',
        titulo: 'Dobras cutâneas — protocolo Pollock 7 preenchido',
        screenshot: '05_09_dobras_pollock7_preenchido',
        descricao: '<p>Com o protocolo Pollock 7 selecionado, o formulário exibe os 7 pontos anatômicos obrigatórios: peitoral, axilar média, tríceps, subescapular, abdominal, suprailíaca e coxa. Cada campo exibe um tooltip com a técnica de medição.</p>',
        fields: [
          { nome: 'Peitoral (mm)', descricao: 'Dobra oblíqua na linha axilar anterior — obrigatória no Pollock 7' },
          { nome: 'Axilar média (mm)', descricao: 'Ponto médio da linha axilar média — obrigatória no Pollock 7' },
          { nome: 'Tríceps (mm)', descricao: 'Ponto médio posterior do braço — obrigatória no Pollock 7' },
          { nome: 'Subescapular (mm)', descricao: 'Abaixo do ângulo inferior da escápula — obrigatória no Pollock 7' },
          { nome: 'Abdominal (mm)', descricao: '2 cm ao lado da cicatriz umbilical — obrigatória no Pollock 7' },
          { nome: 'Suprailíaca (mm)', descricao: 'Acima da crista ilíaca na linha axilar média — obrigatória no Pollock 7' },
          { nome: 'Coxa (mm)', descricao: 'Face anterior da coxa no ponto médio — obrigatória no Pollock 7' }
        ],
        tips: [
          'Realize a dobra cutânea comprimindo a pele com polegar e indicador a 1 cm do paquímetro',
          'Aguarde 2 segundos após posicionar o adipômetro antes de registrar o valor',
          'Todos os valores devem estar em milímetros (mm)',
          'Valores fora da faixa fisiológica exibem aviso em laranja — confirme antes de salvar'
        ]
      },
      {
        id: '05_10',
        titulo: 'Dobras cutâneas — resultados e gráfico radar',
        screenshot: '05_10_dobras_resultados_radar',
        descricao: '<p>Com todos os campos preenchidos, o sistema calcula automaticamente: densidade corporal, percentual de gordura (Siri e Brozek), massa gorda e massa magra. O gráfico radar mostra o padrão regional das dobras. A tabela de comparação longitudinal contrasta o resultado atual com a avaliação anterior e a primeira avaliação.</p>',
        tips: [
          '% gordura calculado depende do protocolo e do método de conversão selecionados',
          'O delta (variação) mostra se o atleta evoluiu ou regrediu desde a última avaliação',
          'A interpretação textual abaixo da tabela resume a tendência principal'
        ]
      },
      {
        id: '05_11',
        titulo: 'Bioimpedância elétrica (BIA)',
        screenshot: '05_11_bioimpedancia',
        descricao: '<p>Registra os dados de composição corporal obtidos pela balança de bioimpedância. Os resultados são extraídos diretamente do equipamento e inseridos manualmente no sistema.</p>',
        fields: [
          { nome: 'Peso (kg)', descricao: 'Peso registrado pelo equipamento de BIA' },
          { nome: 'Estatura (cm)', descricao: 'Altura do atleta (sincronizada com perímetros se disponível)' },
          { nome: '% Gordura', descricao: 'Percentual de gordura corporal reportado pelo equipamento' },
          { nome: 'Massa magra (kg)', descricao: 'Massa livre de gordura reportada pelo equipamento' },
          { nome: 'Água corporal total (L)', descricao: 'Se disponível no relatório do equipamento' },
          { nome: 'Massa muscular esquelética (kg)', descricao: 'Se reportada pelo equipamento' }
        ],
        tips: [
          'O atleta deve estar em jejum de pelo menos 4h, sem exercício nas últimas 12h e sem cafeína nas últimas 24h',
          'Esvazie a bexiga antes da medição',
          'A massa magra da BIA é usada automaticamente no cálculo da disponibilidade energética'
        ]
      },
      {
        id: '05_12',
        titulo: 'Gasto energético total (GET)',
        screenshot: '05_12_gasto_energetico',
        descricao: '<p>Calcula o Gasto Energético Total combinando a Taxa Metabólica Basal (TMB) com o fator de atividade. Os dados da anamnese inicial (modalidade, frequência) são pré-carregados como sugestão.</p>',
        fields: [
          { nome: 'Peso (kg)', descricao: 'Base para cálculo da TMB' },
          { nome: 'Estatura (cm)', descricao: 'Base para cálculo da TMB' },
          { nome: 'Idade (anos)', descricao: 'Base para cálculo da TMB' },
          { nome: 'Sexo biológico', descricao: 'Determina a equação de TMB utilizada' },
          { nome: 'Fator de atividade', descricao: 'Sedentário (1,2), levemente ativo (1,375), moderadamente ativo (1,55), muito ativo (1,725), extremamente ativo (1,9)' }
        ],
        tips: [
          'Use Harris-Benedict revisada para adultos com peso normal',
          'O GET calculado serve como base para a prescrição calórica do plano alimentar',
          'Atletas de elite em treinamento intenso geralmente precisam de fatores superiores a 1,725'
        ]
      },
      {
        id: '05_13',
        titulo: 'Avaliação clínica',
        screenshot: '05_13_avaliacao_clinica',
        descricao: '<p>Registra parâmetros vitais e sinais clínicos coletados durante o atendimento. Os dados são usados na síntese de situação clínica do prontuário.</p>',
        fields: [
          { nome: 'Pressão arterial (mmHg)', descricao: 'Sistólica e diastólica. Valores de referência: < 120/80 mmHg' },
          { nome: 'Frequência cardíaca (bpm)', descricao: 'Em repouso. Valor de referência: 60–100 bpm' },
          { nome: 'Glicemia capilar (mg/dL)', descricao: 'Em jejum se possível. Referência: 70–99 mg/dL em jejum' },
          { nome: 'Temperatura (°C)', descricao: 'Se avaliada no atendimento' },
          { nome: 'Saturação O₂ (%)', descricao: 'Se oxímetro disponível. Referência: ≥ 95%' },
          { nome: 'Observações clínicas', descricao: 'Campo livre para registro de achados clínicos relevantes' }
        ],
        tips: [
          'Meça a pressão após 5 minutos de repouso sentado',
          'Alterações nos sinais vitais devem ser registradas em "Observações" e comunicadas ao professor supervisor'
        ]
      },
      {
        id: '05_14',
        titulo: 'Carga de treino semanal',
        screenshot: '05_14_carga_treino',
        descricao: '<p>Registra a carga de treinamento da semana atual, detalhando volume e intensidade por tipo de treino. Os dados são usados no cálculo da disponibilidade energética.</p>',
        fields: [
          { nome: 'Treino técnico/tático (min/sem)', descricao: 'Volume de treinos técnicos e táticos na semana' },
          { nome: 'Treino físico (min/sem)', descricao: 'Volume de condicionamento físico na semana' },
          { nome: 'Treino preventivo (min/sem)', descricao: 'Volume de prevenção e reabilitação na semana' },
          { nome: 'Gasto calórico do exercício (kcal/dia)', descricao: 'Estimado pelo sistema ou informado pelo atleta/técnico' }
        ],
        tips: [
          'Dados precisos de carga de treino melhoram significativamente a acurácia do cálculo de DE',
          'Solicite ao atleta ou técnico os dados da semana típica de treino'
        ]
      },
      {
        id: '05_15',
        titulo: 'Avaliação alimentar (grupos NOVA)',
        screenshot: '05_15_avaliacao_alimentar',
        descricao: '<p>Avalia o padrão alimentar do atleta usando a classificação NOVA de processamento de alimentos. Estima a ingestão calórica total e a proporção de cada grupo (in natura, minimamente processado, processado e ultraprocessado).</p>',
        fields: [
          { nome: 'Ingestão calórica estimada (kcal/dia)', descricao: 'Total energético médio diário do atleta' },
          { nome: 'Proporção alimentos in natura / minimamente processados (%)', descricao: 'Grupo 1 e 2 da classificação NOVA' },
          { nome: 'Proporção alimentos processados (%)', descricao: 'Grupo 3 da classificação NOVA' },
          { nome: 'Proporção ultraprocessados (%)', descricao: 'Grupo 4 da classificação NOVA — quanto menor, melhor' }
        ],
        tips: [
          'A ingestão calórica é usada no cálculo da Disponibilidade Energética',
          'Use um recordatório de 24h ou questionário de frequência alimentar para estimar as proporções'
        ]
      },
      {
        id: '05_16',
        titulo: 'Avaliação de hidratação',
        screenshot: '05_16_avaliacao_hidratacao',
        descricao: '<p>Avalia o estado de hidratação do atleta por meio de indicadores clínicos e laboratoriais simples.</p>',
        fields: [
          { nome: 'Ingestão hídrica diária (L/dia)', descricao: 'Volume total de líquidos consumidos por dia' },
          { nome: 'Cor da urina', descricao: 'Escala visual de 1 (transparente) a 8 (âmbar escuro)' },
          { nome: 'Peso pré-treino (kg)', descricao: 'Para cálculo da perda hídrica durante o exercício' },
          { nome: 'Peso pós-treino (kg)', descricao: 'Para cálculo da taxa de sudorese' }
        ],
        tips: [
          'Cor da urina ≤ 3 indica hidratação adequada',
          'Perda de mais de 2% do peso corporal durante o exercício indica desidratação significativa'
        ]
      },
      {
        id: '05_17',
        titulo: 'Disponibilidade energética',
        screenshot: '05_17_triagem_reds',
        descricao: '<p>Calcula a Disponibilidade Energética (DE) para rastreio de baixa disponibilidade energética. <strong>Requer</strong> que os módulos de Avaliação Alimentar e Carga de Treino estejam preenchidos.</p><p>Fórmula: DE = (Ingestão calórica − Gasto de exercício) ÷ Massa livre de gordura (kg)</p>',
        fields: [
          { nome: 'Ingestão calórica (kcal/dia)', descricao: 'Importado automaticamente da Avaliação Alimentar' },
          { nome: 'Gasto calórico do exercício (kcal/dia)', descricao: 'Importado automaticamente da Carga de Treino' },
          { nome: 'Massa livre de gordura (kg)', descricao: 'Importada automaticamente da BIA ou Dobras Cutâneas (a mais recente)' }
        ],
        tips: [
          'DE ≥ 45 kcal/kg MLG/dia = disponibilidade energética adequada',
          'DE entre 30 e 45 kcal/kg MLG/dia = disponibilidade energética reduzida',
          'DE < 30 kcal/kg MLG/dia = baixa disponibilidade energética — encaminhamento obrigatório ao professor supervisor',
          'O sistema bloqueia o cálculo enquanto Alimentar ou Carga de Treino não estiverem preenchidos'
        ]
      },
      {
        id: '05_18',
        titulo: 'Exames laboratoriais',
        screenshot: '05_18_exames_laboratoriais',
        descricao: '<p>Registra os principais parâmetros laboratoriais relevantes para a conduta nutricional esportiva. Os valores são comparados com referências clínicas padrão.</p>',
        fields: [
          { nome: 'Hemograma', descricao: 'Hemoglobina, hematócrito, série branca' },
          { nome: 'Ferritina (ng/mL)', descricao: 'Reserva de ferro — referência: 12–150 ng/mL (F) / 12–300 ng/mL (M)' },
          { nome: 'Vitamina D (ng/mL)', descricao: 'Referência: 30–100 ng/mL — insuficiência frequente em atletas' },
          { nome: 'Vitamina B12 (pg/mL)', descricao: 'Referência: 200–900 pg/mL' },
          { nome: 'TSH (mUI/L)', descricao: 'Referência: 0,4–4,0 mUI/L' },
          { nome: 'Glicemia de jejum (mg/dL)', descricao: 'Referência: 70–99 mg/dL' },
          { nome: 'Creatinina (mg/dL)', descricao: 'Marcador de função renal' }
        ],
        tips: [
          'Registre sempre a data de coleta dos exames',
          'Valores fora das faixas são marcados em vermelho para facilitar a identificação'
        ]
      },
      {
        id: '05_19',
        titulo: 'Avaliação socioeconômica',
        screenshot: '05_19_avaliacao_socioeconomica',
        descricao: '<p>Rastreia aspectos socioeconômicos e de segurança alimentar que podem impactar a adesão ao plano nutricional e o estado de saúde do atleta.</p>',
        tips: ['Os dados são tratados com sigilo e usados apenas para contextualizar a conduta nutricional']
      },
      {
        id: '05_20',
        titulo: 'Avaliação de fisioterapia',
        screenshot: '05_20_avaliacao_fisioterapia',
        descricao: '<p>Módulo interprofissional para registro da avaliação fisioterapêutica integrada ao prontuário nutricional.</p>',
        tips: ['Requer que um fisioterapeuta ou aluno de fisioterapia vinculado conduza esta avaliação']
      },
      {
        id: '05_21',
        titulo: 'Avaliação de psicologia',
        screenshot: '05_21_avaliacao_psicologia',
        descricao: '<p>Módulo interprofissional para registro de aspectos psicológicos relevantes para a performance esportiva e a relação com a alimentação.</p>',
        tips: ['Os dados desta avaliação têm acesso restrito ao aluno responsável e professor supervisor']
      },
      {
        id: '05_22',
        titulo: 'Evolução e retorno clínico',
        screenshot: '05_22_evolucao_retorno',
        descricao: '<p>Registra a evolução do atleta entre sessões e define o plano de retorno, incluindo os objetivos para o próximo atendimento e o prazo recomendado.</p>',
        fields: [
          { nome: 'Evolução percebida', descricao: 'Relato subjetivo do atleta sobre mudanças desde a última sessão' },
          { nome: 'Aderência ao plano alimentar', descricao: 'Avaliação da aderência: excelente, boa, regular ou ruim' },
          { nome: 'Conduta atual', descricao: 'Resumo das orientações nutricionais em vigor' },
          { nome: 'Plano para próxima sessão', descricao: 'Objetivos e avaliações a serem realizadas no retorno' },
          { nome: 'Prazo de retorno', descricao: 'Data ou período recomendado para o próximo atendimento' }
        ],
        tips: ['Preencha este módulo ao final de cada sessão para fechar o ciclo clínico']
      },
      {
        id: '05_23',
        titulo: 'Composição corporal integrada',
        screenshot: '05_23_composicao_corporal_integrada',
        descricao: '<p>Painel de síntese que consolida os dados de composição corporal de diferentes métodos (perímetros, dobras e BIA) em uma única visualização comparativa, facilitando a interpretação longitudinal.</p>',
        tips: ['Útil para comparar resultados de dobras e BIA na mesma sessão']
      }
    ]
  },
  {
    id: 'plano',
    titulo: 'Plano Alimentar',
    descricao: 'O módulo de plano alimentar permite ao aluno elaborar prescrições nutricionais completas com refeições, alimentos da tabela TACO/IBGE e cálculo automático de macronutrientes.',
    secoes: [
      {
        id: '06_01',
        titulo: 'Tela principal do plano alimentar',
        screenshot: '06_01_plano_alimentar_tela',
        descricao: '<p>A tela principal exibe o plano alimentar vigente do atleta, organizado por refeição. O cabeçalho mostra o total calórico e a distribuição de macronutrientes (proteínas, carboidratos e gorduras) do plano.</p>',
        tips: [
          'O objetivo calórico é calculado com base no GET do atleta',
          'Clique em "Nova refeição" para adicionar um novo horário ao plano',
          'O plano pode ser impresso ou exportado como PDF'
        ]
      },
      {
        id: '06_02',
        titulo: 'Builder de refeição — adicionando alimentos',
        screenshot: '06_02_plano_refeicao_builder',
        descricao: '<p>O builder de refeição permite adicionar alimentos da tabela TACO/IBGE com busca por nome. Cada alimento exibe os macronutrientes por porção e o total da refeição é calculado em tempo real.</p>',
        tips: [
          'Use a busca para encontrar alimentos pelo nome: "arroz branco", "frango grelhado", etc.',
          'Ajuste a quantidade em gramas para calcular os nutrientes da porção desejada',
          'Suplementos podem ser adicionados como itens especiais'
        ]
      }
    ]
  },
  {
    id: 'atleta',
    titulo: 'Perfil Atleta',
    descricao: 'O atleta acessa o portal para visualizar seu prontuário, resultados de avaliações e agenda de atendimentos. A interface é simplificada e voltada para leitura. O atleta de exemplo é <strong>Lucas Gabriel Cunha</strong>.',
    secoes: [
      {
        id: '07_01',
        titulo: 'Dashboard do atleta',
        screenshot: '07_01_atleta_dashboard',
        descricao: '<p>O painel do atleta exibe um resumo da situação clínica atual, próximos agendamentos e alertas relevantes. O design é simplificado para facilitar a compreensão sem conhecimento técnico.</p>',
        tips: ['Notificações na barra superior indicam quando há novas avaliações disponíveis']
      },
      {
        id: '07_02',
        titulo: 'Prontuário do atleta (leitura)',
        screenshot: '07_02_atleta_prontuario',
        descricao: '<p>O atleta visualiza seu prontuário em modo somente leitura. Pode ver os resultados das avaliações, o plano alimentar vigente e as orientações registradas pelo aluno/nutricionista responsável.</p>',
        tips: ['Os dados clínicos são apresentados de forma simplificada, sem jargão técnico', 'Dúvidas sobre os resultados devem ser esclarecidas com o aluno responsável']
      },
      {
        id: '07_03',
        titulo: 'Agenda do atleta',
        screenshot: '07_03_atleta_agenda',
        descricao: '<p>Exibe os agendamentos futuros do atleta com data, horário, local e aluno responsável. O atleta pode confirmar ou solicitar reagendamento diretamente pela plataforma.</p>',
        tips: ['Confirme os agendamentos com antecedência para evitar faltas']
      },
      {
        id: '07_04',
        titulo: 'Resultados das avaliações',
        screenshot: '07_04_atleta_avaliacoes',
        descricao: '<p>Lista todas as avaliações realizadas com datas e principais resultados. Gráficos de evolução mostram a tendência de indicadores como % gordura e composição corporal ao longo do tempo.</p>',
        tips: ['Clique em qualquer avaliação para ver o relatório completo']
      },
      {
        id: '07_05',
        titulo: 'Pendências do atleta',
        screenshot: '07_05_atleta_pendencias',
        descricao: '<p>Lista formulários ou documentos que o atleta precisa preencher ou assinar, como termos de consentimento e questionários de autoavaliação.</p>',
        tips: ['Pendências devem ser resolvidas antes do próximo atendimento']
      }
    ]
  },
  {
    id: 'equipe',
    titulo: 'Perfil Equipe Técnica',
    descricao: 'A equipe técnica acompanha os atletas vinculados, com acesso às informações de composição corporal e evolução. O usuário de exemplo é <strong>Rodrigo Santos Bezerra</strong>.',
    secoes: [
      {
        id: '08_01',
        titulo: 'Portal da equipe técnica',
        screenshot: '08_01_equipe_tecnica_portal',
        descricao: '<p>O portal da equipe técnica exibe os atletas vinculados com seus dados de composição corporal mais recentes, facilitando o acompanhamento de performance e periodização.</p>',
        tips: ['O técnico pode ver os dados mas não pode editar avaliações']
      },
      {
        id: '08_02',
        titulo: 'Lista de atletas da equipe',
        screenshot: '08_02_equipe_tecnica_atletas',
        descricao: '<p>Exibe os atletas do projeto com indicadores de composição corporal atualizados, para subsidiar as decisões de treinamento do técnico.</p>',
        tips: []
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────
// LEITURA DE SCREENSHOTS
// ─────────────────────────────────────────────────────────────
function lerScreenshotsComoBase64(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`[aviso] Diretório de screenshots não encontrado: ${dir}`);
    console.warn('[aviso] Execute o tour Playwright antes de gerar o manual.');
    return {};
  }
  const mapa = {};
  const arquivos = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  for (const arquivo of arquivos) {
    const nome = arquivo.replace('.png', '');
    const conteudo = fs.readFileSync(path.join(dir, arquivo));
    mapa[nome] = `data:image/png;base64,${conteudo.toString('base64')}`;
  }
  console.log(`[info] ${arquivos.length} screenshots carregados.`);
  return mapa;
}

// ─────────────────────────────────────────────────────────────
// GERAÇÃO DO HTML
// ─────────────────────────────────────────────────────────────
function gerarSumario(capitulos) {
  let html = '<nav class="toc"><h2>Sumário</h2><ol>';
  let capNum = 0;
  for (const cap of capitulos) {
    capNum++;
    html += `<li><a href="#cap-${cap.id}">${capNum}. ${cap.titulo}</a>`;
    if (cap.secoes && cap.secoes.length) {
      html += '<ol>';
      for (const sec of cap.secoes) {
        html += `<li><a href="#sec-${sec.id}">${sec.titulo}</a></li>`;
      }
      html += '</ol>';
    }
    html += '</li>';
  }
  html += '</ol></nav>';
  return html;
}

function gerarSecao(sec, screenshots) {
  let html = `<section class="secao" id="sec-${sec.id}">`;
  html += `<h3>${sec.titulo}</h3>`;

  if (sec.descricao) html += `<div class="descricao">${sec.descricao}</div>`;

  if (sec.fields && sec.fields.length) {
    html += '<div class="fields-table"><h4>Campos do formulário</h4><table><thead><tr><th>Campo</th><th>Descrição</th></tr></thead><tbody>';
    for (const f of sec.fields) {
      html += `<tr><td><strong>${f.nome}</strong></td><td>${f.descricao}</td></tr>`;
    }
    html += '</tbody></table></div>';
  }

  if (sec.screenshot) {
    const img = screenshots[sec.screenshot];
    if (img) {
      html += `<div class="screenshot-wrap"><img src="${img}" alt="${sec.titulo}" class="screenshot" loading="lazy" /></div>`;
    } else {
      html += `<div class="screenshot-placeholder"><span>Screenshot: ${sec.screenshot}.png</span><br><small>Execute o tour Playwright para gerar esta imagem.</small></div>`;
    }
  }

  if (sec.tips && sec.tips.length) {
    html += '<div class="tips"><h4>Dicas e boas práticas</h4><ul>';
    for (const tip of sec.tips) {
      html += `<li>${tip}</li>`;
    }
    html += '</ul></div>';
  }

  html += '</section>';
  return html;
}

function gerarCapitulo(cap, screenshots, num) {
  let html = `<article class="capitulo" id="cap-${cap.id}">`;
  html += `<div class="capitulo-header"><span class="capitulo-num">${num}</span><h2>${cap.titulo}</h2></div>`;
  if (cap.descricao) html += `<p class="capitulo-intro">${cap.descricao}</p>`;
  if (cap.secoes) {
    for (const sec of cap.secoes) {
      html += gerarSecao(sec, screenshots);
    }
  }
  html += '</article>';
  return html;
}

function gerarHtml(capitulos, screenshots) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const sumario = gerarSumario(capitulos);
  let corpo = '';
  let num = 0;
  for (const cap of capitulos) {
    num++;
    corpo += gerarCapitulo(cap, screenshots, num);
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manual do Usuário — Sistema LAINES</title>
<style>
  :root {
    --primary: #1D3350;
    --accent: #74A865;
    --light-blue: #56ADDB;
    --surface: #f8fafc;
    --border: #e2e8f0;
    --text: #1e293b;
    --text-muted: #64748b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: var(--text); background: #fff; line-height: 1.7; }

  /* CAPA */
  .capa { background: var(--primary); color: #fff; padding: 80px 60px; text-align: center; page-break-after: always; }
  .capa .logo { font-size: 3rem; font-weight: 800; color: var(--accent); letter-spacing: 4px; margin-bottom: 8px; }
  .capa h1 { font-size: 2rem; font-weight: 600; margin-bottom: 12px; }
  .capa p { font-size: 1.1rem; opacity: 0.8; }
  .capa .data { margin-top: 40px; font-size: 0.9rem; opacity: 0.6; }

  /* LAYOUT */
  .container { max-width: 960px; margin: 0 auto; padding: 40px 40px; }

  /* SUMÁRIO */
  .toc { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 32px; margin-bottom: 48px; page-break-after: always; }
  .toc h2 { font-size: 1.4rem; color: var(--primary); margin-bottom: 20px; border-bottom: 2px solid var(--accent); padding-bottom: 8px; }
  .toc ol { padding-left: 24px; }
  .toc li { margin: 6px 0; }
  .toc a { color: var(--primary); text-decoration: none; }
  .toc a:hover { color: var(--accent); }
  .toc > ol > li { font-weight: 600; font-size: 1rem; }
  .toc > ol > li ol { font-weight: 400; font-size: 0.9rem; margin-top: 4px; }

  /* CAPÍTULOS */
  .capitulo { margin-bottom: 60px; page-break-before: always; }
  .capitulo-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; border-bottom: 3px solid var(--primary); padding-bottom: 12px; }
  .capitulo-num { background: var(--primary); color: #fff; font-size: 1.4rem; font-weight: 800; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .capitulo h2 { font-size: 1.6rem; color: var(--primary); }
  .capitulo-intro { color: var(--text-muted); margin-bottom: 32px; font-size: 1rem; line-height: 1.8; }

  /* SEÇÕES */
  .secao { margin-bottom: 48px; border: 1px solid var(--border); border-radius: 8px; padding: 28px; }
  .secao h3 { font-size: 1.2rem; color: var(--primary); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--accent); }
  .descricao { color: var(--text); margin-bottom: 20px; line-height: 1.8; }
  .descricao p { margin-bottom: 12px; }

  /* SCREENSHOTS */
  .screenshot-wrap { margin: 20px 0; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
  .screenshot { max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
  .screenshot-placeholder { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 6px; padding: 40px; text-align: center; color: var(--text-muted); margin: 20px 0; font-size: 0.9rem; }

  /* TABELAS */
  .fields-table { margin: 20px 0; }
  .fields-table h4 { font-size: 0.95rem; color: var(--primary); margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { background: var(--primary); color: #fff; padding: 10px 14px; text-align: left; }
  td { padding: 9px 14px; border-bottom: 1px solid var(--border); }
  tr:nth-child(even) td { background: var(--surface); }
  .info-table { margin: 20px 0; }

  /* DICAS */
  .tips { background: #f0fdf4; border-left: 4px solid var(--accent); border-radius: 0 6px 6px 0; padding: 16px 20px; margin-top: 20px; }
  .tips h4 { font-size: 0.9rem; color: var(--accent); margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .tips ul { padding-left: 18px; }
  .tips li { margin: 5px 0; font-size: 0.9rem; color: #166534; }

  /* IMPRESSÃO */
  @media print {
    .capa { padding: 60px 40px; }
    .secao { page-break-inside: avoid; }
    .screenshot { max-width: 100%; }
  }
</style>
</head>
<body>

<div class="capa">
  <div class="logo">LAINES</div>
  <h1>Manual do Usuário</h1>
  <p>Liga Acadêmica Interprofissional de Nutrição Esportiva — UFRN</p>
  <p>Sistema de Gestão Clínica e Académica</p>
  <div class="data">Gerado automaticamente em ${hoje} • Versão 1.0</div>
</div>

<div class="container">
  ${sumario}
  ${corpo}
</div>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const screenshots = lerScreenshotsComoBase64(SCREENSHOTS_DIR);
const html = gerarHtml(CAPITULOS, screenshots);

fs.writeFileSync(OUTPUT_FILE, html, 'utf8');
const tamanhoKb = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
console.log(`[ok] Manual gerado: ${OUTPUT_FILE} (${tamanhoKb} KB)`);
console.log('[ok] Abra o arquivo no navegador para visualizar antes de converter para DOCX.');
