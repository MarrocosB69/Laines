# Capturas por perfil

Este procedimento cria usuarios temporarios apenas para evidencias visuais, captura telas por perfil via Playwright e remove os dados depois.

## 1. Criar usuarios temporarios na VM

Execute na VM, dentro do projeto:

```bash
cd /home/admin/projetos/laines-app
PRINT_SCREENSHOT_SEED_CONFIRM=CRIAR_PRINTS PRINT_SCREENSHOT_PASSWORD='PrintsLAINES#2026' npm --prefix server run seed:print-users
```

Usuarios criados:

- `print.admin@laines.ufrn.br`
- `print.coordenacao@laines.ufrn.br`
- `print.presidente@laines.ufrn.br`
- `print.vice@laines.ufrn.br`
- `print.marketing@laines.ufrn.br`
- `print.ensino@laines.ufrn.br`
- `print.pesquisa@laines.ufrn.br`
- `print.extensao@laines.ufrn.br`
- `print.atendimento@laines.ufrn.br`
- `print.professor@laines.ufrn.br`
- `print.profissional@laines.ufrn.br`
- `print.pesquisador@laines.ufrn.br`
- `print.colaborador@laines.ufrn.br`
- `print.tecnico@laines.ufrn.br`
- `print.aluno@laines.ufrn.br`
- `print.atleta@laines.ufrn.br`

## 2. Gerar prints a partir da maquina local

Execute na maquina que consegue abrir o sistema no navegador:

```powershell
cd C:\Users\bruno\laines-app
$env:PROFILE_SCREENSHOT_BASE_URL="http://10.3.227.82"
$env:PRINT_SCREENSHOT_PASSWORD="PrintsLAINES#2026"
npm run screenshots:profiles
```

Saida:

```text
e2e-artifacts/profile-screenshots/<RUN_ID>/index.md
```

O script tenta capturar:

- tela de login preenchida;
- dashboard inicial de cada perfil;
- itens visiveis da sidebar;
- abas visiveis dentro de cada tela;
- modais abertos por acoes comuns, com campos preenchidos antes do print.

## 3. Remover usuarios temporarios

Execute na VM depois de concluir os prints:

```bash
cd /home/admin/projetos/laines-app
PRINT_SCREENSHOT_CLEANUP_CONFIRM=REMOVER_PRINTS npm --prefix server run cleanup:print-users
```

O cleanup remove usuarios `print.%@laines.ufrn.br`, o projeto `Print LAINES`, o paciente de print e registros vinculados criados para essa rotina.
