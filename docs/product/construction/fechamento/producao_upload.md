# Anexos de producao cientifica

@work-item-id WI-017

O multipart fica em memoria ate `ProjetosService.createProducao` verificar papel, existencia do projeto e arquivo. So depois disso o servidor grava em `uploads/projetos/{projetoId|geral}/producoes/` com nome aleatorio. Extensao, MIME e assinatura de PDF, imagem, OLE ou pacote OOXML devem concordar. O formato aceito continua PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG e JPG/JPEG, ate 25 MB.

Arquivo rejeitado ou solicitacao sem permissao nao cria caminho nem registro. Falha de persistencia apaga o arquivo recem-gravado. Download usa o registro autorizado, caminho contido na raiz de uploads, `Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`, inclusive para metadados legados. O link externo sem arquivo continua permitido.
