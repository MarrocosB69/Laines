import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GRUPOS } from '../../constants/prescricao/seed.js';

/**
 * Conferência das restrições alimentares (UPD-11).
 *
 * A anamnese registra alergias/intolerâncias em texto livre; ninguém deve
 * recadastrar isso aqui. O que este painel faz é mapear esse texto para grupos
 * e alimentos do catálogo, para que o motor de sugestões exclua o que não pode
 * ser oferecido — e exigir justificativa para cada item do plano que colide
 * com a restrição confirmada. Autoria e data da conferência são fixadas pelo
 * servidor ao salvar.
 */
const formatarData = (valor) => {
  const texto = String(valor || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return 'data não informada';
  const [ano, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${ano}`;
};

export default function PainelRestricoes({
  contexto,
  registro,
  grupos = {},
  itensEmConflito = [],
  onChange
}) {
  const [aberto, setAberto] = useState(!registro?.conferidoEm);
  const origem = contexto?.origem;
  const descricaoAnamnese = contexto?.descricao || '';

  const opcoesGrupo = useMemo(() => {
    const ids = new Set([...Object.keys(GRUPOS), ...Object.keys(grupos)]);
    return [...ids].map((id) => ({ id, rotulo: GRUPOS[id]?.rotulo || grupos[id]?.rotulo || id }));
  }, [grupos]);

  const atual = registro || { semRestricao: false, grupos: [], alimentoIds: [], observacao: '', justificativas: {} };
  const gruposSelecionados = new Set(atual.grupos || []);
  const pendente = !registro?.conferidoEm;
  const conflitosSemJustificativa = itensEmConflito.filter((item) => !item.justificada);

  const atualizar = (patch) => onChange({
    ...atual,
    origem: { descricao: descricaoAnamnese, avaliacaoId: origem?.avaliacaoId || null, data: origem?.data || null },
    ...patch
  });

  const alternarGrupo = (id) => {
    const proximo = new Set(gruposSelecionados);
    if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
    atualizar({ grupos: [...proximo], semRestricao: false });
  };

  const situacao = pendente
    ? 'Restrições ainda não conferidas neste plano.'
    : atual.semRestricao
      ? 'Sem restrição confirmada para este plano.'
      : `${gruposSelecionados.size} grupo(s) e ${(atual.alimentoIds || []).length} alimento(s) restritos.`;

  return (
    <section className="pp-cartao pp-restricoes" aria-labelledby="restricoes-titulo">
      {/* O botao de dobra fica dentro do titulo (padrao de acordeao), para a
          secao aparecer na navegacao por titulos sem perder o aria-expanded. */}
      <h3 className="pp-restricoes__titulo">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="pp-restricoes__alternar"
        >
          <span className="pp-restricoes__nome">
            {aberto ? <ChevronDown className="pp-icone" aria-hidden="true" /> : <ChevronRight className="pp-icone" aria-hidden="true" />}
            <span id="restricoes-titulo">Restrições alimentares</span>
          </span>
          <span className={pendente || conflitosSemJustificativa.length ? 'pp-restricoes__situacao pp-restricoes__situacao--atencao' : 'pp-restricoes__situacao'}>
            {situacao}{conflitosSemJustificativa.length ? ` · ${conflitosSemJustificativa.length} conflito(s) a justificar` : ''}
          </span>
        </button>
      </h3>

      {aberto && (
        <div className="pp-restricoes__corpo">
          <p className="pp-restricoes__anamnese">
            Anamnese: {descricaoAnamnese ? <span className="pp-restricoes__citacao">“{descricaoAnamnese}”</span> : 'sem alergias/intolerâncias informadas'}
            {origem ? ` · ${origem.status} em ${formatarData(origem.data)}` : ' · sem anamnese finalizada'}.
          </p>
          {contexto?.motivo && pendente && <p role="status" className="pp-nota pp-nota--atencao">{contexto.motivo}</p>}
          {registro?.conferidoEm && (
            <p className="pp-nota">Conferido por {registro.conferidoPorNome || 'usuário'} em {formatarData(registro.conferidoEm)}.</p>
          )}

          <label className="pp-checagem">
            <input
              type="checkbox"
              checked={Boolean(atual.semRestricao)}
              onChange={(e) => atualizar({ semRestricao: e.target.checked, grupos: e.target.checked ? [] : atual.grupos, alimentoIds: e.target.checked ? [] : atual.alimentoIds })}
            />
            <span>Conferi a anamnese: nenhuma restrição se aplica a este plano.</span>
          </label>

          <fieldset disabled={Boolean(atual.semRestricao)} className="pp-restricoes__grupos">
            <legend className="pp-rotulo">Grupos que não devem ser sugeridos</legend>
            <div className="pp-chips">
              {opcoesGrupo.map((grupo) => (
                <label key={grupo.id} className="pp-chip">
                  <input type="checkbox" checked={gruposSelecionados.has(grupo.id)} onChange={() => alternarGrupo(grupo.id)} />
                  <span>{grupo.rotulo}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="pp-campo">
            <span className="pp-rotulo">Observação da conferência</span>
            <textarea
              value={atual.observacao || ''}
              onChange={(e) => atualizar({ observacao: e.target.value })}
              rows={2}
              maxLength={1000}
              className="pp-controle pp-controle--area"
              placeholder="Ex.: intolerância à lactose relatada; leite e iogurte excluídos das sugestões."
            />
          </label>

          {itensEmConflito.length > 0 && (
            <div className="pp-conflitos">
              <p className="pp-conflitos__titulo">Alimentos e opções em conflito com a restrição confirmada — justifique ou remova:</p>
              <ul className="pp-conflitos__lista">
                {itensEmConflito.map((item) => (
                  <li key={item.id} className="pp-conflito">
                    <span className="pp-conflito__nome">{item.nome}</span>
                    <span className="pp-conflito__motivo">{item.motivo === 'alimento' ? 'alimento restrito' : 'grupo restrito'}</span>
                    <input
                      type="text"
                      value={atual.justificativas?.[item.id] || ''}
                      onChange={(e) => atualizar({ justificativas: { ...(atual.justificativas || {}), [item.id]: e.target.value } })}
                      aria-label={`Justificativa clínica para manter ${item.nome}`}
                      placeholder="Justificativa clínica (mínimo 5 caracteres)"
                      maxLength={500}
                      className="pp-controle pp-conflito__justificativa"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pendente && (
            <p className="pp-nota">Salvar o plano registra a conferência. Sem ela, o plano não pode ser enviado para revisão.</p>
          )}
        </div>
      )}
    </section>
  );
}
