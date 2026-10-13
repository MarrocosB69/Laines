# Portao do ensaio analitico local

@work-item-id WI-017

O harness passa os mesmos emails sinteticos de tecnico e atleta aos seeds de usuarios e analytics, evitando referencias ausentes na fixture.

O comando local de analytics escreve fixtures. Por isso recebe `DB_NAME` explicitamente, aceita somente nome `laines_audit_*`, host PostgreSQL de loopback e API HTTP de loopback. A verificacao ocorre antes do healthcheck e antes de executar qualquer seed. `server/.env` fornece usuario e senha locais, mas nunca escolhe o nome do banco para esse comando. Contagens estritas sao o padrao para detectar API apontada a outro conjunto de dados. A execucao positiva e feita apenas com dados sinteticos e banco isolado.
