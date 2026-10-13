import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

const CAMPOS_CLONAVEIS = new Set(['input', 'select', 'textarea']);

// Em volta de um unico input/select/textarea, o FieldGroup liga o rotulo
// direto nele (clona o elemento); em volta de qualquer outra coisa (grupo
// de opcoes, chips, composto), vira um <div role="group"> rotulado por um
// <span>. Ver docs/implementacao/inscricao-v2/change-intent.md.
function campoUnicoClonavel(children) {
  const lista = React.Children.toArray(children);
  if (lista.length !== 1) return null;
  const [unico] = lista;
  if (!React.isValidElement(unico) || typeof unico.type !== 'string') return null;
  return CAMPOS_CLONAVEIS.has(unico.type) ? unico : null;
}

export function FieldGroup({ label, required, children, error, id }) {
  const labelId = useId();
  const errorId = useId();
  const controlIdGerado = useId();

  const asterisco = required && <span className="ip-required" aria-hidden="true">*</span>;
  const textoObrigatorio = required && <span className="ip-sr-only"> (obrigatório)</span>;
  const rotulo = <>{label}{asterisco}{textoObrigatorio}</>;
  const classeCampo = `ip-field${error ? ' ip-field--error' : ''}`;
  const mensagemErro = error && (
    <span className="ip-error-msg" id={errorId}>
      <AlertCircle size={14} aria-hidden="true" />
      <span>{error}</span>
    </span>
  );

  // Id explicito: quem chama ja poe o mesmo id no controle - o FieldGroup
  // so liga o <label>, sem mexer nos filhos.
  if (id) {
    return (
      <div className={classeCampo}>
        <label className="ip-label" htmlFor={id}>{rotulo}</label>
        {children}
        {mensagemErro}
      </div>
    );
  }

  const campo = campoUnicoClonavel(children);
  if (campo) {
    const controlId = campo.props.id || controlIdGerado;
    const describedByExistente = campo.props['aria-describedby'];
    const describedBy = [describedByExistente, error ? errorId : null].filter(Boolean).join(' ') || undefined;
    const clone = React.cloneElement(campo, {
      id: controlId,
      'aria-invalid': error ? 'true' : campo.props['aria-invalid'],
      'aria-describedby': describedBy
    });
    return (
      <div className={classeCampo}>
        <label className="ip-label" htmlFor={controlId}>{rotulo}</label>
        {clone}
        {mensagemErro}
      </div>
    );
  }

  // Grupo (radio, chips, composto): rotulo vira <span>, filhos ganham role="group".
  return (
    <div className={classeCampo}>
      <span className="ip-label" id={labelId}>{rotulo}</span>
      <div role="group" aria-labelledby={labelId}>
        {children}
      </div>
      {mensagemErro}
    </div>
  );
}
