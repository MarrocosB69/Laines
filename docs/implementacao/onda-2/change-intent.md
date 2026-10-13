# Intenção de mudança — onda 2

@work-item-id WI-003

O usuário pediu para iniciar a onda 2 seguindo o documento. A onda 2 da proposta (UPD-13 a 16 e 18) depende de UPD-12 e UPD-11, pendentes da onda 1. A ordem executada respeita as dependências do backlog: UPD-12 → UPD-11 → UPD-13 → UPD-14 → UPD-15 → UPD-16 → UPD-17 → UPD-18, com UPD-20 acompanhando cada item.

## UPD-12 — contrato de autorização

- Problema: a regra de acesso clínico está repetida em pacientes, avaliações, planos, agendamentos e realtime, com diferenças entre si (planos e agendamentos ignoram a cadeia de supervisão; pacientes e avaliações a reconhecem). A interface deriva capacidades do papel no cliente. Acesso técnico (admin/coordenação) a prontuário é implícito e sem trilha.
- Comportamento: uma função única no servidor decide o vínculo clínico por objeto (`gestao`, `responsavel`, `supervisor`, `equipe`, `supervisao_aluno`, `atleta`) e um único fragmento SQL filtra listagens. Leitura acadêmica publicada continua transversal às quatro diretorias; rascunhos e gestão ficam na área própria. O servidor projeta capacidades (`liga`, `atendimento`, `gestao`) em `/auth/me` e no login. Acesso de gestão a registro clínico gera trilha de auditoria.
- Arquivos: `server/src/auth/authorization.ts` (novo), `access-control.ts`, `jwt.strategy.ts`, `auth.service.ts`, serviços de pacientes, avaliações, planos, agendamentos, realtime; `scripts/test-security-authorization.cjs` (novo) e `package.json`.
- Invariantes: nenhum papel amplia acesso por URL ou payload; atleta só vê o próprio registro; aluno só por vínculo; professor/profissional por supervisão direta, equipe ou cadeia do aluno supervisionado; conteúdo em rascunho não vaza para outra diretoria; nenhuma alteração de banco.
- Verificação: matriz de autorização sintética (aluno sem/com diretoria, outra diretoria, professor com/sem cadeia, atleta, admin), regressões existentes (`test:security`, `test:core`), lint e build.
- Rollback: reverter os arquivos listados no manifesto da onda; sem migração envolvida.
- Limites: admin/coordenação mantêm acesso clínico como exceção auditada; retirar esse acesso é decisão operacional separada. Não cria novos cadastros nem formulários.

## UPD-11 — referências e restrições

Registrado após a conclusão do UPD-12 neste mesmo arquivo.
