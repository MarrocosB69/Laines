# Prompt para Claude: area de supervisao professor/profissional

Voce vai aprimorar a area visual atualmente acessada pela rota `/professor`, mas sem alterar a regra de negocio do backend.

## Contexto conceitual

No LAINES, o aluno sempre deve ter um professor supervisor obrigatorio. O aluno tambem pode ter um profissional supervisor opcional.

Exemplo real de modelo:

- Thaiz e professora supervisora de Bruno.
- Rebeca Lugaresi e profissional supervisora opcional de Bruno.
- Thaiz e Rebeca podem acompanhar os atletas vinculados a Bruno.
- Se Rebeca se cadastra pela area de login e e aprovada como `profissional`, ela passa a existir como usuaria ativa, mas so deve ver alunos/atletas depois que um administrador vincular Rebeca ao aluno no campo `profissionalId`.

## Backend disponivel

Use `GET /users/meus-supervisionados`.

O endpoint agora retorna objetos com campos aditivos:

```js
{
  id,
  nome,
  email,
  matricula,
  curso,
  periodo,
  projetoId,
  projetoNome,
  supervisorId,
  supervisorNome,
  profissionalId,
  profissionalNome,
  supervisaoTipo, // professor | profissional | equipe_multi
  supervisao: {
    tipo,
    professor: { id, nome } | null,
    profissional: { id, nome } | null,
    usuarioEhProfessorSupervisor,
    usuarioEhProfissionalSupervisor
  },
  resumo: {
    totalPacientes,
    pacientesAtivos,
    listaEspera,
    triagem,
    ultimaAtividadeEm
  },
  pacientes: [
    {
      id,
      nome,
      status,
      prontuario,
      modalidadePrincipal,
      projetoId,
      projetoNome,
      alunoResponsavelId,
      alunoResponsavelNome,
      professorSupervisorId,
      professorSupervisorNome,
      updatedAt,
      createdAt
    }
  ]
}
```

## Objetivo visual

Transforme a tela de professor em uma area de supervisao. A mesma rota pode continuar `/professor`, mas a linguagem visual deve ser:

- Para professor: "Area de supervisao docente".
- Para profissional: "Area de supervisao profissional".
- Para pesquisador/colaborador: "Area de acompanhamento".

Evite chamar tudo de "Professor" quando o usuario logado for `profissional`.

## Estados que a tela precisa cobrir

1. Professor com alunos vinculados
   - Mostrar alunos supervisionados.
   - Destacar professor supervisor obrigatorio.
   - Mostrar profissional supervisor quando existir.
   - Mostrar atletas por aluno.

2. Profissional com alunos vinculados
   - Mostrar alunos onde `supervisao.usuarioEhProfissionalSupervisor === true`.
   - Mostrar professor supervisor daquele aluno como contexto.
   - Mostrar atletas por aluno.
   - Nao oferecer acao de criar atleta para outro aluno se a regra atual permitir criacao apenas pelo professor.

3. Profissional aprovado sem vinculo
   - Se `/users/meus-supervisionados` retornar lista vazia, mostrar estado vazio:
     "Seu cadastro profissional esta ativo. Aguarde o vinculo com alunos pela coordenacao para visualizar acompanhamentos."
   - Nao sugerir erro tecnico.

4. Atletas vinculados diretamente a equipe multiprofissional
   - Quando `supervisaoTipo === 'equipe_multi'`, mostrar como bloco separado:
     "Atletas vinculados diretamente ao seu perfil".

## Organizacao sugerida

Use uma composicao operacional, sem cara de landing page:

- Visao geral:
  - total de alunos supervisionados;
  - total de atletas acompanhados;
  - atletas ativos;
  - lista de espera/triagem;
  - ultima atividade.

- Meus alunos:
  - cards ou lista densa por aluno;
  - nome, curso, periodo, projeto;
  - professor supervisor;
  - profissional supervisor;
  - resumo de atletas.

- Atletas acompanhados:
  - tabela/lista filtravel por aluno, status e modalidade;
  - botao para abrir prontuario existente.

- Revisoes e pendencias:
  - usar as avaliacoes e pendencias ja carregadas pela tela atual;
  - separar "aguardando revisao", "em andamento" e "recentes".

## Restrições

- Nao altere endpoints.
- Nao duplique regra de acesso no frontend.
- Nao invente dados; use os campos retornados pelo backend.
- Preserve a rota existente e os fluxos de agenda/prontuario.
- Mantenha responsivo para mobile.
- Nao use textos explicativos longos dentro da UI.
- Use labels curtos e claros.

## Arquivos provaveis

- `src/views/professor/ProfessorDashboard.jsx`
- `src/views/professor/ProfessorSidebar.jsx`
- `src/views/professor/ProfessorHeader.jsx`
- `src/views/professor/ProfessorView.jsx`
- CSS correspondente em `src/views/professor/`

## Resultado esperado

A tela deve deixar claro que:

- professor e profissional sao supervisores;
- professor supervisor e obrigatorio no vinculo do aluno;
- profissional supervisor e opcional;
- profissional aprovado pela solicitacao de acesso aparece no sistema, mas precisa ser vinculado a alunos para ver acompanhamentos;
- a supervisao olha para aluno -> atletas -> avaliacoes/pendencias, e nao apenas para uma lista solta de pacientes.
