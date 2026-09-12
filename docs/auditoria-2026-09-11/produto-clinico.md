# Produto e atendimento clínico

## Diagnóstico

O LAINES tem instrumentos e cadastros suficientes para uma versão útil. O principal trabalho restante é dar continuidade entre contexto, avaliação, conduta, revisão e devolutiva, com menos duplicação na tela. A prescrição é hoje o ponto mais frágil dessa continuidade.

Este documento analisa implementação e comportamento de software. Não valida todas as equações clínicas, não prescreve tratamento e não certifica instrumentos experimentais.

## Contratos de prescrição reproduzidos

As provas usaram os serviços TypeScript e o núcleo JavaScript atuais, com dados sintéticos e repositórios em memória. Evidências: [resultado](evidencias/clinical-contract-result.json) e [script](evidencias/clinical-contract-check.cjs).

| ID / prioridade | Problema | Evidência | Refinamento e aceite |
|---|---|---|---|
| CLI-01 / P0 | Tela, servidor e PDF usam modelos diferentes de refeição. | `usePrescricaoApi.js:174` salva `itens` + `catalogo`; `plano-alimentar.service.ts:555–571,676,1245` lê `alimentos`. Na prova: 200 kcal no núcleo da tela, 0 no servidor; ativação bloqueada por ausência de alimentos/totais válidos. | Definir contrato único versionado e cálculo consistente para salvar, reabrir, revisar e imprimir. Teste integrado com mesmo plano deve manter alimentos, gramagens, nutrientes e total, dentro da tolerância de arredondamento definida. |
| CLI-02 / P0 | Migração pode apresentar plano antigo vazio e perder orientações/substituições. | Normalizador do servidor gera `itens:[]` junto a `alimentos`; `src/core/prescricao/legado.js` reconhece a existência de `itens` como novo formato. Prova: um alimento legado vira zero itens visíveis. Orientação não sobrevive ao migrador; `substitutosSemVinculo` não sobrevive à normalização. | Migração explícita pela versão, com round-trip sem perda. Manter leitura compatível até inventariar registros legados; comparar quantidades, orientações e todas as alternativas. Nunca converter campo desconhecido em descarte silencioso. |
| CLI-03 / P1 | A jornada de emissão está incompleta. | `PrescricaoPlano.jsx:410–427`: “Gerar” não tem ação; “PDF” também não tem ação, mesmo quando habilitado por plano existente. A tela só chama `salvar()`; não há fluxo de revisão/ativação completo. `AthletePortal.jsx` e abas não consultam planos alimentares. | Concluir ações já anunciadas: rascunho → revisão → ativo → disponível ao atleta; PDF da mesma versão. Qualquer ação habilitada deve produzir resultado verificável. Se a função não entrar nesta versão, retirar a ação sem função da interface. |
| CLI-04 / P0 | Autoria de revisão pode ser declarada pelo cliente. | `plano-alimentar.service.ts:528–532,833–843`; a prova manteve ID de terceiro e data arbitrária. | Autor/data/versão fixados no servidor e transição autorizada. Revisão invalidada por mudança relevante. Detalhamento em SEC-09. |
| CLI-05 / P1 | Restrições existentes não alimentam as sugestões. | `PrescricaoPlano.jsx:69` passa `restricoes=[]`. O teste do núcleo para exclusão por restrição passa, mas a ligação da tela com a anamnese está ausente. | Derivar restrições confirmadas dos dados já registrados e submetê-las ao mesmo motor. Sugestão incompatível deve ser excluída ou exigir justificativa clínica explícita, conforme regra institucional. Não pedir que o aluno recadastre a mesma informação. |
| CLI-06 / P1 | Referência nutricional fixa e sinais divergentes. | `PrescricaoPlano.jsx:36` importa DRI de seed. Captura de paciente fictícia do sexo feminino mostra “DRI · homem 19–30 anos”. Prova: adequação de 200% retorna `ok` no núcleo visual e 0 na função de adequação do servidor. | Escolher referência com base nos dados existentes e indicação clínica, registrando fonte e grupo de referência. Faixas e semântica iguais na tela e servidor. Meta, limite e referência populacional devem ser distinguíveis; verde não pode significar simplesmente “quanto mais, melhor”. |
| CLI-07 / P1 | Dados preliminares e valores ausentes podem virar referência definitiva. | Prova de `validarAdequacao` selecionou GET em rascunho; `por100(null,100)` retornou 0. | Usar última avaliação elegível, com status, método, data e origem visíveis. Nutriente desconhecido permanece desconhecido; zero significa zero conhecido. Cobertura parcial deve reduzir a confiança, sem falsa precisão. |
| CLI-08 / P1 | Totais legados confiam em números enviados pelo cliente. | `calcularTotais` aceitou item de 1 g com 99.999 kcal e 88.888 g de carboidrato na prova. | Validar grandezas e unidades; calcular a partir de composição de origem controlada ou alimento manual explicitamente validado. O snapshot do catálogo deve preservar a composição histórica sem permitir falsificação silenciosa dos totais. |
| CLI-09 / P1 | Orientação de suplemento no PDF é inadequada. | `plano-alimentar.service.ts:1298` manda validar suplementos no GlobalDRO. | Ajustar a orientação ao propósito real da fonte e à revisão profissional. O GlobalDRO não valida a segurança antidopagem de suplementos; ver a fonte oficial indicada abaixo. |

