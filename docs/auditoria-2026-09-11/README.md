# Auditoria de fechamento do LAINES — 11/09/2026

**Conclusão: não recomendo fechar/publicar esta versão no estado auditado.** O sistema tem funcionalidades suficientes; o trabalho principal é corrigir falhas de segurança e de integração, concluir a jornada clínica e organizar a apresentação do que já existe.

O diagnóstico foi feito sobre o estado local do projeto, incluindo alterações pré-existentes ainda não commitadas. Esta entrega contém auditoria e proposta; **não aplica as correções propostas ao produto**.

## Comece aqui

- [Painel da auditoria, com backlog filtrável e capturas](painel.html)
- [Proposta de atualização e critérios de fechamento](proposta-atualizacao.md)
- [Segurança: vetores, evidências e correções](seguranca.md)
- [Produto clínico: prescrição, supervisão, avaliações e imagem](produto-clinico.md)
- [Interface e usabilidade: problemas observados nas telas](interface-usabilidade.md)
- [Engenharia, testes, dependências e operação](engenharia.md)
- [Inventário atual de 139 rotas da API](rotas-api.md)
- [24 entregas propostas em formato estruturado](backlog.json)

## O que mais precisa de atenção

| Prioridade | Achado | Consequência |
|---|---|---|
| Imediata | Recuperação de senha baseada em identificador, CPF e nascimento; listagem pode expor fatores e senha temporária. | Possibilidade de tomada de conta e escalada em cadeia. |
| Imediata | Eventos clínicos enviados para salas amplas de role; sessão do socket não acompanha toda a revogação. | Dados podem sair do escopo assistencial mesmo quando o HTTP tem controles. |
| Imediata | Upload grava antes de validar ID/autorização; inscrição pública altera triagem pelo CPF; exportação permite escopo/projeção inadequados. | Riscos de integridade, escrita fora do destino e exposição de dados. |
| Imediata | Prescrição nova e servidor usam contratos diferentes; migração pode perder apresentação de alimentos e orientações. | Um plano sintético de 200 kcal na tela virou 0 kcal no servidor e não pôde ser ativado. |
| Imediata | Revisão de plano aceita identidade/data fornecidas no payload; YAML do CI tem chave duplicada. | Autoria não confiável e barreira de publicação comprometida. |
| Fechamento da jornada | PDF/Gerar sem ação na tela nova; entrega do plano ao atleta não está ligada; referência DRI fixa e restrições não conectadas. | Recursos visíveis não concluem o atendimento pretendido. |
| Organização | Aluno de diretoria muda de ambiente; menu cobre conteúdo no celular; prontuário repete pendências e trata muitos instrumentos como tarefas. | A estrutura atual aumenta esforço e confunde o que a pessoa deve fazer. |

Os detalhes distinguem **falha reproduzida**, **constatação por código**, **observação de interface** e **verificação ainda pendente em homologação**. Não há alegação de invasão ou vazamento ocorrido em produção.

## Evidência produzida

- **100 testes de núcleo JavaScript/TypeScript passaram**, além do build do frontend e checagem TypeScript da API.
- **48 testes de núcleo do processador de imagens passaram**.
- **Oito vetores de segurança reproduzidos** em ambiente isolado; a prova clínica também confirmou atribuição de autoria pelo payload e inconsistências de plano.
- **139 entradas de rota inventariadas** por AST, sem duplicidade exata de método/caminho. Isso não certifica autorização de todas elas.
- **51 capturas de exploração**, em duas larguras, com dados fictícios; duas de loading descartadas e recapturadas corretamente.
- ESLint: **23 erros e 10 avisos**; CSS: **6.893 erros e 1.852 avisos**, em grande parte convenções de estilo.
- Consulta atual do npm: **10 pacotes sinalizados no frontend, 16 no servidor**. Não são 26 ataques comprovados nem CVEs necessariamente distintos.

Os testes passarem enquanto o contrato do plano está quebrado é um achado relevante: a cobertura precisa verificar também as ligações entre as partes. Evidências consolidadas em [resumo-verificacoes.json](evidencias/resumo-verificacoes.json) e fontes identificadas em [manifesto-fontes.json](evidencias/manifesto-fontes.json).

## Direção de produto

**Liga:** todos os integrantes conhecem atividades publicadas, agenda, materiais e resultados das quatro diretorias. Cada diretoria gerencia apenas suas atribuições; a visão comum não expõe rascunhos, tarefas internas ou prontuários.

**Atendimento:** agenda e pacientes vinculados → prontuário → avaliação → revisão → plano vigente → devolutiva ao atleta. A mesma versão deve existir no editor, no banco e no PDF.

**Gestão:** contas, vínculos, solicitações e operação para quem tem atribuição. Cargo acadêmico e papel técnico não substituem vínculo/competência clínica.

A proposta reaproveita os dados existentes, reduz avisos duplicados, organiza gráficos/tabelas e conclui ações já anunciadas. Não exige ampliar a coleta de informações clínicas.

## Cobertura e limites

| Frente | Feito | Ainda necessário para aprovar o uso final |
|---|---|---|
| Código e arquitetura | Fontes atuais, contratos críticos, permissões, rotas, normalização, navegação, build/testes/lint e inventário | Revisão das correções e regressão em release imutável |
| Segurança | Oito provas isoladas, revisão de canais HTTP/WS, upload, recuperação, exportação e dados públicos | Matriz integrada com usuários de duas equipes/projetos no ambiente equivalente à produção |
| Interface | Frontend real com respostas sintéticas, desktop/mobile, estados e capturas | Bases pequenas/grandes reais de teste, teclado/leitor de tela, contraste medido, demais larguras e navegadores |
| Clínica | Contrato de prescrição e migração, revisão, referências, restrições e fluxo de devolutiva | Validação pelo responsável clínico e testes de todas as jornadas/instrumentos necessários |
| Imagem corporal | Código da integração, documentação experimental e 48 testes do núcleo Python | Câmera → upload → processamento real → resultado → retomada; validação contra referência |
| Operação | Workflows, configuração versionada, política de cache e procedimentos existentes | Configuração efetiva, TLS/storage, migrations em cópia controlada, restauração de banco e arquivos |

Não foram realizados ataques contra produção, testes destrutivos, testes de carga do servidor, migração de banco ou acesso a dados reais de pacientes. A API de produção não foi certificada. As capturas usam API interceptada e não devem ser apresentadas como E2E integrado.

A skill solicitada de “SaaS para saúde” não foi encontrada nas skills instaladas nem nas instruções locais pesquisadas. Não foi substituída por uma skill inventada. A análise usou contexto do projeto e fontes oficiais OWASP, W3C, LGPD e GlobalDRO, citadas nos documentos temáticos.

## Reprodução local das provas

Com as dependências existentes, na raiz do projeto:

```powershell
node docs/auditoria-2026-09-11/evidencias/security-probes.cjs
node docs/auditoria-2026-09-11/evidencias/clinical-contract-check.cjs
node docs/auditoria-2026-09-11/evidencias/inventariar-rotas.cjs
```

As provas usam identidades sintéticas e não leem `.env` ou banco. A prova de upload cria arquivos sintéticos apenas em seu subdiretório de evidência e abre servidor efêmero em loopback. Esses scripts demonstram o comportamento vulnerável atual: depois da correção, suas assertivas devem ser convertidas em testes de regressão do comportamento seguro.

O roteiro visual exige frontend local em `127.0.0.1:5173`; intercepta a API e bloqueia recursos externos. O script de consolidação lê os resultados já gravados. Novas execuções substituem evidências; preserve esta fotografia se quiser comparar com uma rodada posterior.
