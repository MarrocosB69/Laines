# Operacao e Producao

@work-item-id WI-004

## Fontes canônicas

| Tema | Referência vigente | Alcance |
| --- | --- | --- |
| Autorização | [Matriz de autorização](../rbac-matrix.md) | Papéis, permissões, vínculo por objeto e canal; apêndice de maio explicitamente histórico. |
| Contratos do produto | [Contratos de estabilização](../product/construction/fechamento/logical_design.md) | Identidade, plano versionado, publicação, autorização e design aceito da onda 3. |
| Uso do sistema | [Manual HTML](../manual/manual-laines.html#atualizacao-2026-09-21) | Orientação editorial atualizada; imagens e demais exemplos de maio preservados. DOCX/PDF e manuais por perfil continuam exportações históricas. |
| Imagem experimental | [Integração por imagem](avaliacao-imagem.md) | Contrato, estados, limitações e verificação específica do UPD-22. |
| Escopo e validação da onda 3 | [WI-004](../inception/fechamento/WI-004/README.md) | Intenção, autorização, evidências e pendências. |
| Execução das melhorias | [Índice de implementação](../implementacao/README.md) | Entregas por onda e localização das evidências, sem reclassificar a auditoria histórica como estado atual. |

Os documentos operacionais abaixo conservam seu escopo e data. Relatórios `readiness-*`, o Go/No-Go de março e a auditoria de setembro são fotografias das respectivas execuções; resultados antigos de vulnerabilidades ou testes não certificam a árvore atual. Pendências de homologação são registradas no WI-004.

## Procedimentos existentes

- [CI/CD](./CICD.md)
- [SLOs](./SLO.md)
- [Runbooks](./RUNBOOKS.md)
- [Checklist de Producao](./PRODUCTION_CHECKLIST.md)
- [Capturas por perfil](./profile-screenshots.md)

## Candidato local UPD-19

Revisão documental em 21/09/2026. O HEAD observado foi `a55e05f2b152fc35c34dc8938229b16e571b360c`, mas há alterações locais anteriores e trabalho simultâneo em outros itens. Esse commit não identifica sozinho o candidato, e este inventário cobre somente o recorte revisado do UPD-19. Nenhum pacote de release ou deploy foi produzido.

Arquivos editados neste recorte: `README.md`, `docs/rbac-matrix.md`, `docs/manual/manual-laines.html`, este índice e apenas o comentário sobre a prescrição em `src/App.jsx`. Nos arquivos preexistentes, foram preservadas as alterações anteriores. O contrato do plano permanece no design canônico, e o documento de imagem pertence ao UPD-22.

| Arquivo revisado | SHA-256 após a revisão UPD-19 |
| --- | --- |
| [README](../../README.md) | `a0132c3b562d7390bcb50cc16775a58208c54cf455650d864a2e02e9cc31e2f1` |
| [Matriz](../rbac-matrix.md) | `632bb49c7c1a8833bfec96990fd1ef66618030e65553f6fd4762cdd1c0a7d93e` |
| [Manual HTML](../manual/manual-laines.html) | `787bc5b95778e9d83b6c241d02a999b384151f5b8027490a10dd9b4025e944a8` |
| [App.jsx — comentário](../../src/App.jsx) | `76fc853fd74c4a891a926cc6b0e1933d6fd09cd00c6152b33f37fceab9d6498b` |

Este índice não contém o próprio hash: sua identificação final e o resultado da verificação ficam no registro da execução [WI-004](../inception/fechamento/WI-004/README.md). Os hashes identificam os arquivos inteiros da árvore local, incluindo trabalho anterior; não atribuem todas essas alterações ao UPD-19.

As principais fontes lidas para atualizar a matriz estão identificadas abaixo. São referências da documentação, não uma declaração de revisão integral do código ou inventário global da aplicação.

| Fonte consultada | SHA-256 observado |
| --- | --- |
| [Papéis e permissões](../../server/src/common/domain/access.constants.ts) | `af73abf929f547a970f5b54d1a64ae81bef45c56373bc269cef5b39f730567c1` |
| [Vínculo e capacidades](../../server/src/auth/authorization.ts) | `5c057c7bd98cc6ae29bb97f28aea6dd3ee5d3ab175a9970f0edf65bf5ccd32ba` |
| [Decisões de acesso](../../server/src/auth/access-control.ts) | `ab4bf9b570e450c0ed654156d3fab8e78d7fd3f3d7e415681feffcaf49768ae6` |

O manual recebeu um aviso editorial e oito correções pontuais de texto. As 30 tags de imagem, seus dados base64 e sua ordem foram comparados antes/depois, sem diferença. SHA-256 da lista ordenada de hashes individuais: `8e1f3e3d78f8962ab6f7ceb07ae7f18c6ba36a45dd87f82d635cc0565cbbf119`. A lista usa objetos `{index, sha256}`, índices de 1 a 30 e serialização `JSON.stringify`; cada hash individual é da tag `<img>` completa em UTF-8. A data de geração original da capa foi preservada.

Para conferir um arquivo listado, execute `Get-FileHash -Algorithm SHA256 -LiteralPath '<caminho-do-arquivo>'` na raiz do repositório. Uma mudança posterior exige conferir novamente os trechos documentados e atualizar sua identificação; não basta manter o mesmo HEAD.

## Destino e retenção dos artefatos

Esta classificação mantém os arquivos em seus locais atuais. Não executa limpeza, migração de conteúdo, geração de capturas ou exclusão de dados.

| Local atual | Destino e uso | Retenção |
| --- | --- | --- |
| `docs/auditoria-2026-09-11/evidencias/` e `docs/implementacao/**/evidencias/` | Evidência histórica e evidência de implementação, respectivamente; citar a execução e seu escopo. | Preservar durante o fechamento e enquanto sustentar uma conclusão; descarte exige decisão específica, não incluída nesta onda. |
| `e2e-artifacts/`, `test-results/`, `screenshots-tcc/`, `tcc-figuras/` e capturas avulsas na raiz | Materiais de execução/publicação já existentes, separados dos fontes por seu local. Para novos ensaios, usar subdiretório da execução e referenciar as evidências selecionadas, sem duplicá-las. | Preservar o material existente; selecionar e registrar o que sustentará a homologação antes de qualquer limpeza futura. |
| `public/screenshots/` | Assets existentes usados pela aplicação/documentação. Não classificar como descartáveis por serem imagens. | Manter enquanto houver referência; remoção exige conferir os consumidores. |
| `docs/manual/manual-laines.docx` e `docs/manuals/` | Exportações e manuais históricos. O HTML com aviso editorial é a referência de uso atualizada neste recorte. | Manter originais e identificar a revisão antes de redistribuir. Não executar os geradores antigos sobre o HTML atualizado sem incorporar a revisão editorial na fonte geradora. |
| `tmp/`, `logs/` e logs avulsos | Trabalho local e diagnósticos, fora do candidato UPD-19. Não copiar em bloco para documentação ou pacote. | Conservar até revisão do responsável; eventual promoção de evidência deve limitar o conteúdo ao necessário, sem credenciais ou dados clínicos. |
| `laines-app.tar.gz`, `laines-image-processor.zip`, `profile-screenshots-patch.tar.gz`, `dist/` e `server/dist/` | Pacotes/builds existentes, sem correspondência demonstrada com este inventário. Não servem como identificação da release final. | Manter até reconciliação explícita com fontes e validações; nenhuma substituição/remoção nesta etapa. |
| `uploads/` e armazenamento de imagens | Dados da aplicação, fora da categoria de temporários e do inventário documental. | Preservar; restauração e política operacional pertencem à homologação, sem acesso aos dados reais nesta revisão. |

O fechamento do UPD-21 ainda requer identificar os componentes efetivamente publicados, migrations e configuração do ambiente, além de evidência de backup/restore e jornadas após rollback. A lista acima não afirma que frontend, API, processador e banco já correspondem a uma versão homologada.

## Inventário local dos componentes do pacote

Em 27/09/2026, o [inventário do candidato](../../tmp/onda3-inventario/candidato-local-01.json) registrou os 740 arquivos que a etapa `package-release` copiaria após builds locais: `frontend/`, `server/dist/` e os dois manifests npm do servidor. O hash agregado é `a52f610e2c2004efbf7e65dde79d9c4c0ea1c94f052f178566b493451c1988ac`. Para reproduzir a conferência dos bytes ainda presentes, execute `node scripts/inventory-release-candidate.mjs verify candidato-local-01.json` na raiz. A receita também cria `release.json` somente no CI; esse arquivo não está no inventário local.

O relatório marca a árvore como alterada em relação ao HEAD. Não usar esse hash como ID de release, prova de CI ou homologação. O pacote atual não inclui o processador de imagem. A evidência completa e os limites estão no [registro da onda 3](../implementacao/onda-3/README.md).
