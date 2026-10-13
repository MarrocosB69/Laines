# Página única para quem tem dois papéis

@work-item-id WI-015

- **Quem tem dois papéis** fica na página do papel de origem (`/aluno` ou `/professor`). A barra lateral reúne essa parte e uma seção de gestão: **"Direção"** para o aluno, **"Gestão"** para o professor.
- **Dois papéis** (`temDoisPapeis` em `src/constants/roles.js`) quer dizer:
  - papel com página de origem: `aluno`, `presidente` ou `vice`; ou `professor`, `profissional` ou `pesquisador`;
  - `user.canAccessAdmin`;
  - pelo menos uma tela de gestão pelas `capabilities` do servidor.
- **Telas de gestão na página única:** Membros, Cadastro de atletas, Solicitações, Relatórios e Configurações, com os mesmos componentes do `/admin` e ids `gestao_*`. "Meus atletas" fica na rotina.
- **Visão geral única:** a parte do papel de origem e um bloco "Direção" ou "Gestão" (`DashboardStats` com `blocoDeGestao`), sem duplicar o cabeçalho e sem a agenda geral.
- **`/admin`** leva quem tem dois papéis à aba equivalente da página única. Admin, coordenação e `coord_atendimento` continuam em `/admin`.
- **Permissões:** não mudam. O servidor continua decidindo tudo por `capabilities`.

@work-item-id WI-016

- **Relatórios na página única** (decisão de 12/10/2026): a aba entra como tela de gestão com `gestao.relatorios.exportacao`, a mesma regra dos endpoints, ou com `gestao.relatorios.perfilAtletas`. Só o painel (`gestao.relatorios.painel`) não abre mais a aba.
- **Aluno de diretoria só com o painel volta a entrar por `/admin`.** É o caso de Ensino, Extensão e Pesquisa, e de quem tem só permissão avulsa de painel: sem outra tela de gestão, não tem dois papéis e perde a seção "Direção". A diretoria sozinha continua levando a `/aluno`; é a permissão explícita que abre `/admin`.
- **`coord_atendimento`** ganha a aba Relatórios só com o Perfil dos atletas e continua em `/admin`, sem página única.
