# Inicializacao do runtime de tarefas

@work-item-id WI-017

Os campos nullable `completedByName` e `actorName` armazenam nomes de ate 120 caracteres como `varchar(120)` no PostgreSQL. As entidades TypeORM declaram `type: 'varchar'` explicitamente porque a anotacao TypeScript `string | null` produz `Object` em `design:type` e nao permite inferencia segura na inicializacao.

A alteracao e apenas de metadados da entidade: mantem nome da coluna, limite, nulabilidade, migration existente, payloads e autorizacao. O aceite exige boot normal sem ajuste temporario, usando banco sintetico isolado; build e lint so demonstram compilacao.
