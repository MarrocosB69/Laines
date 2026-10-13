# Verificação LAINES

Mudança de comportamento relevante precisa de evidência contra os cenários da auditoria. Testes negativos devem provar a rejeição e a ausência de efeitos indevidos. Não usar pacientes reais nem enviar emails em testes.

Registrar código de saída, escopo, ambiente e limite de cada execução. Não trocar teste falho por skip ou afrouxar autorização para satisfazer fixture antiga. Atualizar fixtures quando o contrato mudou, mantendo a intenção original.

Build, tipos, lint e doubles não equivalem a testes de PostgreSQL, navegação autenticada, SMTP ou homologação de produção. Resultado não executado deve aparecer como pendente.
