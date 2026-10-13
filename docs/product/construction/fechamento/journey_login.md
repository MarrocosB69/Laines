# Entrada do roteiro de auditoria

@work-item-id WI-017

O roteiro de navegador inicia na landing `/`, preenche os campos `login-identifier` e `login-password` e aciona `login-submit`. O sucesso exige o caminho esperado do perfil; a tela ainda aberta, uma mensagem de erro ou tempo excedido devem registrar falha, sem produzir falso positivo. As credenciais sao fornecidas apenas pelo ambiente.
