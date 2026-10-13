# WI-012 — sistema de PDFs LAINES e primeira entrega ao paciente

@work-item-id WI-012

## Problema e comportamento esperado

Os PDFs atuais são desenhados em serviços independentes, com cores, tipografia e paginação próprias. O plano alimentar baixado pelo atleta usa o mesmo documento operacional da equipe e inclui checklist interno. Criar uma base A4 institucional reutilizável e aplicar primeiro à exportação do plano alimentar destinado ao paciente, com conteúdo próprio para leitura e sem conclusões clínicas novas.

## Escopo

- Inventariar as exportações existentes e registrar um vocabulário visual/técnico único para PDFKit, sem trocar a arquitetura Nest/React.
- Criar componentes de documento compartilhados: página, cabeçalho, identificação, seção, texto, métricas, tabela, observação, assinatura e rodapé, com proteção de quebras.
- Separar dados do plano, projeção do relatório, componentes visuais e geração do Buffer.
- Aplicar ao PDF do plano alimentar acessado pelo atleta; preservar o endpoint e a checagem de versão/permissão. Manter uma projeção operacional apropriada para a equipe se necessária.
- Associar principal e substitutos prescritos no mesmo bloco de leitura, com seta curva, porção em cada alternativa e vínculo pelo item original; apresentar trocas legadas sem vínculo em grupo próprio. Usar a largura do A4 para favorecer também o zoom no celular, sem coluna vazia ou card por item.
- Gerar exemplos sintéticos, renderizar todas as páginas e testar casos longos, tabelas, caracteres e ausência de dados.

## Não objetivos

- Diagnosticar, interpretar dados ou preencher recomendações não registradas por profissional.
- Alterar cálculos, dados salvos, estados, revisão CRN, publicação, autorização, API de edição ou banco real.
- Migrar, nesta primeira aplicação, todos os relatórios clínicos e administrativos existentes; eles deverão consumir a base comum em etapas rastreáveis.
- Executar deploy, enviar documentos a pacientes ou imprimir com dados reais.

## Invariantes

- `INV-002`: acesso por sessão/vínculo e versão esperada continuam verificados no servidor; download do atleta exige plano vigente autorizado.
- `INV-004`: refeições, substitutos, quantidades e totais continuam derivados do plano persistido; alternativas não entram no total prescrito; revisão tem autoria/versão existentes.
- A proximidade visual de uma troca não cria equivalência automática: quantidade fixa sem equivalência e quantidade pendente mantêm avisos próprios.
- `INV-005`: usar somente dados sintéticos na geração e revisão visual.
- Nenhuma informação operacional de ativação, score interno, ID técnico ou checklist de pendências deve ser apresentada como orientação ao paciente.
- Campos ausentes não viram zero, diagnóstico ou orientação presumida. Imagens/gráficos, quando usados, preservam proporção e não invadem rodapé.

## Verificação e reversão

- Rodar testes de contrato de prescrição/acesso e novos testes de projeção, paginação e conteúdo; lint/build, PhaseGate e comparação visual de PNGs renderizados do PDF A4.
- Conferir ao menos documentos curto e longo, tabela multipágina, texto grande, acentos e impressão em tons de cinza.
- Reverter arquivos da WI-012 sem tocar planos persistidos. Se a base compartilhada falhar, a rota mantém o mesmo contrato de resposta e pode voltar ao gerador anterior em uma reversão isolada.

## Evidência da primeira aplicação

- Contrato de prescrição: 20 verificações passaram, incluindo acesso/versão, total sem alternativas, composição ausente como traço, revisão não confirmada, principais de mesmo nome com trocas distintas e alternativas legadas sem vínculo.
- O servidor passou em `lint` e `build`; o build incluiu logo e fontes locais. `npm run test:ui`, PhaseGate `check-ready` e validação L2 passaram.
- O exemplo sintético do paciente foi inspecionado nas 3 páginas A4 e em redução para 390 px: refeição e horário com hierarquia reforçada; a seta liga o alimento às duas opções com porção. O teste de estresse inclui 16 alternativas longas, outro item com 4 opções, continuação entre páginas e alternativa sem vínculo, além de tabela, imagem e assinatura; ocupa 8 páginas A4. Extração sem caracteres substituídos, cabeçalho/rodapé e quebras verificadas. A4 reduzido à largura de celular exige zoom para ler o corpo; o fluxo em uma coluna evita percorrer colunas opostas durante o zoom.
- `phasegate:lint` leu 0 arquivos e retorna erro por artefatos ESLint legados do repositório. `phasegate doctor` também aponta configuração pré-existente de hooks/CI, fora desta WI.
