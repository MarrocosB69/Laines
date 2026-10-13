# Contrato das peças da Visão geral

Este contrato foi fixado pelo orquestrador antes dos executores. O agente A implementa as peças; B e C escrevem os painéis contra esta interface, em paralelo. Se precisar mudar a interface, pare e relate ao orquestrador.

## Arquivos (agente A)

- `src/components/painel/Painel.jsx`: exporta os componentes e a função abaixo.
- `src/components/painel/painel.css`: importa `../../views/landing/landing-tokens.css` no topo e define as classes `painel*`.

## Interface

```jsx
import {
  PainelVisaoGeral, PainelCabecalho, PainelIndicadores, PainelSecao, PainelLista, saudacaoPorHorario
} from '../../components/painel/Painel';

<PainelVisaoGeral>{/* os blocos, na ordem fixa */}</PainelVisaoGeral>

<PainelCabecalho
  saudacao="Bom dia"          // use saudacaoPorHorario(new Date())
  nome="Maria"                // primeiro nome
  papel="Professora"          // texto do papel, igual ao cartão da sidebar
  data={new Date()}           // formatada em pt-BR pelo componente ("sexta-feira, 26 de setembro")
  acoes={<Button .../>}       // opcional: ação principal da página
/>

<PainelIndicadores
  rotulo="Indicadores"        // nome acessível da faixa (aria-label)
  carregando={false}
  itens={[
    { id: 'hoje', rotulo: 'Consultas hoje', valor: 3, detalhe: '12 na semana',
      icone: CalendarDays,    // componente lucide (opcional)
      tom: 'neutro',          // 'neutro' | 'atencao' | 'positivo'
      onClick: () => {} }     // opcional: vira botão; recebe as classes de compatibilidade abaixo
  ]}
/>

<PainelSecao
  id="precisa-de-voce"
  titulo="O que precisa de você"
  descricao="..."             // opcional
  acao={{ rotulo: 'Ver todas', onClick }}   // opcional
  estado="pronto"             // 'pronto' | 'carregando' | 'erro' | 'vazio'
  vazio={{ titulo: 'Nada pendente', descricao: '...' }}
  erro={{ mensagem: '...', onTentarNovamente }}
>
  {/* conteúdo quando estado === 'pronto' */}
</PainelSecao>

<PainelLista
  rotuloAcessivel="Pendências"
  itens={[{ id, titulo, subtitulo, meta, tom, icone, onClick }]}   // onClick opcional; sem ele, a linha não é clicável
/>

saudacaoPorHorario(date) // 'Bom dia' | 'Boa tarde' | 'Boa noite', com a MESMA regra de horário de DashboardStats.jsx:258-260
```

## Ordem fixa dos blocos (decisão do usuário)

1. `PainelCabecalho`
2. `PainelIndicadores`, com 3 ou 4 itens
3. `PainelSecao` com `id="precisa-de-voce"` e título **"O que precisa de você"**
4. `PainelSecao` com `id="agenda"` e título **"Agenda"**
5. Uma ou mais `PainelSecao` específicas do papel

Todo número e toda lista que a Visão geral mostra hoje continua aparecendo, em algum bloco. Nada é removido.

## Compatibilidade

- Indicadores recebem a classe `painel-indicador` e também `stat-card`. Os clicáveis recebem ainda `stat-card-action`. `scripts/capture-tcc-figures.mjs` procura `.stat-card-action` com o texto "Atletas supervisionados".
- A saudação continua usando "Bom dia", "Boa tarde" e "Boa noite".

## Visual (padrão da landing)

- **Tokens e tipografia:** tokens `--lt-*` e par Sofia Sans. Nenhuma Inter ou Poppins: declare `font-family` explicitamente, porque `h1…h6` globais trazem Poppins, cor e degradê no `h1`.
- **Cabeçalho:** saudação e nome na voz de campanha (`--lt-font-display`, itálico 900), com papel e data em texto de apoio. Pode ecoar a marca verde de largada.
- **Indicadores:** cartões brancos, número grande na voz de campanha, rótulo e detalhe em Sofia Sans. O `tom` altera só um acento, nunca o fundo inteiro; a atenção usa um tom que passe 4,5:1 sobre branco.
- **Seções:** painel branco com `--lt-radius-card`, título Sofia 700 e ação em link azul.
- **Estados:** carregando (esqueleto discreto, sem laço acima de 5 s ou com `prefers-reduced-motion` respeitado), vazio e erro com botão "Tentar novamente".
- **Acessibilidade e layout:** listas com linhas de 44 px ou mais, foco visível com `--lt-focus-ring` e contraste de texto de 4,5:1 ou mais. Grade responsiva: indicadores em 4, 2 ou 1 colunas; seções em uma coluna no celular e até duas no desktop. Nada cortado nem rolagem horizontal a 1280 e 390 px.
