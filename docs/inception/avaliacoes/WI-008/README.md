# WI-008 — avaliação corporal por imagem clara, retomável e experimental

@work-item-id WI-008

## Intenção de mudança

O fluxo por imagem já registra consentimento, quatro fotos, vídeo e processamento assíncrono, mas a experiência está comprimida em um modal de 560 px, mistura estimativas com indicadores de aparência diagnóstica e não facilita consultar avaliações anteriores. A captura possui estados confusos de câmera/vídeo, e o processador supõe idade 25 quando ela não foi enviada. O usuário autorizou transformar essa avaliação após análise completa, preservando o caráter experimental e a autonomia dos outros instrumentos.

## Comportamento esperado

- Preparação, consentimento, quatro vistas, vídeo, envio/retomada e resultado têm propósito, progresso textual e ação principal claros; só a câmera ocupa a tela inteira.
- O resultado prioriza medidas estimadas, origem, versão e qualidade informada pelo processador. Corpo 3D é ilustração; idade corporal, classificação de risco metabólico e alegação de IC 95% não aparecem como conclusão clínica.
- Registros anteriores continuam consultáveis quando o mais recente está pendente ou falhou. Leitura não habilita captura, reprocessamento ou exclusão.
- Ausência de idade válida não vira 25 anos: a fórmula dependente de idade é omitida, sem bloquear as demais. Dados e resultados antigos continuam legíveis e identificados como experimentais.
- O esquema de entrada HTTP do processador preserva idade, origem e data de referência enviados pelo servidor; o teste atravessa essa validação antes de conferir a combinação de fórmulas.
- A correção do contrato recebe versão de algoritmo própria (`2.1.1`), pois Deurenberg passa a participar dos novos jobs com idade válida; resultados históricos não são recalculados.
- As rotas genéricas não criam, finalizam, atualizam ou excluem imagem fora do fluxo dedicado; vínculo e autorização continuam decididos pelo servidor.

## Escopo

- Frontend: `AvaliacaoImagem.jsx`, CSS escopado, `Body3D.jsx` se necessário, serviço de imagem e integração pontual no prontuário.
- Backend: proteção pontual dos endpoints genéricos e eventual dado etário do cadastro para o processador; sem mudança da autorização de outros tipos.
- Processador: remover idade implícita da combinação de fórmulas, declarar os campos etários no contrato HTTP e versionar a correção; preservar metadados para rastreabilidade.
- Verificação: testes sintéticos de imagem, estados do wizard, histórico, rotas genéricas e cálculo sem idade.

## Não objetivos

- Declarar precisão clínica, validar o modelo contra referência, ativar imagem na prescrição ou na composição integrada.
- Trocar storage, criar migração, apagar resultados legados, alterar outros instrumentos, publicar ou mudar banco real.
- Implementar retenção operacional ou revogação antecipada de URLs MinIO já emitidas.

## Invariantes

- INV-002/003: JWT, vínculo atual, permissões, confirmação de arquivo e ausência de efeitos na negativa.
- INV-005/006: somente dados sintéticos; preservar trabalho local e histórico existente.
- Consentimento precede criação; cinco arquivos confirmados precedem processamento; falha e ausência de resultado nunca produzem estimativa fictícia.
- Dados declarados, medida de cadastro e inferência por imagem são identificados pela origem; nenhuma avaliação passa a depender de outra.

## Verificação e reversão

- `node scripts/test-image-evaluation.cjs`, testes Python do processador, `npm.cmd run test:ui`, lint, build e PhaseGate pertinente; registrar limites de câmera real, MinIO, PostgreSQL e validação clínica.
- O orquestrador confere em 1280/390 px: overflow, teclado/foco, permissão negada, troca de câmera, revisão/regravação, retomada e leitura de resultado anterior.
- Reverter somente alterações WI-008 em frontend, backend e processador. Não remover registros ou imagens já salvos.

## Evidência de execução

- A suíte do processador passou integralmente: 128 testes. Dois testes de parsing antigos foram alinhados ao contrato já usado pelo pipeline `(largura, confiança)`, sem alterar o algoritmo de parsing.
- A revisão do contrato HTTP corrigiu a perda silenciosa de idade e proveniência no Pydantic e versionou os novos resultados como `2.1.1`. O novo teste valida `JobRequest` com cinco capturas, confirma os três campos etários em `model_dump()` e verifica Deurenberg. A suíte completa passou com 129 testes; após o ajuste da versão e do teste, os 96 testes de `test_core.py` e `test_regression.py` passaram. A execução real com câmera e comparação clínica continuam pendentes.
- Os 17 cenários sintéticos da imagem, a proteção das rotas genéricas, o `test:ui`, ESLint direcionado, TypeScript do servidor, build e PhaseGate passaram.
- A captura em câmera real, as permissões do navegador, o upload para storage, o processamento externo e a leitura em 1280/390 px ficam para a verificação do orquestrador; não houve execução com dados reais.
