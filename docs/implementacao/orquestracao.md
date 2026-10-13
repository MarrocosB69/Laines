# Orquestração do trabalho por agentes

Registro de como a execução da auditoria é dividida. Não substitui a [proposta](../auditoria-2026-09-11/proposta-atualizacao.md), que continua sendo o escopo.

## Papéis

| Papel | Quem | Responsabilidade |
|---|---|---|
| Orquestrador | A sessão principal | Decide a ordem pelas dependências do backlog, define a fronteira de arquivos de cada agente, redireciona agentes vivos quando um achado muda o plano, integra e registra a evidência. |
| Executor | `.claude/agents/laines-executor.md` | Implementa **um** item, dentro de uma lista fechada de arquivos. |
| Revisor | `.claude/agents/laines-revisor.md` | Confere a entrega de outro agente contra o critério de aceite e roda as provas. Não escreve código de produção. |

Agentes não conversam entre si. Toda coordenação passa pelo orquestrador.

## Regra de partição

Dois agentes simultâneos nunca recebem o mesmo arquivo. A divisão é por **fronteira de arquivos**, não por tema — dois temas distintos podem colidir no mesmo componente.

Itens que disputam os shells de navegação (`StudentView.jsx`, `ProfessorView.jsx`, `AthleteView.jsx`, `Sidebar.jsx`) são executados em série: UPD-13, UPD-16, UPD-17 e UPD-18.

## Isolamento

Os agentes trabalham no diretório de trabalho atual, não em worktree separada. Motivo registrado: o repositório tem mais de 200 arquivos alterados sem commit, incluindo as ondas 0, 1 e 2; uma worktree parte do último commit e não enxergaria esse trabalho. A segurança vem da partição de arquivos e da conferência do diff antes da integração.

## Portão de entrada

Uma entrega só é integrada depois de:

1. Revisor independente com veredito registrado.
2. Diff restrito à lista de arquivos autorizada.
3. Lint, tipos e testes pertinentes executados, com saída real registrada.
4. Evidência escrita em `docs/implementacao/onda-N/README.md` e estado atualizado em `docs/implementacao/status.json`.

Nenhum agente commita, publica ou faz deploy. Verificação local não é homologação.
