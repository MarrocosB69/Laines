# Change Intent — sidebars no padrão da primeira página, guiadas pelas capacidades do servidor

Data: 26/09/2026. O usuário pediu para organizar todas as sidebars com os agentes da primeira página, já organizando pelas permissões, no mesmo padrão visual da landing. O commit fica com o usuário.

## Decisões do usuário (26/09/2026)

1. **Estrutura guiada pelo servidor.** Um modelo único de navegação para os cinco portais. As seções aparecem conforme as capacidades (`capabilities`) que o servidor já envia em `/auth/me`. Antes de mudar qualquer visibilidade, o orquestrador lista as diferenças e o usuário confirma.
2. **Comunicação para professor e equipe técnica.** O servidor autoriza as quatro áreas da liga (`liga.areas`) para todo não atleta, e a sidebar deles passa a mostrar a Comunicação, só leitura, como a do aluno. Isso **revoga** a exclusão deliberada registrada em `src/views/professor/ProfessorView.jsx` (`LIGA_ROOTS_PROFESSOR`, "o professor não tem essa área").
3. **Aluno sem vínculo** (`capabilities.atendimento.motivo === 'sem_vinculo'`). "Meus Atletas", "Minha Agenda" e "Avaliação por imagem" continuam visíveis, com o selo "Sem vínculo" e a dica para completar supervisor e projeto.

## Fora dessas decisões, a visibilidade não muda

| Portal | Hoje | Depois |
|---|---|---|
| Admin (`/admin`) | Abas filtradas por `getAllowedAdminTabsFromCapabilities` | Igual. O modelo usa a mesma função. |
| Aluno (`/aluno`) | Minha rotina, Liga (4), Minha diretoria (`liga.gerencia`), Avaliações | Igual, mais o selo de sem vínculo. |
| Professor (`/professor`) | Supervisão, Áreas (3) | Supervisão e Liga (4, com a Comunicação). |
| Equipe (`/equipe`, técnico) | Atendimento, Áreas (3) | Atendimento e Liga (4, com a Comunicação). |
| Atleta (`/atleta`) | Meu acompanhamento | Igual. |
| Atalhos entre portais | Área do Aluno, Portal do Professor, Administração, Presidência | Iguais, com as mesmas condições. |

Achados sem efeito visível, só registrados:
- O ramo "profissional" (`isMulti`) de `TeamSidebar` é inalcançável, porque `/equipe` só aceita `tecnico` e `profissional` vai para `/professor`.
- O `requestsCount` não é passado à sidebar do admin (`AdminView.jsx`), e o selo de solicitações nunca aparece.

## Arquivos e donos

| Superfície | Arquivos | Dono |
|---|---|---|
| Visual: tokens e casca da sidebar, cabeçalho, rodapé e gaveta do celular | `src/views/shared/sidebar-tokens.css`, `src/views/SidebarShell.css`, `src/views/shared/SidebarHeader.jsx` e `SidebarFooter.jsx` (só markup visual) | agente A |
| Modelo de navegação, componente único e teste; as cinco sidebars viram invólucros finos, com as mesmas props | `src/navigation/sidebarModel.js` (novo), `src/components/navigation/LainesSidebar.jsx` (novo), `scripts/test-sidebar-modelo.cjs` (novo), e os cinco `*Sidebar.jsx`/`StudentSideBar.jsx` | agente B |
| Comunicação nos portais do professor e da equipe | `src/views/professor/ProfessorView.jsx`, `src/views/Team/TeamPortal.jsx` e os testes de navegação que travavam a exclusão (`scripts/test-contexto-navegacao.cjs`, `scripts/test-navegacao-liga.cjs`, se for o caso) | agente C |

Cópia de antes: `tmp/sidebars-v1/`. Os arquivos já tinham alterações não commitadas de ondas anteriores.

## Fora do escopo

- O servidor e a autorização. O servidor continua decidindo o acesso; a sidebar só reflete.
- As rotas do `App.jsx`, o conteúdo das telas de cada área e o painel admin.
- A correção do `requestsCount` e a remoção do código morto do `TeamSidebar`: só relatar. O ramo morto some naturalmente se o invólucro não o reproduzir.

## Invariantes

1. **Nenhum item aparece sem capacidade.** Áreas da liga ⊆ `liga.areas`, gestão da área ⊆ `liga.gerencia` e abas do admin ⊆ `getAllowedAdminTabsFromCapabilities`. Um teste prova isso.
2. **Exceto as decisões 2 e 3,** cada portal mostra os mesmos itens, na mesma ordem de seções e com os mesmos rótulos e destinos de hoje. Um teste com usuários sintéticos por perfil prova isso.
3. As props de cada sidebar, e portanto as views que as montam, não mudam.
4. Colapsar e expandir, a gaveta do celular (Escape, clique fora) e o foco continuam funcionando. Os alvos têm 44 px ou mais, o foco é visível e o contraste de texto é de 4,5:1 ou mais.
5. O visual segue o padrão da landing: tokens `--lt-*`, par Sofia Sans e a voz de campanha na marca.

## Testes

- `npm run lint`, `npm run test:ui` (com o teste novo) e `npm run build`.
- Verificação em navegador pelo orquestrador, numa rodada única: os cinco portais com sessão sintética (`scripts/verificar-tela.mjs --papel=...`), a 1280 e a 390 px, com a sidebar aberta e a gaveta do celular aberta.
- Revisão independente.

## Reversão

1. Copie `tmp/sidebars-v1/src/...` de volta.
2. Apague `src/navigation/sidebarModel.js`, `src/components/navigation/` e `scripts/test-sidebar-modelo.cjs`.
3. Reverta as alterações de `ProfessorView.jsx`, `TeamPortal.jsx` e dos testes de navegação pelo diff.
