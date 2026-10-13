# Prescrição: nomes e busca do catálogo

@work-item-id WI-009

## Decisão de produto

O catálogo em uso combina 597 linhas TACO e 1.170 TBCA. A descrição original, a fonte, o código e a composição representam a identidade da linha; preparo, óleo, sal e forma de consumo podem alterar os nutrientes. Não unir alimentos apenas porque seus nomes se parecem. Preservar `nome`/`descricao` originais e os snapshots dos planos existentes.

O profissional pediu nomes mais legíveis e busca melhor, mantendo os registros oficiais. Uma apresentação derivada organiza os segmentos separados por vírgula com `·`, expande somente `c/` para `com` e `s/` para `sem`, preserva os demais termos e não reinterpreta receitas. Vírgulas dentro de parênteses permanecem. Exemplo: `Arroz, integral, cozido` → `Arroz · integral · cozido`; `Ovo, galinha, inteiro, cozido, c/ sal` → `Ovo · galinha · inteiro · cozido · com sal`. Mostrar fonte e código para diferenciar resultados próximos. O nome oficial continua disponível no snapshot.

## Busca

- Tokenizar a consulta sem acentos, ignorando caixa e separadores; exigir todos os termos independentemente de ordem. `arroz integral` e `integral arroz` alcançam `Arroz, integral, cozido`.
- Aceitar `com`/`sem` tanto por extenso quanto nas abreviações oficiais `c/`/`s/`. Código alfanumérico da TBCA pode localizar sua linha exata.
- Tratar `%` e `_` como texto do usuário, jamais como curingas SQL. Consulta sem termos úteis não vira listagem ampla.
- Priorizar descrições mais curtas entre os acertos, mantendo fonte/código visíveis; não escolher automaticamente uma preparação nem colapsar TACO e TBCA.
- O endpoint mantém autenticação e limite existentes. Busca e carregamento de candidatos para substituição são transitórios: não alteram o plano nem seu sinal de edição pendente. Só alimento escolhido entra no snapshot salvo.

## Fluxo e critérios

O plano usa a rota `/prescricao-plano/:pacienteId`, obtém paciente, contexto clínico e último plano, busca TACO/TBCA sob demanda, calcula totais no núcleo, salva com versão esperada e envia para revisão. O servidor valida novamente, fixa autoria e libera publicação/PDF após aprovação; o atleta recebe a projeção publicada. Nomes de apresentação não modificam quantidades, nutrientes, restrições, equivalências ou totais.

Verificar com dados sintéticos: termos separados por vírgula e fora de ordem; acentos; `c/` e `s/`; códigos; distinção entre dois registros parecidos; nome original inalterado; busca transitória sem marcar o plano como editado. Manter testes de contrato e adequação, registrar execução sem PostgreSQL/navegador como limite.
