import React, { useId } from 'react';
import { AlertCircle, OctagonAlert, TriangleAlert } from 'lucide-react';
import { classes, normalizarTom } from './apoio';
import { useDica } from './useDica';
import { BotaoDica, PainelDica } from './Dica';
import './avaliacao-base.css';

/* Campos dos formulários de avaliação, no padrão de FieldGroup
   (src/views/public/inscricao/campos.jsx): rótulo ligado por htmlFor/id,
   ajuda, unidade, valor anterior e erro ligados por aria-describedby. Só
   apresentação: value, onChange, conversões e validações continuam no
   formulário. Contrato: docs/implementacao/avaliacoes-v2/contrato-avaliacao.md.

   Nenhuma classe legada é posta aqui por conta própria. O modo essencial de
   AvaliacaoCompleta conta `.eval-field` e procura `.eval-field--critical`,
   `[required]` e as marcas `*-required*`: quem migra passa essas classes em
   `className`/`classeObrigatorio` exatamente onde elas já estavam. */

const CONTROLES_CLONAVEIS = new Set(['input', 'select', 'textarea']);

function controleUnico(children) {
  if (typeof children === 'function') return null;
  const lista = React.Children.toArray(children);
  if (lista.length !== 1) return null;
  const [unico] = lista;
  if (!React.isValidElement(unico) || typeof unico.type !== 'string') return null;
  return CONTROLES_CLONAVEIS.has(unico.type) ? unico : null;
}

const juntarIds = (...ids) => ids.filter(Boolean).join(' ') || undefined;

// "obrigatório" escrito, não só um asterisco em cor. Fica dentro do rótulo:
// o nome acessível do campo passa a dizer que ele é obrigatório.
const MarcaObrigatorio = ({ classe }) => (
  <span className={classes('av-campo__obrigatorio', classe)}>obrigatório</span>
);

const MensagemErro = ({ id, erro }) => (
  <p className="av-campo__erro" id={id}>
    <AlertCircle size={16} aria-hidden="true" />
    <span>{erro}</span>
  </p>
);

// Tom de atenção ou de perigo: faixa fisiológica, campo de risco. Os outros
// tons não se aplicam a campo. É complemento: a mensagem escrita vem do
// formulário (rótulo ou ajuda); aqui entram a cor e um ícone de forma própria.
const tomDoCampo = (tom) => {
  const normal = normalizarTom(tom);
  return normal === 'atencao' || normal === 'perigo' ? normal : null;
};

const IconeTom = ({ tom }) => {
  const Icone = tom === 'perigo' ? OctagonAlert : TriangleAlert;
  return <Icone className="av-tom__icone" size={16} aria-hidden="true" />;
};

export function Campo({
  rotulo, unidade, ajuda, erro, obrigatorio = false, classeObrigatorio, anterior,
  rotuloOculto = false, id, className, children, dica, tom
}) {
  const gerado = useId();
  const unico = controleUnico(children);
  const controleId = unico?.props.id || id || `av-campo-${gerado.replace(/[^\w-]/g, '')}`;
  const rotuloId = `${controleId}-rotulo`;
  const unidadeId = unidade ? `${controleId}-unidade` : null;
  const ajudaId = ajuda ? `${controleId}-ajuda` : null;
  const anteriorId = anterior ? `${controleId}-anterior` : null;
  const erroId = erro ? `${controleId}-erro` : null;
  const temErro = Boolean(erro);
  const dicaCampo = useDica(dica, `${controleId}-dica`);
  const tomCampo = tomDoCampo(tom);

  const propsDoControle = (existentes = {}) => ({
    id: controleId,
    'aria-describedby': juntarIds(existentes['aria-describedby'], unidadeId, ajudaId, anteriorId, erroId, dicaCampo.descritaPor),
    'aria-invalid': temErro ? 'true' : existentes['aria-invalid']
  });

  // O ícone do tom entra no mesmo espaço do rótulo: sem tom, a lista de
  // filhos fica igual à de antes (a posição conta para os ids do useId).
  const conteudoRotulo = (
    <>
      {tomCampo ? <><IconeTom tom={tomCampo} />{rotulo}</> : rotulo}
      {obrigatorio && <>{' '}<MarcaObrigatorio classe={classeObrigatorio} /></>}
    </>
  );
  const classeRotulo = classes('av-campo__rotulo', rotuloOculto && 'av-sr');

  // Três formas, como FieldGroup: um input/select/textarea único é clonado;
  // uma função recebe os props de ligação (componente próprio); qualquer
  // outra coisa vira um grupo rotulado.
  let controle;
  let rotuloEl;
  if (unico) {
    controle = React.cloneElement(unico, {
      ...propsDoControle(unico.props),
      className: classes(unico.props.className, 'av-controle')
    });
    rotuloEl = <label className={classeRotulo} id={rotuloId} htmlFor={controleId}>{conteudoRotulo}</label>;
  } else if (typeof children === 'function') {
    controle = children(propsDoControle());
    rotuloEl = <label className={classeRotulo} id={rotuloId} htmlFor={controleId}>{conteudoRotulo}</label>;
  } else {
    controle = (
      <div role="group" aria-labelledby={rotuloId} aria-describedby={juntarIds(unidadeId, ajudaId, anteriorId, erroId, dicaCampo.descritaPor)}>
        {children}
      </div>
    );
    rotuloEl = <span className={classeRotulo} id={rotuloId}>{conteudoRotulo}</span>;
  }

  // A dica fica fora do <label>: o "?" ao lado do rótulo e o texto logo
  // abaixo da linha do rótulo. Sem dica, a marcação é a de antes, com os
  // mesmos filhos nas mesmas posições.
  const botaoDica = dicaCampo.conteudo ? <BotaoDica dica={dicaCampo} /> : null;
  const cabeca = (
    <div className="av-campo__cabeca">
      {botaoDica ? <>{rotuloEl}{botaoDica}</> : rotuloEl}
      {anterior && <span className="av-campo__anterior" id={anteriorId}>{anterior}</span>}
    </div>
  );

  return (
    <div
      className={classes('av-campo', temErro && 'av-campo--erro', tomCampo && `av-campo--${tomCampo}`, className)}
      onKeyDown={dicaCampo.aoTeclarNoCampo}
    >
      {botaoDica ? <>{cabeca}<PainelDica dica={dicaCampo} /></> : cabeca}
      {unidade ? (
        <div className="av-campo__controle av-campo__controle--unidade">
          {controle}
          <span className="av-campo__unidade" id={unidadeId}>{unidade}</span>
        </div>
      ) : (
        <div className="av-campo__controle">{controle}</div>
      )}
      {ajuda && <p className="av-campo__ajuda" id={ajudaId}>{ajuda}</p>}
      {temErro && <MensagemErro id={erroId} erro={erro} />}
    </div>
  );
}

