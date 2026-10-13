# Contratos de estabilização

@work-item-id WI-001

@work-item-id WI-002

Design derivado da proposta aprovada; não muda a arquitetura React/Vite e Nest/TypeORM.

## Identidade e sessão

O navegador solicita recuperação por identificador. A resposta pública é uniforme. O servidor seleciona contato registrado pelo administrador ou solicitação aprovada, gera 32 bytes aleatórios, armazena SHA-256 com expiração e versão de sessão e envia um link com token no fragmento. A página remove o fragmento e o mantém em memória. Consumo bloqueia usuário e token, verifica validade, muda hash, incrementa versão, revoga refresh e elimina desafio na mesma transação.

Tokens de acesso identificam família de sessão em sid. HTTP e socket verificam família, estado e versão atuais. Logout revoga a família; recuperação revoga todas. WebSocket interrompe entrega antes de cada envio; expiração tem timer e sessões ociosas são rechecadas a cada cinco segundos. Tokens anteriores sem sid exigem novo login.

## Dados e canais

Eventos transportam apenas invalidação a destinatário autorizado; conteúdo é obtido por HTTP. Relações de paciente são lidas no momento da entrega. Notificações clínicas novas usam equipe vinculada e texto sem identificação persistente. Exportação detalhada é reservada à administração conforme política vigente; delegados ficam no projeto vinculado e em agregados. O contrato de autorização mais amplo segue UPD-12.

Upload verifica UUID, existência e capacidade antes do interceptor; buffer limitado precede validação de assinatura e gravação contida. Falha de persistência remove somente o novo arquivo. Inscrição pública serializa CPF/email, retorna resposta uniforme e preserva qualquer cadastro existente.

## Plano

schemaVersion=2 define itens e catálogo como fonte de cálculo. Leitura migra legado sem descartar alimentos, orientações, alternativas ou campos adicionais. Catálogo usado é congelado no servidor; composição manual/legada requer revisão explícita. Revisão obtém nome, papel e CRN atuais do banco. Edição usa expectedVersion e comparação atômica; invalida revisão anterior. Atleta só consulta plano ativo, e PDF deriva dos mesmos itens.

## Dependências e verificação

Frontend e backend do novo contrato devem ser publicados juntos. Nova migração de credenciais deve preceder a API; banco real não foi alterado nesta implementação. Matriz de regressão: scripts/test-security-credentials.cjs, test-security-realtime.cjs, test-security-access.cjs, test-prescription-contract.cjs. Não afirmar homologação por esses testes isolados.

## Entrega da prescrição (UPD-10)

Publicação serializa por paciente e arquiva o plano anteriormente vigente na mesma transação. O atleta recebe a projeção da prescrição ativa e revisada, com as mesmas refeições usadas no PDF. Download informa a versão visualizada; se o registro mudou, o servidor recusa com conflito e a tela orienta recarregar. Uma nova revisão trabalha sobre cópia, preservando a prescrição publicada e seu histórico. Sem criação de novos dados clínicos ou prescrição automática.

## Dependências (UPD-09)

Atualizar conjuntos compatíveis a partir dos manifests existentes e comparar relatório de produção antes/depois. Migrações maiores e avisos remanescentes precisam de análise explícita; nenhuma instalação com força ou supressão de erros de peer dependencies.

## Autorização (UPD-12)

@work-item-id WI-003

Três dimensões independentes: papel, vínculo acadêmico (diretoria/capacidade) e vínculo assistencial. `server/src/auth/authorization.ts` concentra a decisão: `resolveClinicalLink` devolve o vínculo do usuário com um paciente ou nulo; `clinicalScopeCondition` gera o mesmo filtro SQL para listagens; `buildCapabilities` projeta o que a interface pode oferecer. Serviços clínicos chamam a mesma função em vez de repetir a regra. Cadeia de supervisão (aluno responsável supervisionado pelo professor/profissional) vale em todos os objetos clínicos. Gestão técnica (admin/coordenação) acessa registro clínico como exceção com trilha em auditoria. Conteúdo publicado é transversal; rascunho e aprovação ficam com a área e a coordenação.

## Imagem experimental e fechamento (UPD-19, UPD-21 e UPD-22)

@work-item-id WI-004

O módulo de imagem reutiliza a decisão de vínculo atual do UPD-12, inclusive antes de upload local; autoria histórica não concede acesso clínico por si só. Capturas confirmadas não recebem nova autorização de envio. A retomada reutiliza o registro existente e suas capturas, mantendo estados de espera, processamento, falha e conclusão explícitos. Resultados antigos não se tornam resultados de uma tentativa nova ainda pendente. Leituras e processamentos continuam sujeitos às capacidades existentes.

