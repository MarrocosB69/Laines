# Onda 0 — estabilização local

Escopo aprovado: UPD-01 a UPD-08. [Intenção](change-intent.md).

| Item | Comportamento implementado |
|---|---|
| UPD-01 | Recuperação por token aleatório, hash persistido, validade de 15 minutos e consumo único em transação. Contato registrado recebe o link. Senhas temporárias não são entregues nem armazenadas em texto. Projeção administrativa preserva dados necessários à edição; acesso delegado recebe campos reduzidos. |
| UPD-02 | HTTP e WebSocket verificam família, versão e estado atual da sessão. Logout revoga a família. Recuperação revoga todas. Eventos clínicos entregam somente invalidação aos vinculados; sessão ociosa é revalidada a cada cinco segundos. |
| UPD-03 | Exportação respeita projeto e projeção permitida; CSV neutraliza texto interpretável como fórmula. |
| UPD-04 | Upload valida objeto/permissão antes de receber arquivo; verifica tamanho, assinatura e caminho. Falha de persistência remove o arquivo novo e preserva o anterior. |
| UPD-05 | Inscrição pública repetida não altera cadastro existente; resposta uniforme e bloqueios transacionais por CPF/email. |
| UPD-06 | Prescrição com schema 2, migração compatível do legado, catálogo preservado e cálculo conferido entre frontend, servidor e projeção do PDF. |
| UPD-07 | Revisão usa identidade/registro do profissional no banco e versão exata. Composição manual ou legada exige conferência explícita. Cliente não forja assinatura nem publica como aluno. |
| UPD-08 | YAML corrigido, erros de lint resolvidos e regressões incluídas no CI. Execução remota do pipeline em revisão imutável permanece pendente. |

## Evidências

A consolidação mais recente está nas [evidências da onda 1](../onda-1/evidencias/): 100 testes do núcleo, 16 verificações de credenciais, 8 de realtime, 11 de acesso/upload e 10 de prescrição. Cinco integrações usaram PostgreSQL 18 temporário, API HTTP real e sockets reais, com dados sintéticos e email substituído em memória. Houve ensaio de migrações no banco temporário; nenhum banco real foi alterado.

## Publicação e limites

Aplicar a migração SecureAccountRecovery antes da API e publicar frontend/backend juntos. Tokens antigos sem identificador de família exigem novo login. Contas dependentes de senha temporária precisam de ativação pelo contato cadastrado. APP_URL exige HTTPS, exceto localhost; SMTP e entrega real de email ainda precisam de homologação.

UPD-12 ainda deve unificar todo o acesso clínico HTTP por vínculo e finalidade. As notificações clínicas novas foram reduzidas; não houve saneamento de notificações históricas no banco real. Nem os testes locais nem a instalação de ferramentas representam aprovação de produção.

Rollback deve preservar a migração de proteção ou manter indisponível a recuperação antiga. Não restaurar senhas em texto. Reverter somente arquivos/hunks identificados, preservando o trabalho anterior.
