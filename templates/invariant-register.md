# Invariant Register

List the rules that must not be broken by agent-generated changes.

| ID | Invariant | Why it matters | How to verify |
|---|---|---|---|
| INV-001 | Dados pessoais não redefinem senha; tokens expiram e são consumidos uma única vez. | Impede tomada de conta. | test-security-credentials.cjs |
| INV-002 | Eventos e HTTP verificam sessão e vínculo atuais. | Evita acesso entre equipes e após revogação. | test-security-realtime.cjs e matriz HTTP |
| INV-003 | Inscrição repetida não altera cadastro; upload negado não grava. | Protege integridade e arquivos. | test-security-access.cjs |
| INV-004 | Plano preserva dados legados e mantém totais coerentes; revisão pertence à sessão e versão. | Integridade do atendimento. | test-prescription-contract.cjs |
| INV-005 | Não enviar email real nem usar pacientes reais nos testes. | Privacidade e isolamento. | Fixtures sintéticas e SMTP simulado |
| INV-006 | Preservar trabalho local anterior e evidências históricas. | Evita perda e falsa rastreabilidade. | Manifestos por etapa; sem reset/clean |
