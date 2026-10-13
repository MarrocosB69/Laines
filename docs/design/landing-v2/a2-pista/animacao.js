// LAINES, landing v2, direção A2: o mínimo de JS do mockup.
//
// 1. Antes da primeira pintura, marca <html class="animar"> se a pessoa não
//    pediu movimento reduzido. A coreografia inteira está no CSS e só roda
//    com essa classe; sem JS, a página nasce no estado final.
// 2. Depois do DOM: microinterações do formulário e o modal. Nada é enviado.

(function () {
  var semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!semMovimento) document.documentElement.classList.add('animar');
})();

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('form-login');
  var login = document.getElementById('login-id');
  var senha = document.getElementById('login-senha');
  var tipo = document.getElementById('tipo-login');
  var mostrar = document.querySelector('.campo__mostrar');
  var caps = document.getElementById('aviso-caps');
  var botao = form.querySelector('.botao-entrar');
  var rotulo = botao.querySelector('.botao-entrar__rotulo');
  var erroGeral = document.getElementById('erro-login');

  // O campo reconhece o que está sendo digitado: CPF (só dígitos, pontos e
  // traço) ou e-mail (tem @). Só confirma; não bloqueia nem corrige.
  login.addEventListener('input', function () {
    var v = login.value.trim();
    var texto = '';
    if (v.indexOf('@') > -1) texto = 'E-mail';
    else if (/^[\d.\-\s]+$/.test(v) && /\d/.test(v)) texto = 'CPF';
    if (texto) tipo.textContent = texto;
    tipo.classList.toggle('visivel', Boolean(texto));
    limparErro(login, 'erro-login-id');
  });

  senha.addEventListener('input', function () { limparErro(senha, 'erro-login-senha'); });

  mostrar.addEventListener('click', function () {
    var ver = senha.type === 'password';
    senha.type = ver ? 'text' : 'password';
    mostrar.setAttribute('aria-pressed', String(ver));
    mostrar.setAttribute('aria-label', ver ? 'Ocultar senha' : 'Mostrar senha');
  });

  function verCaps(e) {
    if (typeof e.getModifierState !== 'function') return;
    caps.hidden = !e.getModifierState('CapsLock');
  }
  senha.addEventListener('keydown', verCaps);
  senha.addEventListener('keyup', verCaps);
  senha.addEventListener('blur', function () { caps.hidden = true; });

  function marcarErro(campo, idErro) {
    campo.setAttribute('aria-invalid', 'true');
    document.getElementById(idErro).hidden = false;
  }
  function limparErro(campo, idErro) {
    campo.removeAttribute('aria-invalid');
    document.getElementById(idErro).hidden = true;
    erroGeral.hidden = true;
  }

  function balancar() {
    form.classList.remove('balancar');
    void form.offsetWidth; // reinicia a animação se a pessoa errar de novo
    form.classList.add('balancar');
  }

  // Envio simulado: campos vazios ganham mensagem própria; com os dois
  // preenchidos, "Entrando…" e, no mockup, a recusa da credencial.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (botao.getAttribute('aria-busy') === 'true') return;
    var faltando = [];
    if (!login.value.trim()) { marcarErro(login, 'erro-login-id'); faltando.push(login); }
    if (!senha.value) { marcarErro(senha, 'erro-login-senha'); faltando.push(senha); }
    if (faltando.length) {
      balancar();
      faltando[0].focus();
      return;
    }
    botao.setAttribute('aria-busy', 'true');
    rotulo.textContent = 'Entrando…';
    window.setTimeout(function () {
      botao.removeAttribute('aria-busy');
      rotulo.textContent = 'Entrar';
      erroGeral.hidden = false;
      balancar();
      senha.select();
    }, 1400);
  });

  // Modal "Solicitar acesso": abre com <dialog>, entra com opacity e transform.
  var modal = document.getElementById('modal-solicitacao');
  var abrir = document.getElementById('abrir-solicitacao');
  abrir.addEventListener('click', function () {
    modal.showModal();
    window.requestAnimationFrame(function () { modal.classList.add('aberto'); });
  });
  function fechar() {
    modal.classList.remove('aberto');
    modal.close();
    abrir.focus();
  }
  modal.querySelectorAll('[data-fechar]').forEach(function (b) { b.addEventListener('click', fechar); });
  modal.addEventListener('cancel', function (e) { e.preventDefault(); fechar(); });
  modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });

  document.getElementById('esqueci').addEventListener('click', function () {
    // Na página real abre o modal de recuperação, que não muda nesta proposta.
  });
});
