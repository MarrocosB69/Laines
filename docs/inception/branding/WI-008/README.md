# WI-008 — ícone oficial da Liga na aba

@work-item-id WI-008

## Intenção de mudança

Problema: a aba do navegador aponta para `pwa-icon.svg`, um desenho simplificado que não reproduz o emblema oficial usado pela Liga nas telas.

Comportamento esperado: a aba exibe o emblema oficial da Liga por meio de uma cópia estática do `LogoLainesSidebar.png`; o título, o manifest e o ícone de instalação permanecem.

Arquivos afetados: `index.html` e `public/favicon-laines.png` (cópia sem edição da arte existente). Design em `docs/product/construction/branding/favicon.md`.

Não objetivos: redesenhar a marca, alterar rotas, tela de login, PWA ou metadados de compartilhamento.

Invariantes: usar somente arte já aprovada no repositório; não introduzir rede/API; preservar `rel="apple-touch-icon"` e manifest.

Verificação: conferir igualdade binária da cópia, caminho do `rel="icon"`, checagem de encoding e build. Validação do ícone em navegador fica com o orquestrador, sem iniciar Vite ou Playwright nesta etapa.

Rollback: restaurar o `rel="icon"` anterior em `index.html` e remover apenas a cópia `public/favicon-laines.png`.
