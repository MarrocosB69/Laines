# WI-015 — página única para quem tem dois papéis

@work-item-id WI-015

## Intenção de mudança

Hoje quem tem dois papéis usa **duas páginas**, com barras laterais diferentes e um atalho para trocar entre elas:
- o **aluno presidente ou vice** fica na Área do Aluno e usa o atalho "Presidência", que leva a `/admin`; de lá, o atalho "Área do Aluno" traz de volta;
- o **professor com acesso administrativo** fica no Portal do Professor e usa o atalho "Administração", que leva a `/admin`; de lá, o atalho "Portal do Professor" traz de volta.

O usuário pediu, em 02/10/2026, que essas pessoas tenham **uma página só**. A barra lateral reúne a parte do papel de origem (aluno ou professor) e a parte de direção ou gestão, sem trocar de página nem navegar entre funções.

## Decisões do usuário (02/10/2026)

1. **Vale para todos com dois papéis:** aluno presidente ou vice (aluno + direção) e professor com acesso administrativo (professor + administração). Admin e coordenação puros, e a coordenação de atendimento, continuam como estão, em `/admin`.
2. **Uma Visão geral só, com as duas partes:** o bloco do papel de origem (minha rotina ou supervisão) e um bloco "Direção" ou "Gestão" (indicadores da liga, solicitações, o que precisa de ação), na mesma tela.
3. **Nomes:** "Meus atletas" fica na rotina, e o cadastro geral da gestão vira **"Cadastro de atletas"**. O mesmo critério vale para Membros, por exemplo "Cadastro de membros", se houver colisão.

## Comportamento esperado

- **A página da pessoa é a do papel de origem:** `/aluno` para o aluno presidente ou vice, `/professor` para o professor com administração.
- **A barra lateral única tem as seções do papel de origem e mais uma seção de gestão.** Os itens de gestão são os mesmos que a pessoa vê hoje em `/admin`, decididos pelas mesmas `capabilities` do servidor (`getAllowedAdminTabsFromCapabilities`).
- **Sem itens repetidos:** as áreas da Liga já aparecem em "Liga" e em "Minha diretoria", e não se repetem na gestão.
- **As telas de gestão** (Membros, Cadastro de atletas, Solicitações, Relatórios, Configurações) **abrem dentro da mesma página**, com os mesmos componentes de hoje.
- **Os atalhos "Presidência", "Administração", "Área do Aluno" e "Portal do Professor" somem** para quem tem dois papéis.
- **Quem abre `/admin` com dois papéis** é levado à página única, na aba equivalente, sem perder a aba pedida.
- **O retorno de telas próprias** (prontuário, avaliação, plano alimentar) volta à página única.

## Não objetivos

- **Mudar permissões:** quem pode ver ou fazer o quê continua decidido pelo servidor (`capabilities`). Nenhuma permissão nova e nenhuma regra relaxada.
- **Mudar `/admin`** para admin e coordenação puros, e para a coordenação de atendimento.
- **Mudar o servidor.**
- **Mudar o conteúdo das telas de gestão.** Elas só passam a abrir dentro da página única.

## Invariantes

1. **As mesmas telas de gestão para a mesma pessoa,** com o mesmo critério de `capabilities`. A prova é por teste do modelo da barra lateral com perfis sintéticos: antes, o que a pessoa via somando as duas páginas; depois, o que vê na página única.
2. **Sem acesso novo:** um aluno sem `capabilities.gestao` não ganha nada.
3. **Os perfis de um papel só** (aluno comum, professor comum, admin, coordenação, coordenação de atendimento, equipe e atleta) ficam **iguais**.
4. **A navegação de prontuário e avaliação** (WI-007) continua funcionando, com o "Voltar" levando à página única.
5. **Nenhum dado real** em teste.

## Verificação

- Testes do modelo de navegação atualizados para a página única: `test-sidebar-modelo`, `test-contexto-navegacao`, `test-navegacao-liga`, `tests/core/roles.test.mjs` e `test-security-authorization`, com perfis sintéticos dos dois papéis e dos papéis simples.
- ESLint e os testes estáticos pertinentes.
- **Quando a máquina for liberada:** navegador com perfis sintéticos (aluno presidente, professor com administração, aluno comum e admin) e revisão independente.

## Rollback

Os backups estão em `tmp/wi014-v1/`, nos mesmos caminhos.

## Resultado (02/10/2026)

**Executor Opus.** Conferência do orquestrador:
- ESLint limpo;
- `tests/core/roles.test.mjs`: 8/8;
- `test-sidebar-modelo`: 38;
- `test-navegacao-liga`: 28;
- `test-contexto-navegacao`: 17;
- `test-painel`: 17.

O executor também rodou `run-core-tests` (101 ok) e comparou com SSR o backup contra o atual em 19 perfis sintéticos com `buildCapabilities` real. Para quem tem dois papéis, as telas de gestão são as mesmas de antes. Nos perfis de um papel só, o modelo e a rota inicial não mudaram, e a prova por mutação pegou 11 de 12.

**Nada foi visto em navegador.** Para a verificação, use um presidente sintético **com** `users:manage`, `requests:review` e `patients:manage`: o do seed e2e não tem permissões.

### Para decidir
1. **Aluno de diretoria e aluno com permissão avulsa entram como dois papéis.** O servidor lhes dá `gestao.relatorios.painel`, então eles ganham a seção "Direção", quase sempre só com Relatórios. Antes, caíam em `/admin`. *Resolvido pelo WI-016 em 12/10/2026: ver abaixo.*
2. **Ficam fora e mantêm as duas páginas:** colaborador com o painel e os papéis legados `diretoria_*`.
3. **A agenda geral do admin** ficou fora da Visão geral única.
4. **O selo de solicitações pendentes** é aceito pelo modelo, mas nenhuma tela fornece o número, como já acontecia no `AdminView`.

### Atualização pelo WI-016 (12/10/2026)
- **A aba Relatórios** passou a exigir `gestao.relatorios.exportacao`, a mesma regra dos endpoints, ou `gestao.relatorios.perfilAtletas`. Só o painel não basta mais.
- **Aluno de diretoria só com o painel volta a entrar por `/admin`.** Vale para Ensino, Extensão e Pesquisa, e para quem tem só permissão avulsa de painel. Sem outra tela de gestão, ele não tem dois papéis e perde a seção "Direção". Aluno de diretoria sem permissão continua em `/aluno` (UX-04).
- **Aluno com Comunicação** (`marketing:create`) e professor com `research:manage` mantêm Relatórios e a página única.
- **`coord_atendimento`** ganha a aba Relatórios só com o Perfil dos atletas e continua em `/admin`.
- **Testes ajustados à regra nova:** `test-navegacao-liga`, `test-contexto-navegacao`, `test-sidebar-modelo` e `tests/core/roles.test.mjs`.

### Achados fora do escopo
- **Credencial real em texto puro** em `scripts/journey-audit.mjs` (perfil presidente), **rastreado pelo git desde o commit inicial** (`66f014d`). Recomendação: trocar a senha dessa conta e deixar no script só a leitura por variável de ambiente.
- `scripts/journey-audit.mjs` e `capture-profile-screenshots.mjs` esperam o presidente em `/admin` e precisam ser atualizados.
- `ProfessorHeader.jsx` não tem rótulo para `comunicacao`.

> Renumerado de WI-014 para WI-015 em 02/10/2026: o número WI-014 já era usado por `docs/inception/tarefas-equipe/WI-014` (outra frente).
