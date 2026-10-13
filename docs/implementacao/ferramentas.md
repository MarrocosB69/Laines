# Ferramentas solicitadas — estado de adoção

Registro separado das entregas do produto. A configuração adicional foi interrompida quando o usuário reiterou o foco nas atualizações da auditoria.

| Pedido | Estado e incompatibilidade encontrada |
|---|---|
| awesome-codex-skills | Instalado create-plan da coleção composio-community, revisão 0930e1373789d2eda449039f7ac154b33031de89. É uma skill de planejamento; não um bloqueador universal de edição. A proposta aprovada é o plano de trabalho. |
| ai-agent-rails-pack | AGENTS.md, templates, change-intent e self-check adotados de vadimche/ai-agent-rails-pack, revisão 4adaeafab1646601de375c0e8b1b1fe7d507f148. A autorização já dada cobre a implementação solicitada. |
| kragg-ts | 0.2.0 instalado e executado. ESLint rejeita casts para any e casts duplos. TypeScript fixado em 5.9.3: a resolução inicial para 6 causou incompatibilidade com baseUrl. Último diagnóstico estático: lint/tipos passaram; 9 gates falharam por dívida restante, 4 não executaram; 604 violações agregadas. Não foi criada baseline para ocultá-las. |
| RipStop | Não instalado. Registro público retornou 404; GitHub Packages exigiu autenticação (401). Versão oficial consultada 0.2.3 exige Node 22.x, enquanto ambiente local usa 24.12.0 e CI usa 20. A CLI consultada não possui init. Adoção depende de resolver acesso ao registry e compatibilidade do runtime; nenhuma credencial deve ser inserida em documentação ou chat. |
| pr-review-agent-skill | prepare-review-commits instalado de xpepper, revisão 058c77ba9a0e7ac2b340fbdbfb38a75e8c860b23. A execução considera mudanças não commitadas e exige escopo separável. O workspace contém trabalho anterior e repositórios internos; commits automáticos não foram executados. |
| phasegate | 0.340.0 instalado. Wrapper shell falhou no Windows; scripts e comandos dos hooks usam a entrada Node/tsx. L2: 7 checks passaram, 1 não executou. Hooks nativos dependem de confiança/ativação no cliente; instalação não prova execução. Doctor aponta ausência de Husky/CI específicos e incompatibilidade com hooksPath existente. Esses mecanismos não foram substituídos só para zerar o relatório. |

Comandos locais: npm run guard:kragg; npm run guard:phasegate -- validate --layer L2 --format human. Seus resultados não substituem testes funcionais, de autorização, banco, navegação ou homologação.
