# Numeros da prescricao

@work-item-id WI-017

O formatador da interface de prescricao aceita somente numeros finitos. Ausencia, `NaN` e infinito aparecem como travessao; zero finito continua zero. Esse guard de apresentacao nao substitui a investigacao do calculo que produziu `NaN` no plano com peso ausente, nem transforma ausencia de meta em valor clinico.
