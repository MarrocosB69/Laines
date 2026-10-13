# Datas civis no cliente

@work-item-id WI-017

Uma string exata `YYYY-MM-DD` representa data civil, sem fuso nem hora. O cliente a interpreta como o dia local indicado, evitando que meia-noite UTC apareca no dia anterior no Brasil. Strings ISO com horario ou offset e objetos `Date` continuam instantes e seguem o fuso do navegador. Datas civis impossiveis nao viram outro dia por overflow. A regra vale para formatacao, chaves de agenda e campos `date` que reutilizam `toDate`.
