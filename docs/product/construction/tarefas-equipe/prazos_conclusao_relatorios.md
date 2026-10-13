# Tarefas de equipe: prazo, entrega e desempenho

@work-item-id WI-014

## Contrato da tarefa

Cada tarefa conserva `id`, `title`, `status` e `assignedRole`. `dueDate` é uma data civil (`YYYY-MM-DD`) obrigatória para novas atribuições a `diretoria_*` e `coord_atendimento`; registros antigos continuam com `null`. O prazo inclui todo o dia em `America/Sao_Paulo`. O contador usa diferença entre datas civis: futuro “Faltam N dias”, hoje “Vence hoje”, passado “Atrasada há N dias”; após conclusão, mostra a entrega.

Uma tarefa tem uma conclusão vigente para toda a equipe, com `completedAt`, `completedById`, `completedByName` e `completionNote` opcional. Autor e horário vêm do servidor/JWT. Repetir a ação em uma tarefa já concluída não cria segunda entrega nem substitui autor, data ou nota. A conclusão é gravada atomicamente com um evento de histórico. O histórico também registra reabertura, troca de equipe, alteração de prazo e arquivamento. A gestão pode reabrir; isso invalida a conclusão vigente, preservando o evento anterior para auditoria.

Tarefas novas não começam como concluídas. Nenhum `PATCH` genérico pode passar a `concluida`; lista, Kanban e cabeçalho chamam o endpoint de conclusão. O botão apresenta uma observação opcional antes do envio. A gestão altera título, equipe, prazo ou estados abertos; concluídas podem ser arquivadas sem apagar seu histórico. Tarefas arquivadas não aparecem na lista ativa, mas entregas registradas continuam nos relatórios.

## Acesso

Criar/editar/reabrir/arquivar continuam ações de admin/coordenação. Integrantes da equipe atribuída podem concluir a tarefa uma vez; admin/coordenação também. O servidor determina a equipe por `role` e `diretoria`, como já faz na leitura. Uma tarefa institucional para `todos` não pode ser concluída por atleta. O consolidado de todas as diretorias é só para admin/coordenação; o endpoint específico não herda o acesso amplo dos relatórios clínicos. A observação acompanha apenas o detalhe da tarefa para quem já pode vê-la e não sai no agregado/exportação.

Eventos em tempo real só invalidam dados e seguem a mesma audiência de leitura/conclusão: `todos` é institucional, diretoria exige papel apto, e atleta não recebe eventos de tarefas institucionais. Quando a equipe muda, a audiência antiga e a nova recarregam seus dados. A tela de relatório reage a eventos e oferece atualização manual.

## Relatório

Uma seção “Tarefas por diretoria” na área de Relatórios lê `GET /tarefas/relatorio` com filtro de período independente do projeto clínico: últimos 7 dias civis inclusivos, mês atual, trimestre calendário atual ou ano atual, com datas exatas na resposta. Para cada equipe, a coorte principal são tarefas cujo `dueDate` cai no período: total com prazo, entregues no prazo, entregues em atraso, abertas vencidas, abertas ainda no prazo e arquivadas sem conclusão. “Pontualidade das entregas” = entregues no prazo / (entregues no prazo + entregues em atraso); sem entregas, mostrar travessão. Tarefas antigas sem prazo criadas no período aparecem separadamente como “Sem prazo” e não entram nessa taxa. Registros legados com status concluído mas sem `completedAt` aparecem como “Conclusão sem registro”, também fora da taxa. `todos` e papéis não-diretoria são “Geral/outros”. Arquivamento não retira uma entrega do consolidado nem transforma tarefa cancelada em aberta.

Um CSV/JSON próprio do relatório de tarefas carrega apenas grupos e contagens, nunca observações ou nomes de pacientes. Toda resposta de relatório identifica o período, a data de geração e a definição do denominador. Não se infere prazo ou data de entrega de `updatedAt`. Alterações e reaberturas posteriores são reconhecíveis no histórico; o consolidado representa o estado vigente no momento da geração.

## Verificação

Testar concorrência/idempotência da conclusão, acesso por equipe, bloqueio de atalhos, data civil no fuso, legados sem prazo, reabertura/arquivamento e cálculo do relatório. Conferir a mesma tarefa nos três pontos de interface e em largura móvel. Migração é aditiva e não roda no banco real nesta entrega.
