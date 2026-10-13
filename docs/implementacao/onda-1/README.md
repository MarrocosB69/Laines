# Onda 1 — UPD-09 e UPD-10

@work-item-id WI-002

[Intenção aprovada](change-intent.md). Esta entrega cobre dependências e publicação/entrega do plano. UPD-11, UPD-12, UPD-17 e o restante de UPD-20 continuam pendentes.

## Dependências

Relatório de produção: frontend passou de 10 para 0 pacotes afetados; backend de 16 para 4 moderados, sem altos ou críticos. Os quatro restantes pertencem à árvore de MinIO. A [análise de aplicabilidade](dependencias.md) explica os caminhos observados e o motivo para não forçar um downgrade do SDK.

## Plano alimentar

- O atleta encontra o plano vigente no início de Acompanhamento: refeições, horários, porções, alternativas, orientações, suplementos e identificação da revisão.
- Portal e PDF usam a mesma projeção de refeições calculada no servidor. Medidas legadas preservam seu texto sem multiplicação incorreta.
- Download informa a versão exibida. Se ela mudou, a API retorna conflito; o portal atualiza a tela e pede nova conferência antes de outro download.
- Salvar alterações em um plano publicado cria outro rascunho. O plano entregue continua disponível até a nova publicação. O novo registro guarda a origem; o publicado não pode ser excluído.
- Publicação bloqueia o paciente em transação, arquiva os planos anteriormente ativos e publica a versão revisada. Uma falha reverte toda a operação. Publicações simultâneas deixam apenas um ativo.
- Planos legados marcados ativos sem revisão registrada pelo servidor precisam passar pelo fluxo de revisão antes de aparecer no portal.

## Validação

As regressões do núcleo e de segurança passaram. A integração PostgreSQL verificou migração, logout, recuperação concorrente, preservação de planos, HTTP do atleta, conteúdo real do PDF, rejeição de versão antiga, rollback da publicação e concorrência. O teste de navegador usa o componente React real com respostas sintéticas: não substitui a homologação de toda a aplicação.

Resultados, saídas e hashes ficam em [evidências](evidencias/) e no [estado da execução](../status.json). A configuração do build de teste aponta para a API local isolada. O build para publicação deve usar a URL do ambiente de destino.

[Como reproduzir a validação](validacao.md). Resultado confirmado: 100 verificações do núcleo, 45 de segurança/prescrição, 5 grupos de integração PostgreSQL e 10 cenários de navegador aprovados; builds aprovados e lint sem erros, com dez avisos existentes.

## Self-check

**WARN para fechamento da versão; entregas locais verificadas conforme evidências.** As mudanças seguem WI-001/WI-002. O reparo da projeção administrativa evita uma regressão introduzida na proteção de credenciais. A remoção de casts incompatíveis com a regra solicitada foi limitada aos contratos afetados e registrada na onda 0. Não houve commit automático, push, deploy ou alteração de dados reais.

Revisão deve conferir migração/ativação de contas, preservação de planos legados e contrato de entrega. Rollback exige manifests/lockfiles coerentes e a preservação dos registros publicados; reverter dependências reintroduz os avisos anteriores. Referências nutricionais e restrições (UPD-11), autorização completa (UPD-12), supervisão e jornadas integradas ainda precisam de suas próprias entregas.
