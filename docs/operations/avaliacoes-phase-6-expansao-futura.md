# Avaliacoes - Fase 6 (Expansao Futura, sem implementacao)

## Contexto
Este documento fecha a Fase 6 do plano de refatoracao do modulo de avaliacoes.
Escopo da fase: apenas desenho tecnico de expansao futura para novos tipos, sem alteracao funcional em producao.

## Estado atual confirmado no codigo
- Persistencia de avaliacoes em entidade unica com colunas JSONB (`dados`, `resultados`, `registros`, `meta`) e metadados (`schemaVersion`, `formulaId`, `formulaVersion`, `sessaoId`): `server/src/avaliacoes/avaliacao.entity.ts`.
- Entrada de criacao/edicao via DTO generico: `server/src/avaliacoes/dto/criar-avaliacao.dto.ts`.
- Registro central de tipos no frontend: `src/constants/evaluationRegistry.js`.
- Registro central de tipos no backend/analytics: `server/src/avaliacoes/evaluation-registry.ts`.
- Fluxo de UI de modulos em avaliacao completa via switch por `moduleId`: `src/views/AvaliacaoCompleta.jsx`.
- Calculo de metadados de completude no frontend: `src/contexts/paciente/pacienteUtils.js`.
- Normalizacao central por tipo no backend (inicialmente com foco em bioimpedancia): `server/src/avaliacoes/avaliacao-normalizer.ts`.

## Objetivo da expansao futura
Adicionar, em prompt futuro, os tipos:
- `exames_laboratoriais`
- `evolucao_retorno`

Sem quebrar contratos existentes e mantendo compatibilidade com historico.

## Arquitetura alvo (conceitual)
Cada novo tipo deve convergir para contrato canonico logico dentro de `dados`:
- `dados_brutos`
- `resultados_calculados`
- `classificacoes`
- `metadados_formula`
- `comparacao`
- `completude`
- `pendencias`

Observacao: a tabela fisica permanece a mesma nesta etapa. Nao ha migracao estrutural obrigatoria para iniciar os novos tipos.

## Schema proposto - exames_laboratoriais
### dados.dados_brutos
- `painel`: string (`glicemia`, `lipidograma`, `hematologico`, etc.)
- `analitos`: array
  - `nome`: string
  - `valor`: number
  - `unidade`: string
  - `referenciaMin`: number | null
  - `referenciaMax`: number | null
  - `dataColeta`: ISO string/date
  - `laboratorio`: string | null

### dados.resultados_calculados
- `alteracoesCount`: number
- `limitesCount`: number
- `normaisCount`: number
- `variacoes`: array por analito (delta absoluto e percentual vs ultimo exame do mesmo analito)

### dados.classificacoes
- `statusPorAnalito`: mapa (`normal`, `limitrofe`, `alterado`)
- `statusPainel`: string

### dados.metadados_formula
- `formulaId`: `lab_ref_range_v1`
- `formulaVersion`: `1.0.0`

## Schema proposto - evolucao_retorno
### dados.dados_brutos
- `adesaoPlanoAlimentar`: number (0-100)
- `adesaoAtividadeFisica`: number (0-100)
- `intercorrencias`: string
- `sintomas`: string
- `respostaPercebida`: number (1-5)
- `conduta`: string
- `proximaAvaliacao`: ISO string/date

### dados.resultados_calculados
- `scoreAdesaoGeral`: number
- `resumoObjetivos`: array
  - `objetivo`: string
  - `status`: string (`melhora`, `estavel`, `piora`)
  - `justificativa`: string

### dados.classificacoes
- `prioridadeRetorno`: string (`baixa`, `moderada`, `alta`)

### dados.metadados_formula
- `formulaId`: `evolucao_adesao_score_v1`
- `formulaVersion`: `1.0.0`

## Pontos de encaixe (arquivos que serao impactados)

### Frontend
- `src/constants/evaluationRegistry.js`
  - adicionar entradas dos novos tipos (label, domain, schemaVersion, requiredFields, contexts).
- `src/views/AvaliacaoCompleta.jsx`
  - importar novos formularios e incluir novos casos no `renderForm`.
- `src/views/Student/Patients/PatientProntuario.jsx`
  - ajustar iconografia e cards de modulo para os novos tipos no contexto de prontuario.
- `src/contexts/paciente/pacienteUtils.js`
  - incluir regras de completude/pendencias por tipo.
- `src/components/shared/evaluationResultAdapter.js`
  - mapear indicadores resumidos dos novos tipos para timeline/resumo.
- `src/components/Avaliacoes/...`
  - criar componentes de formulario para `exames_laboratoriais` e `evolucao_retorno`.

### Backend
- `server/src/avaliacoes/evaluation-registry.ts`
  - adicionar novos tipos para coerencia com analytics.
- `server/src/avaliacoes/avaliacao-normalizer.ts`
  - registrar normalizadores por tipo.
- `server/src/avaliacoes/*-normalizer.ts` (novos arquivos)
  - implementar normalizacao canonica de payload legado/canonico.
- `server/src/analytics/analytics.service.ts`
  - validar indicadores por tipo e evitar regressao de agregacoes por `tipo`.

### Banco e migracoes
- Sem migration obrigatoria para iniciar os tipos (JSONB ja comporta os dados).
- Se houver necessidade de busca por campos especificos (ex.: analito/data), avaliar indice GIN em `dados` e/ou colunas derivadas em migration futura.

## Dependencias tecnicas para execucao futura
- Definir dicionario de analitos e limites de referencia por sexo/faixa etaria para uso interno.
- Definir regra de score para evolucao/retorno com pesos configuraveis.
- Confirmar regras de permissao para criacao/edicao desses tipos por perfil.
- Confirmar contrato de exportacao de relatorio para incluir os novos blocos.

## Riscos e mitigacoes
- Risco: proliferacao de aliases de payload no frontend.
  - Mitigacao: normalizar no backend e padronizar escrita dos novos formularios no contrato canonico.
- Risco: comparacao longitudinal inconsistente em multiplas telas.
  - Mitigacao: centralizar comparacao no dominio (engine/adapter), mantendo view apenas para apresentacao.
- Risco: crescimento de regras em componente.
  - Mitigacao: isolar calculo/interpretacao em `calculationEngine` e adapters.

## Backlog sugerido (fase futura)
1. Implementar registro dos novos tipos em ambos registries (front/back).
2. Implementar normalizadores dedicados por tipo no backend.
3. Implementar formularios com escrita canonica em `dados`.
4. Implementar cards de resultado + historico + comparacao para cada novo tipo.
5. Adicionar testes unitarios (normalizacao e calculos) e testes de contrato (API/UI).
6. Validar impacto em analytics e exportacao de relatorio.

## Criterios de pronto para futura implementacao
- Novo tipo aparece no fluxo de avaliacao completa com persistencia funcional.
- Payload salvo com estrutura canonica e metadados de formula/schema.
- Timeline/prontuario exibem resumo sem recalc ad hoc.
- Testes de contrato e regras clinicas minimas aprovados.
