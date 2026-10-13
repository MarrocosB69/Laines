# Avaliacao corporal por imagem — integracao experimental

O wizard usa um contrato persistente; nao existe geracao de resultados demonstrativos no frontend.

## Fluxo HTTP

1. `POST /avaliacoes-imagem` cria a avaliacao, as quatro capturas JPEG e a captura de video.
2. `POST /avaliacoes-imagem/:id/upload-urls` devolve URLs `PUT` assinadas apenas para capturas ainda nao confirmadas, enquanto o registro aguarda upload.
3. O navegador envia os arquivos diretamente ao MinIO (ou ao armazenamento local em desenvolvimento).
4. `POST /avaliacoes-imagem/:id/capturas/:captureId/concluir-upload` confirma cada objeto.
5. A confirmacao do quinto objeto inicia o job no processador configurado.
6. `GET /avaliacoes-imagem/:id/status` consulta o job.
7. `GET /avaliacoes-imagem/:id/resultados` devolve o resultado persistido.

Todas as rotas da API, inclusive a URL local assinada de upload, exigem JWT. A leitura e as mutacoes conferem novamente o vinculo atual ao paciente pelo contrato UPD-12; autoria historica nao substitui vinculo. Essa exigencia tambem vale para leitura de imagens pela rota generica `GET /avaliacoes/:id`, sem alterar a politica dos demais tipos de avaliacao. As permissoes de edicao existentes continuam aplicaveis. O navegador usa a sessao apenas no upload local da mesma origem e do prefixo configurado da API; nunca encaminha a sessao ao MinIO. Emissao de URLs e leitura de resultados produzem eventos de auditoria sem URLs ou imagens.

Mutacoes HTTP do tipo `composicao_corporal_imagem` pela rota generica `/avaliacoes` sao recusadas: criacao, atualizacao/finalizacao, revisao e exclusao devem seguir `/avaliacoes-imagem`. A leitura generica de registros historicos continua disponivel conforme o vinculo clinico. Essa barreira vale para as rotas HTTP; o servico dedicado continua usando a persistencia de avaliacoes internamente.

O status inclui somente a vista e a confirmacao das capturas, sem chaves de armazenamento. Ao reabrir o wizard, capturas confirmadas permanecem no servidor; o navegador solicita apenas as vistas pendentes. Previews novos permanecem em memoria, sem persistencia local de imagens. A confirmacao repetida e idempotente. Capturas confirmadas nao recebem novas URLs nem podem ser substituidas pelo endpoint local.

## Armazenamento

Em producao, configure:

```env
IMAGE_STORAGE_DRIVER=minio
MINIO_ENDPOINT=minio.exemplo.institucional
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_IMAGE_BUCKET=laines-imagens-corporais
MINIO_AUTO_CREATE_BUCKET=false
```

`MINIO_ENDPOINT` precisa ser alcancavel pelo navegador porque aparece na URL pre-assinada. O bucket deve permanecer privado e o CORS do MinIO deve permitir `PUT` da origem do LAINES.

O driver `local` existe apenas para desenvolvimento. Ele usa URLs HMAC com validade de 15 minutos e requer `IMAGE_UPLOAD_SIGNING_SECRET`.

Mesmo com `UPLOAD_PUBLIC_ACCESS` ativo, a API bloqueia a entrega estatica de `uploads/avaliacoes-imagem`, inclusive caminhos codificados e variantes de separadores/case do Windows. Objetos legados permanecem no mesmo lugar. A ilustracao corporal do wizard nao monta URL publica para meshes privados. Nginx ou outro servidor independente nao pode expor esse diretorio; o bloqueio da API nao protege aliases de arquivos configurados fora dela.

Limite do MinIO: URLs pre-assinadas ja emitidas permanecem utilizaveis durante seu TTL de 15 minutos. Revogar o vinculo impede novas URLs, leitura de resultados e confirmacao pela API, mas nao revoga antecipadamente uma URL ja emitida pelo storage. A configuracao efetiva de bucket, expiracao, retencao e proxies precisa ser homologada no ambiente. Nao foi implementada politica automatica de retencao nesta etapa. Na exclusao, se o storage falhar, o mapeamento no banco permanece para permitir nova tentativa; nao se afirma exclusao concluida nesse caso.

## Contrato do processador 3D

Configure `IMAGE_PROCESSOR_URL` e um `IMAGE_PROCESSOR_TOKEN` longo e exclusivo nos dois servicos. O processador nao deve publicar sua porta na rede externa. O NestJS chama:

```http
POST {IMAGE_PROCESSOR_URL}/jobs
Content-Type: application/json
Authorization: Bearer <token-interno>
```

Payload resumido:

```json
{
  "evaluationId": "uuid",
  "protocolVersion": "quatro_vistas_rgb_v1",
  "anthropometry": {
    "peso": 70,
    "estatura": 175,
    "sexo": "masculino",
    "idade": 31,
    "idadeOrigem": "paciente.dataNascimento",
    "idadeReferenciaEm": "2026-09-28"
  },
  "captures": [
    {
      "captureId": "uuid",
      "vista": "frontal",
      "mimeType": "image/jpeg",
      "source": { "type": "url", "url": "https://..." }
    }
  ]
}
```

Resposta assincrona:

