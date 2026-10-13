# Sidebars dos cinco portais — padrão da landing, guiadas pelo servidor

Escopo e decisões em [change-intent.md](change-intent.md). Nada foi commitado.

## O que mudou para quem usa

- **Visual:** as cinco sidebars (admin, aluno, professor, equipe e atleta) seguem o visual da landing.
  - Fundo azul-estádio, "LAINES" na voz de campanha e item ativo com a marca verde de largada.
  - Alvos de 44 px e foco visível.
  - Barra de rolagem fina e visível.
- **Estrutura:** os itens vêm de um modelo único (`src/navigation/sidebarModel.js`), guiado pelas capacidades que o servidor já envia. As cinco sidebars viraram invólucros finos, com as mesmas props de antes.
- **Decisão 2:** professor e equipe técnica passaram a ver a Comunicação, só leitura.
- **Decisão 3:** o aluno sem vínculo vê "Sem vínculo" em Meus Atletas, Minha Agenda e Avaliação por imagem, com a dica para completar supervisor e projeto. O selo agora é anunciado pelo leitor de tela.
- **Visão Geral:** equipe e atleta ganharam o item "Visão Geral", a aba inicial nova da onda `visao-geral-v2`.
- **Menu nas telas de avaliação e prescrição:** passa a levar para a aba clicada (`?area=`). Antes ele ia sempre para a aba inicial.

## Verificação

- **`test-sidebar-modelo.cjs`:** 27 verificações. Cobre a paridade por perfil, nenhum item sem capacidade (com capacidades restritas montadas à mão), as condições dos atalhos (`admin:access`, presidente e vice), o "9+", o selo de solicitações e as dicas do admin recolhido.
- **`test-contexto-navegacao.cjs`:** 13 verificações. Passou a ler `ProfessorView.jsx` e `TeamPortal.jsx` para prender a decisão 2.
- **Navegador** (`tmp/sidebars-v2/verificar.mjs`, sete perfis sintéticos, 1280 e 390 px):
  - itens corretos por perfil;
  - gaveta do celular abrindo;
  - nenhum alvo abaixo de 44 px;
  - só as fontes Sofia;
  - nada cortado.
  
  O pior contraste real no desktop foi 4,73:1, no rodapé, depois das correções.
- **Revisão independente (Opus):** aprovado com ressalvas. As seis ressalvas foram corrigidas:
  1. o selo "Sem vínculo" era mudo para leitor de tela;
  2. 8 mutações sobreviviam ao teste;
  3. o teste de navegação não prendia as telas;
  4. as dicas do admin recolhido tinham sumido;
  5. o item vazava 8 px;
  6. a evidência do celular estava contaminada por toasts da API sintética.

## Limites e acompanhamento

- **Não testado:** leitor de tela real, Safari, Firefox e celular real.
- **CSS morto de antes:** `__requests-badge`, `--student-header*`, `__footer-note`, `__logout`, `__user-card*`, `.ap-sidebar-badge`. Removê-lo é uma limpeza separada.
- **`requestsCount` não é passado pelo `AdminView`:** o selo de solicitações existe, mas não recebe o número. Continua registrado para correção.
