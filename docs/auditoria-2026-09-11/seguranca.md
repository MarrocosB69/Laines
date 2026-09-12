# Segurança — auditoria de 11/09/2026

## Conclusão e método

Há falhas de autenticação, autorização, integridade e upload que bloqueiam o fechamento desta versão. O problema predominante está na confiança atribuída ao perfil, ao payload e aos canais secundários de acesso.

Foram reproduzidos **oito vetores com o código atual e dados sintéticos**. Os serviços usaram repositórios simulados em memória; o upload usou um servidor Nest efêmero em loopback. Nenhum desses resultados representa exploração da instância de produção. Resultado detalhado: [security-probes.json](security-probes.json). Script arquivado: [security-probes.cjs](evidencias/security-probes.cjs).

Severidade descreve impacto; prioridade descreve ordem: **P0 bloqueia publicação; P1 deve fechar antes de concluir a versão; P2 é refinamento posterior aos bloqueadores.** Não foi calculado CVSS específico do ambiente.

## Achados comprovados

| ID | Severidade / prioridade | Evidência e consequência | Correção e aceite |
|---|---|---|---|
| SEC-01 | Crítica / P0 | `server/src/auth/auth.service.ts:582`: recuperação pública compara identificador, CPF e nascimento, recebe a senha nova e efetiva a troca. Não exige token por canal verificado. A prova substituiu a senha sem autenticação ou segredo de recuperação. Dados cadastrais conhecidos podem permitir tomada de conta. | Desafio aleatório, curto, de uso único e com expiração, enviado ao contato previamente verificado; armazenar hash do token e limitar tentativas. CPF/nascimento não podem autorizar a troca. Aceite: saber todos os dados cadastrais não permite redefinir; token vencido/reutilizado é rejeitado; troca revoga todas as sessões. |
| SEC-02 | Alta, crítica em cadeia com SEC-01 / P0 | `server/src/users/users.service.ts:391–418` usa `toPublic(user, true)` na listagem; remove o hash, mas devolve CPF, nascimento e senha temporária em texto quando vigente. `users.controller.ts:29–31,69–72` aceita permissão administrativa delegada. A prova com aluno + `admin:access` recebeu os fatores de recuperação e `tempPassword`. | DTO de projeção mínima por finalidade; remover senha temporária de leitura e armazenamento reversível; convite de ativação de uso único. Listagem de membros não deve incluir fatores de recuperação. Aceite: admin, diretoria e usuário delegado nunca recebem senha; dados pessoais só aparecem no escopo explicitamente necessário. |
| SEC-03 | Alta / P0 | `server/src/realtime/realtime.gateway.ts:146–154` distribui eventos por salas de role. `pacientes.service.ts:1307`, `avaliacoes.service.ts:1916,1955,2098` e `agendamentos.service.ts:433,578` enviam entidades salvas. `configuration.ts:155` inclui diretorias não clínicas na configuração padrão. A prova entregou payload clínico à sala de marketing. | Emissão por usuário/paciente autorizado ou aviso mínimo de invalidação, com nova leitura protegida no HTTP. Sala de diretoria não equivale a equipe assistencial. Aceite: dois usuários do mesmo role, com pacientes distintos, não recebem dados cruzados; marketing recebe apenas indicadores institucionais agregados. |
| SEC-04 | Alta / P0 | O gateway valida a conexão, mas não revalida a sessão ao emitir. A prova aceitou sessão marcada para trocar senha e manteve a conexão após revogação; apenas uma consulta ao usuário ocorreu. Logout, inativação e mudança de vínculo podem deixar um canal aberto. | Aplicar ao socket os mesmos bloqueios da sessão HTTP, expirar conexões e desconectar por revogação/mudança de escopo. Aceite: logout-all, expiração, troca de senha, inativação e retirada da equipe interrompem entrega; reconexão com credencial antiga falha. |
| SEC-05 | Alta / P0 | `server/src/public/public.service.ts:233–283`: inscrição pública localiza triagem pelo CPF e atualiza nome, e-mail e histórico de saúde sem comprovação de identidade. A prova sobrescreveu uma triagem existente e recebeu referência de prontuário. | Tornar duplicidade idempotente sem alteração dos dados existentes. Alteração exige sessão ou desafio verificado; resposta pública genérica. Aceite: nova submissão com CPF alheio não altera registro, não troca o contato e não revela cadastro existente. |
| SEC-06 | Alta / P0 | `server/src/analytics/analytics.controller.ts:33–36,76–92,151–176`: permissão de marketing abre relatórios; usuário sem projeto pode encaminhar `projectId=all`; `anonymize=false` segue para o serviço. A prova confirmou o encaminhamento sem imposição de escopo. A exposição exata depende do conteúdo da base. | Escopo e projeção impostos no servidor. Comunicação usa apenas dados institucionais agregados; exportação clínica identificada requer capacidade específica e vínculo/finalidade. Aceite: alterar query string nunca amplia população nem remove anonimização imposta ao perfil. |
| SEC-07 | Média / P1 | Escapamento do CSV em `server/src/analytics/analytics.service.ts` mantém `=1+1` como `"=1+1"`. Aspas de CSV não neutralizam fórmulas de planilha. A execução depende do consumidor do arquivo e da interação do usuário. | Neutralizar prefixos interpretáveis como fórmula nos campos de texto e testar exportação em consumidores suportados; preservar números e tipos. Aceite: conteúdo começando com `=`, `+`, `-`, `@` ou controles não vira fórmula quando deveria ser texto. |
| SEC-08 | Alta / P0 | `server/src/conteudos/conteudos.controller.ts:40–44,89–97,121–134`: `req.params.id` compõe o destino do Multer antes do `ParseUUIDPipe` e da autorização do conteúdo. Na prova, uma travessia codificada recebeu HTTP 400, **mas um arquivo já havia sido gravado fora da raiz de uploads**. A prova ficou inteiramente dentro de `tmp/auditoria-2026-09-11`. | Validar ID e autorização antes de qualquer escrita; garantir destino absoluto contido na raiz; temporário em quarentena e limpeza em falha; validar conteúdo/MIME além da extensão. Aceite: ID inválido ou conteúdo sem permissão gera zero arquivos e zero diretórios externos, incluindo entradas codificadas e variantes Windows/Linux. |