As diferenças entre “adequação de meta” e “mínimo de referência” podem ser conceitualmente legítimas. O defeito é apresentar sinais incompatíveis sem explicar a distinção e usar referência fixa para pacientes diferentes. Não se recomenda resolver essa questão trocando apenas uma cor.

## Liga acadêmica: leitura transversal com responsabilidade local

O modelo desejado combina três dimensões independentes: **papel da pessoa, vínculo acadêmico/diretoria e vínculo assistencial**. Ser aluno, presidente ou integrante de ensino não confere automaticamente acesso a prontuários nem capacidade de administrar outra diretoria.

`src/constants/academicNavigation.js` e os menus do aluno oferecem Pesquisa, Ensino e Extensão. Isso já sustenta parte da leitura transversal desejada. Falta uma apresentação comum das quatro diretorias, inclusive Comunicação/Marketing. As capturas de aluno com diretoria de Ensino/Marketing entram em `/admin`, enquanto aluno sem diretoria entra em `/aluno`; a mudança de vínculo muda o ambiente inicial da pessoa e mistura gestão com sua rotina de atendimento.

Proposta: todo integrante encontra atividades publicadas, próximos encontros, materiais e resultados de todas as diretorias na área Liga. “Minha diretoria” acrescenta ações locais quando autorizadas. Rascunhos, aprovações, tarefas internas e dados de pacientes não fazem parte dessa leitura geral. Usar os conteúdos/projetos/tarefas já existentes como origem, sem criar um novo cadastro obrigatório de atualização.

Outro ponto: `src/utils/profileCompletion.js:14–15` exige supervisor e projeto de todos os membros estudantes. Isso bloqueia a experiência de um aluno que já participa da liga, mas ainda não atende. A conclusão de cadastro deve distinguir participação acadêmica e habilitação para atendimento. O vínculo clínico pode bloquear uma ação clínica específica sem bloquear a leitura da Liga.

## Prontuário e avaliações

A captura sintética de prontuário vazio mostra “Pendências 4”, “17 pendentes”, “17 módulos de avaliação pendentes”, “Próxima ação” e “Próximos passos” concorrendo pela atenção. A ausência de dados num paciente novo não comprova atraso clínico nem indica que todos os 17 instrumentos sejam necessários.

Refinar o prontuário em quatro camadas:

1. Identidade e contexto compacto: paciente, responsável/supervisão, estado do atendimento e alertas que alteram a decisão atual.
2. Próxima ação principal: continuar consulta, revisar avaliação, emitir plano ou marcar retorno, conforme estado real.
3. Síntese: últimas medidas elegíveis, conduta vigente e o que mudou desde o atendimento anterior.
4. Detalhes sob demanda: instrumentos, resultados completos, anexos, origem e histórico.

Classificar pendência como obrigatória para o atendimento atual, solicitada pela equipe, opcional ou não aplicável. Derivar isso do fluxo existente; não criar outra lista que o usuário tenha de manter. A revisão profissional deve ter uma fila clara e retornar ao mesmo registro, com observação e situação persistidas.

## Gráficos e tabelas

- `SparkLine.jsx` distribui pontos pelo índice e depende de `onMouseEnter` para detalhes. O intervalo de um dia e de seis meses pode parecer igual; origem fica fortemente dependente da cor. Usar escala temporal real, data/unidade/método e alternativa textual acessível por teclado/toque.
- `EvolucaoAnalytics.jsx:489,586` **já separa gráficos por unidade**, uma solução a preservar. O agrupamento temático reúne kg, %, cm e IMC, mas a renderização os distribui por escala compatível. Completar a consistência de datas, métodos e leitura textual; não afirmar melhora clínica apenas pela subida/descida de uma linha.
- Tabelas precisam distinguir dado ausente, zero, estimativa e medida. Cabeçalho deve trazer unidade; referências devem informar origem/grupo; legenda e texto devem repetir o significado das cores.
- Resumo institucional deve informar período, população considerada e denominador, com definição estável do indicador. Comunicação deve receber agregados adequados à finalidade, não dados clínicos identificados por simples mudança no filtro.

## Avaliação corporal por imagem

Há integração real prevista com API, cinco capturas, armazenamento assinado, processador Python e estado persistido. `docs/operations/avaliacao-imagem.md` a identifica como **experimental**, o que deve continuar visível ao profissional. A documentação `tests/VALIDATION_PROCEDURE.md` descreve um procedimento de calibração; um procedimento escrito não comprova que a validação foi executada.

Nesta rodada passaram **48 testes de núcleo Python**. Não foram executados captura de câmera, processamento completo com modelo real, validação contra medidas de referência, armazenamento MinIO ou fluxo de retomada após queda do processador. Faltam evidências para equiparar estimativas por imagem a medidas clínicas validadas.

Na versão final: manter resultado identificado como estimativa, com versão do algoritmo, qualidade da captura, origem e limitações; separar da medida manual na evolução; não usar automaticamente como base de conduta. Proteger imagens por vínculo ao paciente, registrar acesso e verificar exclusão/retenção também no storage. Acesso pelo prontuário é mais contextual do que um instrumento experimental destacado como área principal para todo aluno.

## Referência externa pontual

O [GlobalDRO](https://www.globaldro.com/) diferencia medicamentos e suplementos e informa as limitações da consulta. Uma consulta sem resultado não pode ser apresentada como aprovação de suplemento. Esta recomendação é sobre a qualidade da informação gerada pelo software, não sobre a indicação clínica de um produto.

O plano de implementação e os critérios de fechamento estão na [proposta](proposta-atualizacao.md).