// type e inputMode ficam como o formulário já tinha: um campo que era
// type="number" continua number (o valor que o onChange recebe muda entre
// os dois tipos). O padrão é o texto com teclado decimal de BioimpedanciaForm.
export function CampoNumero({
  rotulo, unidade, ajuda, erro, obrigatorio, classeObrigatorio, anterior, rotuloOculto, id,
  className, dica, tom, inputClassName, type = 'text', inputMode = 'decimal', ...propsDoInput
}) {
  return (
    <Campo
      rotulo={rotulo}
      unidade={unidade}
      ajuda={ajuda}
      erro={erro}
      obrigatorio={obrigatorio}
      classeObrigatorio={classeObrigatorio}
      anterior={anterior}
      rotuloOculto={rotuloOculto}
      id={id}
      className={className}
      dica={dica}
      tom={tom}
    >
      <input type={type} inputMode={inputMode} className={inputClassName} {...propsDoInput} />
    </Campo>
  );
}

// fieldset/legend para rádio e caixa de seleção. As opções são as do
// formulário, com os mesmos name/value/checked/onChange (Opcao repassa tudo).
//
// Dois casos saem do fieldset e viram `role="group"` com aria-labelledby:
// - `rotuladoPor`: o grupo é rotulado por um título que já existe na tela
//   (o de uma AvaliacaoSecao, por exemplo: idTituloSecao(id)), sem legend;
// - `dica`: o "?" não pode ir dentro da legend, porque entraria no nome do
//   grupo. A legenda vira um <span> com id, ao lado do botão.
export function GrupoOpcoes({
  legenda, ajuda, erro, obrigatorio = false, classeObrigatorio, horizontal = false,
  className, children, dica, tom, rotuladoPor
}) {
  const base = `av-grupo-${useId().replace(/[^\w-]/g, '')}`;
  const ajudaId = ajuda ? `${base}-ajuda` : null;
  const erroId = erro ? `${base}-erro` : null;
  const dicaGrupo = useDica(dica, `${base}-dica`);
  const tomGrupo = tomDoCampo(tom);
  const classe = classes('av-grupo', horizontal && 'av-grupo--horizontal', erro && 'av-grupo--erro', tomGrupo && `av-grupo--${tomGrupo}`, className);

  if (!rotuladoPor && !dicaGrupo.conteudo) {
    return (
      <fieldset className={classe} aria-describedby={juntarIds(ajudaId, erroId)}>
        <legend className="av-grupo__legenda">
          {tomGrupo ? <><IconeTom tom={tomGrupo} />{legenda}</> : legenda}
          {obrigatorio && <>{' '}<MarcaObrigatorio classe={classeObrigatorio} /></>}
        </legend>
        {ajuda && <p className="av-campo__ajuda" id={ajudaId}>{ajuda}</p>}
        <div className="av-grupo__opcoes">{children}</div>
        {erro && <MensagemErro id={erroId} erro={erro} />}
      </fieldset>
    );
  }

  const legendaId = `${base}-legenda`;
  return (
    <div
      className={classe}
      role="group"
      aria-labelledby={rotuladoPor || legendaId}
      aria-describedby={juntarIds(ajudaId, erroId, dicaGrupo.descritaPor)}
      onKeyDown={dicaGrupo.aoTeclarNoCampo}
    >
      {(!rotuladoPor || dicaGrupo.conteudo) && (
        <div className="av-grupo__cabeca">
          {!rotuladoPor && (
            <span className="av-grupo__legenda" id={legendaId}>
              {tomGrupo ? <><IconeTom tom={tomGrupo} />{legenda}</> : legenda}
              {obrigatorio && <>{' '}<MarcaObrigatorio classe={classeObrigatorio} /></>}
            </span>
          )}
          <BotaoDica dica={dicaGrupo} />
        </div>
      )}
      <PainelDica dica={dicaGrupo} />
      {ajuda && <p className="av-campo__ajuda" id={ajudaId}>{ajuda}</p>}
      <div className="av-grupo__opcoes">{children}</div>
      {erro && <MensagemErro id={erroId} erro={erro} />}
    </div>
  );
}

// Uma opção de 44 px: o rótulo inteiro é o alvo. Todo prop além de
// tipo/rotulo/descricao/className vai para o <input> sem mudança.
export function Opcao({ tipo = 'radio', rotulo, descricao, className, ...propsDoInput }) {
  return (
    <label className={classes('av-opcao', className)}>
      <input type={tipo} {...propsDoInput} />
      <span className="av-opcao__texto">
        <span className="av-opcao__rotulo">{rotulo}</span>
        {descricao && <span className="av-opcao__descricao">{descricao}</span>}
      </span>
    </label>
  );
}
