# Prompt para Claude: reorganizar visual do portal do atleta

Voce vai trabalhar apenas na camada visual/frontend do portal do atleta do LAINES. O backend ja passa a expor um contrato consolidado para cadastro do atleta, evitando que o frontend precise reconstruir regra de negocio.

## Objetivo

Transformar o portal do atleta de um painel com modais e pendencias soltas em uma jornada clara de acompanhamento:

1. Meu cadastro
2. Minhas pendencias
3. Meu acompanhamento

O atleta deve entender que esta participando do proprio acompanhamento, nao apenas preenchendo formularios isolados do sistema.

## Contrato de backend disponivel

As respostas de `GET /pacientes` e `GET /pacientes/:id` agora incluem o campo aditivo:

```js
cadastroAtleta: {
  origemCadastro,
  origensCadastro,
  statusCadastroAtleta,
  cadastroCompleto,
  cadastroPendente,
  completadoEm,
  anamneseId,
  dadosBase,
  dadosAutorrelatados,
  campos,
  formulariosLiberados,
  ebiaSelfForm,
  consentimento,
  ultimaAtualizacaoCadastro,
  historicoCadastro
}
```

Ainda existe `confirmacaoAtleta` por compatibilidade. Use `cadastroAtleta` como fonte preferencial para layout, status e textos.

## Regras conceituais

- `cadastroAtleta.origemCadastro` pode ser `equipe`, `inscricao_publica`, `atleta` ou `desconhecida`.
- `cadastroAtleta.statusCadastroAtleta` pode indicar `lista_espera`, `pre_cadastro`, `cadastro_atleta_pendente` ou `cadastro_atleta_completo`.
- `cadastroAtleta.dadosBase` sao dados consolidados do paciente/prontuario.
- `cadastroAtleta.dadosAutorrelatados` sao dados preenchidos pelo proprio atleta.
- `cadastroAtleta.campos` traz uma leitura consolidada para exibicao simples.
- `cadastroAtleta.formulariosLiberados` contem formularios que a equipe liberou para o atleta responder.
- `cadastroAtleta.ebiaSelfForm` indica se EBIA foi liberada.

## Tela desejada

### 1. Meu cadastro

Mostrar o estado do cadastro e os principais dados:

- origem do cadastro;
- status do cadastro;
- data de conclusao, quando existir;
- dados pessoais;
- modalidade/rotina esportiva;
- queixa principal/historico;
- consentimento.

Se `cadastroAtleta.cadastroPendente` for verdadeiro, mostrar uma acao clara para completar cadastro. Evite modal obrigatorio invisivel ou bloqueante sem contexto.

### 2. Minhas pendencias

Listar tudo que exige acao do atleta:

- completar cadastro;
- assinar consentimento, se pendente;
- EBIA liberada;
- formularios de autoavaliacao liberados em `cadastroAtleta.formulariosLiberados`;
- formularios planejados por consulta;
- consulta sem confirmacao/remarcacao, se o dado existir;
- formularios enviados aguardando revisao.

Cada pendencia deve ter:

- titulo claro;
- origem simples, quando util: equipe, consulta ou cadastro;
- status: pendente, enviado, aguardando revisao, revisado;
- botao de acao quando houver formulario para responder.

### 3. Meu acompanhamento

Mostrar uma visao longitudinal:

- proxima consulta;
- avaliacoes recentes;
- formularios enviados;
- status de revisao profissional;
- resumo do vinculo com equipe/projeto.

## Cuidados importantes

- Nao crie nova regra de liberacao no frontend. Use `cadastroAtleta.formulariosLiberados`, `cadastroAtleta.ebiaSelfForm` e os dados de consultas/avaliacoes ja carregados.
- Nao esconda formularios liberados atras de cadastro visualmente confuso; se houver bloqueio por cadastro incompleto, mostre isso como motivo claro.
- Evite depender de placeholder ou texto visual para selecionar campos.
- Preserve os componentes existentes de envio de EBIA e autoavaliacoes; reorganize a descoberta e os cards.
- Mantenha compatibilidade com `confirmacaoAtleta` apenas como fallback.
- O frontend nao deve alterar o formato do payload de backend sem alinhar antes.

## Arquivos provaveis

- `src/views/Athlete/AthletePortal.jsx`
- `src/views/Athlete/AthleteTabCadastro.jsx`
- `src/views/Athlete/AthleteTabPendencias.jsx`
- `src/views/Athlete/AthleteTabAcompanhamento.jsx`
- `src/views/Athlete/AthletePortal.css`
- `src/views/Athlete/athleteSelfEvaluations.js`
- componentes de modal EBIA e autoavaliacao ja usados pelo portal

## Resultado esperado

O atleta deve abrir o portal e enxergar imediatamente:

1. Quem sou eu no sistema e qual e o estado do meu cadastro.
2. O que eu preciso fazer agora.
3. O que ja enviei e o que a equipe ainda vai revisar.

Nao transformar isso em landing page. A primeira tela deve ser a experiencia funcional do portal.
