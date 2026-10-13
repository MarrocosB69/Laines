# Onda 3 — execução local e limites de fechamento

@work-item-id WI-004

A [intenção e histórico detalhado](../../inception/fechamento/WI-004/README.md) cobrem UPD-19, UPD-20, UPD-21 e UPD-22. Esta página registra a continuação de 2026-09-27. A auditoria original permanece como linha de base, e estes resultados não aprovam implantação.

## Correção que destravou a jornada

`POST /pacientes/:id/anexos` gravava o multipart antes de verificar o vínculo assistencial. Um professor sem acesso recebia 404, mas deixava um PDF órfão. O interceptor agora recebe até 10 MB em memória, mantém a checagem de UUID, MIME e extensão, e o serviço grava com nome exclusivo somente após verificar paciente, vínculo atual e permissão. Em falha de gravação ou persistência, o serviço tenta remover o arquivo novo; o teste confirmou a limpeza quando `repo.save` falha. Uma falha do próprio sistema de arquivos ao remover ainda pode deixar órfão. O evento de atualização só é emitido após salvar o metadado.

O teste HTTP sintético `scripts/test-patient-attachment-upload.cjs` cobre negativa sem arquivo/metadado, upload e download íntegros, vínculo revogado e falha de persistência preservando o anexo anterior: **3/3, exit 0**. Entrou em `npm run test:security`, que passou por completo (**exit 0**). A jornada PostgreSQL isolada passou pelos **12 grupos**, incluindo duas equipes com papéis iguais, negativas cruzadas, WebSocket, revogação e upload negado sem órfão.

## Restauração isolada da aplicação

O runner `scripts/test-release-local.cjs` aplicou **42 migrations reais** no cluster PostgreSQL 18.3 criado em `127.0.0.1:55439`, executou a API sintética em `127.0.0.1:44100`, fez dump/cópia dos arquivos com a API parada e restaurou em banco e diretório de uploads novos. **23 tabelas** e **2 arquivos** corresponderam aos snapshots de linhas, schema, constraints, índices, sequences, caminhos, tamanhos e SHA-256. A API reiniciada consultou os mesmos pacientes, avaliações, planos/PDFs e anexos, preservando vínculo e revogação. O cluster e a API próprios foram encerrados; **8 checks do runner e a verificação pós-restauração passaram, exit 0**. [Relatório e artefatos](../../../tmp/onda3-release-local-8renYj/report.json).

O primeiro ensaio desta continuação parou no upload órfão, conforme WI-004. Após a correção, outra tentativa passou pela jornada e pelo backup, mas o Windows recusou renomear a pasta original (`EPERM`); [relatório da tentativa](../../../tmp/onda3-release-local-pcR552/report.json). O runner passou a restaurar os uploads em uma pasta nova dentro do diretório exclusivo, preservando a original e a cópia de backup. Essa tentativa falha não foi contada como aprovação. A execução dentro do sandbox também falhou ao iniciar `pg_ctl` (erro 87); o ensaio válido foi executado fora dele com revisão automática aprovada, usando apenas o cluster e as portas sintéticas declaradas.

## Verificações e pendências

- `npm.cmd --prefix server run lint`: exit 0, tipos do backend corretos.
- `npm.cmd run lint`: exit 0, zero erros e oito avisos já registrados; guardrails de copy/permissão passaram.
- `npm.cmd run test:security`: exit 0, incluindo os três cenários novos de anexo.
- `node --check` dos dois scripts alterados/novos: exit 0.
- `npm.cmd run phasegate:check-ready`: PASS, zero stories; não é prova funcional.
- `npm.cmd run guard:phasegate -- validate --layer L2 --format human`: PASS, 7 validadores aprovados e 1 skip.

UPD-19 tem documentação atualizada no recorte do WI-004, mas o inventário imutável da release ainda falta. UPD-22 passou em testes locais anteriores; câmera real, processador e MinIO continuam sem homologação. UPD-20 concluiu a jornada integrada local; não cobre navegador real. UPD-21 comprovou migrations, backup e restore da **mesma versão** da aplicação em ambiente isolado; continuam pendentes rollback entre versões, Nginx/TLS, storage e CI remoto em revisão imutável. Uploads simultâneos no mesmo paciente ainda podem disputar o array de metadados; isso exige trabalho próprio. Nenhum banco real, paciente real, e-mail, commit ou deploy foi usado nesta continuação.

Revisão independente do resultado: **PASS com ressalva**, sem bloqueio. A ressalva é a possibilidade de falha na remoção do arquivo novo quando o próprio sistema de arquivos recusa `unlink`; os testes não simulam esse erro físico.

Reversão desta etapa: retirar somente os deltas de upload no controller/service, o teste novo e seu registro em `test:security`, e a troca do diretório restaurado no runner. Preservar os demais deltas locais e os relatórios históricos.

## Inventário do candidato local — UPD-19

Os builds frontend e backend foram reconstruídos a partir da árvore local e passaram (exit 0). `scripts/inventory-release-candidate.mjs` identificou os bytes que a etapa `package-release` do workflow de deploy **copiaria**: 77 arquivos de frontend, 661 do backend e os dois manifests npm do servidor, 740 arquivos e 9.623.679 bytes no total. Cada entrada tem tamanho e SHA-256; o hash agregado da lista ordenada é `a52f610e2c2004efbf7e65dde79d9c4c0ea1c94f052f178566b493451c1988ac`. [Manifesto local](../../../tmp/onda3-inventario/candidato-local-01.json).

`create` e `verify` passaram (exit 0). Uma cópia com o hash do `frontend/apple-touch-icon.png` alterado foi recusada (exit 1), identificando esse caminho como divergente. O script impede sobrescrever o manifesto e escreve somente em `tmp/onda3-inventario/`; não lê `.env`, `uploads/`, banco nem dados reais. A receita atual gera `release.json` no CI após copiar os componentes, portanto esse arquivo não integra o inventário local. O processador de imagem também não integra o pacote atual.

O HEAD observado é `a55e05f2b152fc35c34dc8938229b16e571b360c`, com 666 linhas de alterações locais no momento da captura. Assim, os hashes identificam somente este **candidato local mutável**; não provam derivação do commit, release imutável, CI remoto ou deploy. UPD-19 continua parcial. Para fechar, será necessário comparar o artefato gerado por CI em revisão congelada com a receita, o manifesto e os componentes efetivamente publicados.

Verificações desta continuação: `node --check`, build frontend/backend, `npm run lint` (exit 0, oito avisos fora deste script), PhaseGate L2 (7 pass, 1 skip), `phasegate:check-ready` e `p2:validate-pointers` passaram. PhaseGate L3 continua falhando apenas em L3-003 porque a configuração exige relatório de cobertura de 90% que não está presente; não foi alterada a configuração para contornar o gate.
