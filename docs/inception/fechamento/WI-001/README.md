# WI-001 — Estabilização da versão

Status: implementação e validação local; homologação pendente.
Origem e aceite: [UPD-01 a UPD-08](../../../auditoria-2026-09-11/backlog.json).
Autorização: usuário aprovou a proposta e solicitou execução por etapas.
Intenção, limites, invariantes e rollback: [registro de execução](../../../implementacao/onda-0/change-intent.md).
Design aceito: [contratos de estabilização](../../../product/construction/fechamento/logical_design.md).

Critério: reproduções de segurança rejeitadas, integridade de plano preservada, pipeline executável. Ensaios PostgreSQL, entrega SMTP controlada e CI em revisão imutável ainda precisam de evidência; testes com doubles não os substituem.
