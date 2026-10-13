# Montagem e conferência do plano alimentar

@work-item-id WI-010

## Navegação e entrada

O topo identifica paciente, estado e salvamento. Um mapa compacto reúne as refeições na ordem dos horários e leva ao cartão correspondente. A expansão dos cartões é estado de interface e não uma alteração clínica. Ícones só sugerem reordenação quando houver reordenação funcional.

A busca principal fica no cartão da refeição; escolher um resultado abre um passo curto para informar quantidade e confirmar a inclusão. O catálogo TACO/TBCA disponível nesta rota trabalha em gramas, então a unidade deve ser explícita. Quando uma fonte oferecer medidas válidas, a medida e os gramas correspondentes devem aparecer antes de confirmar. A busca de substituto continua junto do item original. Blocos guardados somente na sessão devem dizer isso na ação.

## Salvamento e revisão

Mostrar o estado `novo`, `alterações não salvas`, `salvando` ou `versão salva` junto às ações. Enquanto a gravação está em trânsito, o profissional pode continuar a editar; a resposta confirma somente o snapshot enviado e não sobrescreve mudanças posteriores. Uma falha deixa as edições disponíveis.

Antes de enviar para revisão, aprovar ou ativar, uma etapa de conferência mostra paciente, refeições, horários, alimentos principais, alternativas e subtotais. O botão final executa o handler já existente; o servidor mantém a decisão. Impedimentos de quantidade ou restrição levam à refeição ou ao painel relevante. O PDF continua refletindo a versão salva, não um rascunho local.

## Dados nutricionais incompletos

Os totais da tela e do PDF preservam os cálculos atuais. Quando faltar composição, o número deve ser identificado como subtotal conhecido e a cobertura deve aparecer onde já é calculada. Sem qualquer dado para um nutriente, exibir um traço em vez de interpretar ausência como zero. O aviso é informativo para conferência profissional e não cria nova regra automática de bloqueio.

## Critérios de aceite

- Abrir/fechar cartões não torna o plano sujo; mudar quantidade, alimento ou orientação torna.
- Edição feita durante salvamento continua após a resposta e ainda pede novo salvamento.
- A inclusão principal informa quantidade e medida antes de acrescentar a linha.
- Mapa e conferência funcionam por teclado e não geram rolagem horizontal em 390 px.
- Envio/revisão/ativação continuam com as permissões e chamadas existentes.
- Testes com itens de composição parcial preservam os valores numéricos do contrato e qualificam os resumos exibidos.
