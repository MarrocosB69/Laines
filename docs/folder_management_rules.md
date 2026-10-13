# Organização LAINES

- src/: React, apresentação, estado de interação e cálculo compartilhado existente; servidor continua autoridade de acesso e persistência.
- server/src/: módulos Nest por domínio; DTOs validam entradas, serviços impõem regras e repositórios persistem.
- server/src/database/migrations/: evolução explícita do banco; não criar schema em execução de requisição.
- scripts/ e tests/: verificação reproduzível, com dados sintéticos.
- docs/auditoria-2026-09-11/: linha de base histórica; docs/implementacao/: evidências novas.
- docs/inception/: itens rastreáveis; docs/product/: design aceito. Referenciar a proposta existente e evitar duplicações contraditórias.
- tmp/: artefatos temporários; não incluir dados clínicos/credenciais em commits.
- .agents/skills e skills/: instruções externas com origem registrada; não são código de aplicação.

Arquivos existentes não devem ser movidos ou apagados como efeito de instalar ferramentas.
