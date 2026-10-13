import React, { useState, useEffect, useMemo } from 'react';
import { formatCpf } from '../../../utils/formatters';
import { FieldGroup } from './campos';
import {
  GENEROS,
  ESCOLARIDADES,
  RENDAS,
  municipiosCache,
  loadMunicipios,
  SEXO_BIOLOGICO
} from './constantes';

export default function Step2DadosPessoais({ form, setForm, errors }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const isMenor = form.tipoParticipante === 'menor';
  const [localidades, setLocalidades] = useState(municipiosCache);

  useEffect(() => {
    let ativo = true;
    loadMunicipios()
      .then((data) => { if (ativo) setLocalidades(data); })
      .catch(() => { /* sem dataset o campo permanece desabilitado */ });
    return () => { ativo = false; };
  }, []);

  const estados = localidades?.estados || [];
  const cidades = useMemo(
    () => (form.estado && localidades ? (localidades.municipios[form.estado] || []) : []),
    [form.estado, localidades]
  );

  return (
    <div className="ip-step">
      <h2 className="ip-step-title">Dados Pessoais</h2>
      <p className="ip-step-subtitle">Preencha suas informações de identificação e contato.</p>

      <div className="ip-grid-2">
        <FieldGroup label="Nome completo" required error={errors.nome}>
          <input
            className="ip-input"
            value={form.nome}
            onChange={set('nome')}
            placeholder="Seu nome completo"
            maxLength={120}
          />
        </FieldGroup>

        <FieldGroup label="CPF" required error={errors.cpf}>
          <input
            className="ip-input"
            value={form.cpf}
            onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))}
            placeholder="000.000.000-00"
            maxLength={14}
            inputMode="numeric"
          />
        </FieldGroup>

        <FieldGroup label="Data de nascimento" required error={errors.dataNascimento}>
          <input
            className="ip-input"
            type="date"
            value={form.dataNascimento}
            onChange={set('dataNascimento')}
            max={new Date().toISOString().slice(0, 10)}
          />
        </FieldGroup>

        <FieldGroup label="Telefone / WhatsApp" required error={errors.telefone}>
          <input
            className="ip-input"
            value={form.telefone}
            onChange={set('telefone')}
            placeholder="(84) 99999-9999"
            maxLength={20}
            inputMode="tel"
          />
        </FieldGroup>

        <FieldGroup label="E-mail" error={errors.email}>
          <input
            className="ip-input"
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="seu@email.com"
            maxLength={190}
          />
        </FieldGroup>

        <FieldGroup label="Profissão">
          <input
            className="ip-input"
            value={form.profissao}
            onChange={set('profissao')}
            placeholder="Ex: estudante, professor, atleta..."
            maxLength={120}
          />
        </FieldGroup>

        <FieldGroup label="Gênero">
          <select className="ip-input" value={form.genero} onChange={set('genero')}>
            <option value="">Selecione...</option>
            {GENEROS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="Sexo biológico">
          <select className="ip-input" value={form.sexoBiologico} onChange={set('sexoBiologico')}>
            <option value="">Selecione...</option>
            {SEXO_BIOLOGICO.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </FieldGroup>

        <p className="ip-help-text ip-span-2">
          O sexo biológico é usado apenas nos cálculos de composição corporal e no
          questionário de disponibilidade energética. Ele não substitui o gênero.
        </p>

        <FieldGroup label="Escolaridade">
          <select className="ip-input" value={form.escolaridade} onChange={set('escolaridade')}>
            <option value="">Selecione...</option>
            {ESCOLARIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </FieldGroup>

        <FieldGroup label="Renda familiar mensal">
          <select className="ip-input" value={form.rendaMensal} onChange={set('rendaMensal')}>
            <option value="">Selecione...</option>
            {RENDAS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </FieldGroup>

        <div className="ip-grid-uf ip-span-2">
          <FieldGroup label="Estado">
            <select
              className="ip-input"
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value, cidade: '' }))}
            >
              <option value="">UF</option>
              {estados.map(([sigla, nome]) => (
                <option key={sigla} value={sigla}>{sigla} — {nome}</option>
              ))}
            </select>
          </FieldGroup>
          <FieldGroup label="Cidade">
            <select
              className="ip-input"
              value={form.cidade}
              onChange={set('cidade')}
              disabled={!form.estado || !cidades.length}
            >
              <option value="">
                {form.estado ? (cidades.length ? 'Selecione a cidade' : 'Carregando...') : 'Escolha o estado primeiro'}
              </option>
              {cidades.map((cidade) => <option key={cidade} value={cidade}>{cidade}</option>)}
            </select>
          </FieldGroup>
        </div>
      </div>

      {isMenor && (
        <div className="ip-panel">
          <p className="ip-panel-title">Dados do responsável legal</p>
          <div className="ip-grid-2">
            <FieldGroup label="Nome do responsável" required error={errors.nomeResponsavel}>
              <input
                className="ip-input"
                value={form.nomeResponsavel}
                onChange={set('nomeResponsavel')}
                placeholder="Nome completo do responsável"
                maxLength={120}
              />
            </FieldGroup>
            <FieldGroup label="CPF do responsável" required error={errors.cpfResponsavel}>
              <input
                className="ip-input"
                value={form.cpfResponsavel}
                onChange={(e) => setForm((f) => ({ ...f, cpfResponsavel: formatCpf(e.target.value) }))}
                placeholder="000.000.000-00"
                maxLength={14}
                inputMode="numeric"
              />
            </FieldGroup>
          </div>
        </div>
      )}
    </div>
  );
}