A primeira etapa aplicou a mesma exigência na leitura genérica de avaliações do tipo `composicao_corporal_imagem`. A continuação descrita abaixo a estendeu aos demais tipos; autoria histórica não contorna o vínculo atual.

Na interface, qualidade, cobertura e versão não são inventadas. Resultados ausentes permanecem ausentes, e estimativas não são apresentadas como medidas clínicas validadas. A ilustração corporal não constrói uma URL pública para arquivos privados. O servidor também exclui o diretório privado de imagem da entrega estática de uploads públicos, sem mover objetos legados. Não se altera o algoritmo nem se cria uma prescrição automática baseada em imagem. URLs MinIO previamente assinadas conservam seu limite de validade até verificação operacional específica.

Documentos canônicos apontam para implementação verificada e diferenciam histórico, candidato local e release homologado. O inventário local não certifica a publicação de frontend/API/processador. Fechar homologação exige evidência de restauração de banco e arquivos, jornadas após rollback e configuração efetiva do ambiente; lint, build e doubles não substituem essas etapas. Escopo e resultados desta onda: [WI-004](../../../inception/fechamento/WI-004/README.md).

O ensaio local de restauração cria seu próprio cluster PostgreSQL em loopback, valida o diretório e a porta do servidor antes de escrever e nunca reutiliza o serviço instalado. Dump, cópias de arquivos e restauração ficam em uma pasta temporária exclusiva. A versão da fixture SQL, relações e hashes são comparados após restauração; esse schema sintético não representa migrations ou homologação da aplicação.

### Continuação: vínculo, jornadas e restauração da aplicação

@work-item-id WI-004

A continuação estende o requisito de vínculo atual a todos os tipos na leitura genérica de avaliações, removendo o atalho histórico de autoria. Na listagem discente sem filtro de paciente, o filtro de autoria existente passa a ser combinado com o escopo assistencial centralizado. Gestão auditada e políticas de edição permanecem iguais. Este contrato substitui a limitação anterior ao tipo de imagem.

Duas equipes sintéticas com os mesmos papéis percorrem os endpoints reais de atendimento, avaliação, revisão, prescrição, publicação, PDF e acesso do atleta. Trocar identificadores entre equipes deve negar acesso; listas e eventos não podem vazar dados, e a transferência de vínculo deve retirar acesso da equipe anterior. Upload negado não deve deixar arquivo órfão.

O novo ensaio da aplicação usa cluster e diretórios próprios, migrations TypeORM reais e build isolado, sem arquivos `.env` do projeto ou serviços externos. Depois da jornada seed, banco e uploads são copiados e restaurados com a API parada. A comparação integral do estado persistido precede novos logins; a jornada `verify-restored` verifica os mesmos IDs e arquivos do manifesto. Os dados originais e logs permanecem preservados. Esse ensaio complementa o anterior de fixture SQL, sem certificar deploy ou rollback da versão publicada.

No Windows, os uploads restaurados ficam em um diretório novo dentro da pasta exclusiva do ensaio. A API reiniciada recebe esse caminho; os uploads originais e a cópia de backup permanecem intocados para comparação. Não se exige renomear o diretório original, operação que pode falhar por bloqueio transitório do sistema de arquivos mesmo depois de encerrar a API.

No upload de anexo do paciente, o interceptor recebe o arquivo em memória com o limite existente. O serviço consulta o vínculo e a permissão de escrita antes de criar qualquer arquivo; só então grava com nome exclusivo e salva o metadado. Se a persistência falhar, tenta remover apenas o arquivo recém-criado. Essa ordem impede que negativas por paciente inexistente, vínculo revogado ou falta de permissão deixem PDFs órfãos. A jornada HTTP verifica a ausência do arquivo e a preservação dos metadados após a negativa. Uma falha do próprio sistema de arquivos durante a limpeza ainda pode deixar órfão e não foi simulada no ensaio.

### Inventário local do candidato (UPD-19)

@work-item-id WI-004

O inventário de fechamento cobre exatamente os arquivos que a etapa `package-release` do workflow de deploy copiaria: `dist/` como `frontend/`, `server/dist/` como `server/dist/` e os dois manifests npm do servidor. Cada arquivo recebe tamanho e SHA-256, e uma lista ordenada forma um hash agregado. A verificação reconta e recalcula os bytes, recusando ausência, alteração ou arquivo extra. HEAD e estado de alterações locais acompanham o relatório, sem substituir a identidade dos bytes. O manifesto local não altera a receita do workflow, não representa CI remoto, não inclui dados persistidos e não certifica uma release imutável enquanto a árvore não estiver congelada. O processador de imagem fica explicitamente fora do pacote atual e exige decisão operacional separada antes da homologação.
