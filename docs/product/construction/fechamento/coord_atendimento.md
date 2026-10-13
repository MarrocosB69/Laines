# Coordenacao de atendimento: escopo de pacientes

@work-item-id WI-017

O papel `coord_atendimento` gerencia cadastro, situacao e vinculos de todos os pacientes da liga, independentemente de equipe ou projeto. Pode consultar prontuarios, avaliacoes, planos e agenda para coordenar o atendimento. A leitura do prontuario e de registros individuais de avaliacao/plano usa a trilha de acesso de gestao.

A coordenacao nao ganha autoria, finalizacao ou revisao de avaliacoes e planos; essas acoes seguem as regras clinicas existentes. A capacidade de exportar relatorio detalhado tambem nao decorre desse papel. O painel agregado usa todos os projetos com anonimização obrigatoria.

A flag `coordAtendimento` usada para tarefas de equipe nao equivale ao papel e nao concede acesso clinico global. Outros papeis e escopos permanecem iguais.
