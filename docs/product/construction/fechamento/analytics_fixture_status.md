# Estado da avaliacao no seed analitico

@work-item-id WI-017

As tres avaliacoes sinteticas de `seed-ci-analytics.js` sao registros encerrados e devem usar `finalizada`, estado reconhecido pela API clinica. A fixture precisa servir tanto ao painel analitico quanto a abertura do prontuario e das pendencias, preservando os mesmos IDs, projetos, periodos e totais.

O harness local informa o ID do paciente sintetico ao E2E, que exige 200 e uma lista de pendencias. Executar o E2E separado, sem essa variavel, nao pressupoe IDs fixos de outros ambientes.
