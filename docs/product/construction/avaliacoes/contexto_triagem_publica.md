# Contexto progressivo das avaliações

@work-item-id WI-006

A interface de avaliações mantém os módulos, a ordem, a persistência, os campos e os estados atuais. A visão geral mostra uma única leitura de progresso por etapa no mapa de módulos; o cartão superior apresenta apenas o total consolidado. Histórico da última sessão permanece acessível no módulo, inicialmente recolhido, com data e estado visíveis no resumo.

Quando `patient.confirmacaoAtleta.inscricaoPublica.dados` existir no paciente autorizado, a tela mostra uma faixa compacta “Triagem pública · autorrelato” com a data de `inscricaoPublica.atualizadoEm`. Sua expansão revela apenas dados relevantes para a entrevista, agrupados em treino, saúde relatada e rotina/solicitações. Campos não respondidos são omitidos; respostas explícitas como “Nenhuma”, zero ou “Não” são preservadas. Identificadores pessoais não aparecem nesse resumo.

O snapshot `inscricaoPublica.dados` é a fonte estável da inscrição. Para o contexto de onboarding já consumido pelos formulários, valores posteriores de `confirmacaoAtleta.dados` têm precedência sobre valores da triagem, conforme o prontuário. Valores do próprio paciente continuam tendo a precedência existente. A triagem permanece identificada como autorrelato, não vira diagnóstico, resultado calculado ou avaliação concluída. Prefill existente só atua em módulos novos e em campos vazios, sem sobrescrever snapshots e edições. Sexo biológico explícito é tratado separadamente de gênero.

A tela usa o paciente já carregado por `GET /pacientes/:id`, sujeito ao vínculo clínico atual. Não consulta o endpoint de fila da extensão, não adiciona API e não envia novos dados ao servidor. CSS fica escopado à tela de avaliações para não afetar formulários embutidos em outros fluxos. Em telas estreitas, a faixa de triagem e os formulários respeitam a largura disponível; a expansão não deve criar rolagem lateral oculta no contêiner da rota.
