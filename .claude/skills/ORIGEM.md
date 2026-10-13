# Skills de terceiros neste projeto

| Skill | Origem | Revisão fixada |
|---|---|---|
| `frontend-design` | github.com/anthropics/skills | `34040c9c568585f6929bedeaad110ad08f079624` |
| `webapp-testing` | github.com/anthropics/skills | `34040c9c568585f6929bedeaad110ad08f079624` |

Copiadas sem alteração, com as licenças originais, depois de lidas por inteiro em 2026-09-24.

## Adaptações ao LAINES

- **webapp-testing pede Playwright em Python**, que não está instalado. O projeto já tem Playwright em Node (1.59) com Chromium. Os agentes seguem o *método* da skill — servidor sob controle, reconhecer a página renderizada antes de agir, capturas e console — com o Playwright em Node.
- **`scripts/with_server.py` encerra o servidor com `terminate()` sobre `shell=True`.** No Windows isso tende a deixar o processo filho (Vite) órfão, segurando a porta. Preferir subir o Vite pela API (`createServer`), que encerra de forma limpa.
- **"Sempre espere `networkidle`"** travou a captura sob carga de CPU nesta máquina. Preferir `domcontentloaded` + espera por um seletor da página.
- **frontend-design** manda seguir à risca a direção que o briefing fixar. Para o LAINES, o briefing fixa a identidade da Liga (logotipo e o par azul/verde); o resto é livre para a skill decidir.
