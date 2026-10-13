# Intenção de mudança — onda 1

@work-item-id WI-002

O usuário reiterou que a prioridade é executar a auditoria. Retomar UPD-09 e UPD-10, reutilizando o sistema existente. Ferramentas de desenvolvimento ficam em segundo plano.

- Problema: dependências com avisos conhecidos; publicação e entrega da prescrição ainda não completam a jornada do atleta.
- Comportamento: atleta vê apenas seu plano vigente, com orientações, porções, alternativas e responsável; PDF corresponde à versão visualizada; publicação substitui o plano anterior sem apagar histórico.
- Arquivos: módulos/serviços de planos, portal do atleta e editor existente, testes sintéticos, manifests de dependências e documentação de execução.
- Invariantes: sessão e vínculo continuam obrigatórios; autoria profissional vem do servidor; nenhum teste usa paciente real; plano novo não apaga o anterior; nenhuma atualização força compatibilidade de dependências.
- Verificação: contrato de prescrição, concorrência em PostgreSQL isolado, sequência revisão/publicação/leitura/PDF, navegador e build/lint/core pertinentes. Auditar dependências novamente depois de atualizar.
- Rollback: reverter apenas mudanças desta frente identificadas no manifesto; preservar histórico e trabalho anterior. Nenhum deploy nesta etapa.
- Limites: não inventar referências nutricionais ou novos formulários; UPD-11/12/17/20 dependem de evidência específica.