### SEC-09 — aprovação clínica declarada pelo cliente

**Alta / P0 para publicação de plano.** `server/src/planos-alimentares/plano-alimentar.service.ts:528–532,833–843` conserva `confirmadoPorId`, nome e data enviados no payload, preenchendo apenas valores ausentes. A prova clínica forneceu identidade de terceiro e data de 2001; a função manteve ambas. Isso comprova atribuição incorreta de autoria na função; não comprova por si só que qualquer papel consegue ativar qualquer plano pela API completa.

Correção: transição de revisão própria, vinculada à sessão, competência profissional e versão do plano. Autor, instante e identificação da versão devem ser definidos no servidor. Alteração relevante após revisão invalida a aprovação. Aceite: aluno não assina como profissional; cliente não define autor/data; revisão de uma versão não aprova versão posterior. Ver [produto clínico](produto-clinico.md).

## Controles existentes que vale preservar

- Validação global com whitelist e rejeição de propriedades desconhecidas em `server/src/main.ts`.
- Escopo por paciente em serviços HTTP, distinção de equipe e membro da liga em `server/src/auth/access-control.ts`.
- Fluxo de refresh, rotação e revogação; o núcleo de testes atual cobre parte desses contratos.
- Upload corporal com URLs assinadas e armazenamento privado previsto; token obrigatório para o processador de imagens.
- Soft delete em cadastros, trilha operacional, health/readiness e configuração de CORS/headers.

Ter JWT numa rota não prova autorização por objeto; não ter `RolesGuard` também não prova uma falha quando o serviço verifica permissões e vínculo. A matriz antiga em `docs/rbac-matrix.md` deve ser substituída por contratos que incluam serviço, objeto, campos e canal. Esta distinção segue o critério de autorização por objeto da [OWASP API Security](https://owasp.org/www-project-api-security/).

## Dependências e operação

Consulta atual ao npm encontrou **10 pacotes sinalizados no frontend e 16 no servidor**, com 9 e 8 classificados como altos, respectivamente. Isso é inventário de dependências afetadas, não 26 explorações comprovadas do LAINES. Alguns avisos dizem respeito a adaptadores Node, SSR, ferramentas de desenvolvimento ou outro banco. Ver [engenharia](engenharia.md) e os JSONs completos antes de priorizar atualização.

Não foram auditados os segredos reais, políticas de acesso do host, configuração ativa de Nginx/MinIO, certificados, backups restaurados ou logs de produção. Não há base para afirmar que essas superfícies estão seguras ou comprometidas. A publicação deve incluir essa verificação em homologação equivalente ao ambiente final.

## Matriz de ataques a repetir em homologação

Usar usuários sintéticos de duas equipes/projetos e papéis com e sem diretoria. Para pacientes, avaliações, planos, anexos, imagens, agenda e mensagens: testar listagem, leitura por ID, criação, alteração, exclusão, PDF e evento em tempo real. Repetir trocando IDs na URL e no corpo, ID inexistente, UUID malformado, paciente inativo e usuário sem vínculo.

Para publicação acadêmica: integrante pode ler material publicado de outra diretoria; não pode alterar, aprovar, excluir, anexar ou concluir tarefa interna dela. Rascunhos e fila interna não entram na projeção comum. Fazer as verificações diretamente na API, além de esconder botões na interface.

A proteção de recuperação deve seguir um desafio verificável; a de WebSocket deve durar toda a conexão, conforme [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) e [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).

Dados de saúde são sensíveis na LGPD. Minimização, finalidade, controle de acesso e segurança são requisitos de projeto; definir a base legal e as responsabilidades institucionais exige validar o tratamento real, não apenas marcar um consentimento no cadastro. Referência: [LGPD, arts. 5º, 6º, 11 e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm). Esta auditoria não certifica conformidade legal.