```json
{
  "jobId": "processor-job-id",
  "status": "em_processamento",
  "progress": 10,
  "algorithmVersion": "2.1.1"
}
```

O polling usa `GET {IMAGE_PROCESSOR_URL}/jobs/:jobId`. Ao concluir, a resposta deve incluir `status: "completed"` e `results` com, no minimo:

```json
{
  "percGordura": 14.8,
  "massaGorda": 10.4,
  "massaMagra": 59.6,
  "rcq": 0.82,
  "metodo": "ellipse_polar_2d_ensemble_v2"
}
```

Sem `IMAGE_PROCESSOR_URL`, os uploads sao preservados e o status fica `aguardando_processador`; nenhum percentual e inventado.

## Estados e resultados experimentais — UPD-22

@work-item-id WI-004

`aguardando_upload` conserva capturas parciais; depois das cinco confirmacoes, `iniciando` encaminha o job e `em_processamento` conserva seu identificador para consultas posteriores. A manutencao reconcilia tambem a interrupcao entre a ultima confirmacao e o inicio do job. `aguardando_processador` continua observavel por polling. Falha ao iniciar fica persistida como `falha`, com capturas preservadas; uma nova tentativa explicita e permitida a partir de `falha` ou `aguardando_processador`. Tentativas duplicadas durante processamento e substituicao de capturas concluidas sao recusadas.

Indisponibilidade temporaria na consulta nao elimina o identificador do job. Conclusao sem resultados obrigatorios validos vira falha explicita. Avaliacao e processamento sao concluidos na mesma transacao; falha de persistencia durante polling preserva o job para nova consulta, sem classifica-la como resultado invalido. Resultado de uma tentativa anterior nao e devolvido pelo endpoint especializado enquanto a tentativa atual nao estiver concluida. A conciliacao evita duas partidas simultaneas na mesma instancia; concorrencia entre multiplas instancias e idempotencia do processador externo ainda precisam de verificacao operacional.

O resultado declara `natureza: estimativa`, `validacaoClinica: nao_comprovada`, origem e versao informada pelo processador. Valores obrigatorios ausentes, vazios ou nulos nao se tornam zero. A interface nao inventa versao, cobertura em graus ou pontuacao de precisao; qualidade desconhecida aparece como nao informada. Confianca na calibracao e ajuste do modelo nao demonstram precisao clinica. Indices, intervalos e classificacoes recebidos do processador continuam experimentais; nao substituem medidas de referencia nem constituem base automatica de conduta. Ate o WI-004, o algoritmo/modelo nao havia sido alterado.

## Ajustes de origem e apresentacao — WI-008

@work-item-id WI-008

A idade e calculada a partir da data de nascimento do cadastro e registrada com data de referencia e origem no snapshot desta avaliacao, quando valida para a equacao adulta de Deurenberg. Sem idade valida, essa equacao e omitida da combinacao; nao se usa 25 anos por padrao. A correcao do contrato HTTP usa a versao `2.1.1`, separando-a dos resultados `2.1.0` anteriores. Os resultados historicos nao sao recalculados.

O esquema HTTP do processador declara `idade`, `idadeOrigem` e `idadeReferenciaEm` e os repassa ao pipeline. O teste de contrato valida a requisicao completa e confere que `model_dump()` preserva esses tres campos; antes dessa correcao, o Pydantic descartava a idade enviada pelo servidor e Deurenberg era omitida em todos os jobs recebidos por HTTP.

A interface prioriza percentual e massas como estimativas. Idade corporal, score de risco, triagem de panturrilha e intervalo numerico sem cobertura validada nao aparecem como conclusao clinica, inclusive quando constam de payloads legados. O cartao do prontuario conserva o selo experimental e nao pinta variacao de percentual como melhora. A heuristica de captura mede apenas brilho, nitidez e contraste; a pessoa confirma visualmente o enquadramento antes de cada foto.

## Evidencia local e limites

Em 2026-09-21, `node scripts/test-image-evaluation.cjs` passou 16 verificacoes com fonte real, repositorios sinteticos, renderizacao da interface e HTTP em loopback. Incluem negativas de vinculo e ausencia de efeitos, leitura pela rota generica, confirmacao/retomada, falhas e resultados ausentes, falha transacional simulada, exclusao com storage indisponivel, upload local com bases absolutas/relativa e exclusao do diretorio privado da entrega estatica. No Windows, dez variantes de caminho aceitas pelo static sem a protecao foram bloqueadas; arquivos publicos permaneceram acessiveis.

Esses testes nao executam camera, MediaRecorder real, MinIO, PostgreSQL, processador/modelo real, validacao contra medidas de referencia nem restauracao de producao. A homologacao ponta a ponta e a validacao clinica continuam pendentes. Design e escopo: [WI-004](../inception/fechamento/WI-004/README.md).

## Implantacao

- Executar a migration `1782037200000-CreateAvaliacaoImagem`.
- Recarregar o Nginx para aplicar `Permissions-Policy: camera=(self)`.
- Ao usar MinIO, configurar `PROCESSOR_ALLOWED_SOURCE_HOSTS` com o hostname exato do endpoint.
- Manter a porta do processador acessivel somente na rede interna dos containers.
- Testar camera e MediaRecorder em Android/Chrome e iPhone/Safari.
- Confirmar que URLs assinadas nao aparecem em logs ou eventos de auditoria.
