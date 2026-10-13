# Fixture do portao de exportacao

@work-item-id WI-017

O teste SEC-06 representa o contrato atual de exportacao: administracao global recebe linhas detalhadas somente quando o registro pertence ao periodo solicitado; perfis delegados recebem apenas agregados, independentemente do periodo. O double fornece `period` com datas civis e fuso e pacientes sinteticos dentro e fora do intervalo. A expectativa verifica inclusao e exclusao sem depender do relogio atual nem alterar a implementacao.
