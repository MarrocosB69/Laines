import React, { useMemo } from 'react';
import { Activity, Dumbbell, Users } from 'lucide-react';
import {
  PainelVisaoGeral,
  PainelCabecalho,
  PainelIndicadores,
  PainelSecao,
  PainelLista,
  saudacaoPorHorario
} from '../../components/painel/Painel';

// Visão geral da equipe técnica (docs/implementacao/visao-geral-v2, decisão 2).
// Invariante 2 — nenhum dado a mais: só usa a lista de /pacientes que o
// TeamPortal já carrega (nome, modalidadePrincipal, status). Avaliações e
// consultas existem apenas por atleta selecionado; não há dado agregado, então
// "O que precisa de você" e "Agenda" orientam em vez de inventar números.

const LIMITE_ATLETAS = 6;

// Mesmo critério do ponto de status da lista em TeamPortal.jsx.
const isAtivo = (patient) => String(patient?.status || '').toLowerCase() === 'ativo';

const TeamVisaoGeral = ({
  nome,
  papel,
  patients = [],
  carregando = false,
  erro = null,
  onTentarNovamente,
  onAbrirAtletas,
  onSelecionarAtleta
}) => {
  const resumo = useMemo(() => {
    const modalidades = new Set();
    let semModalidade = 0;
    patients.forEach((patient) => {
      const modalidade = String(patient?.modalidadePrincipal || '').trim().toLowerCase();
      if (modalidade) modalidades.add(modalidade);
      else semModalidade += 1;
    });
    return {
      total: patients.length,
      ativos: patients.filter(isAtivo).length,
      modalidades: modalidades.size,
      semModalidade
    };
  }, [patients]);

  // Ausência é nulo: com erro, ou sem nenhum atleta, os cards dizem o motivo.
  const semAtletas = !erro && resumo.total === 0;
  const indicadores = [
    {
      id: 'atletas',
      rotulo: 'Atletas vinculados',
      valor: erro ? null : resumo.total,
      detalhe: erro ? 'Erro ao carregar' : semAtletas ? 'Nenhum atleta vinculado' : undefined,
      icone: Users,
      tom: 'neutro',
      onClick: onAbrirAtletas
    },
    {
      id: 'ativos',
      rotulo: 'Atletas ativos',
      valor: erro || semAtletas ? null : resumo.ativos,
      detalhe: erro
        ? 'Erro ao carregar'
        : semAtletas ? 'Sem atletas vinculados' : `${resumo.total - resumo.ativos} com outro status`,
      icone: Activity,
      tom: 'neutro'
    },
    {
      id: 'modalidades',
      rotulo: 'Modalidades',
      valor: erro || semAtletas ? null : resumo.modalidades,
      detalhe: erro
        ? 'Erro ao carregar'
        : semAtletas
          ? 'Sem atletas vinculados'
          : resumo.semModalidade > 0 ? `${resumo.semModalidade} sem modalidade informada` : undefined,
      icone: Dumbbell,
      tom: 'neutro'
    }
  ];

  const estadoBase = carregando ? 'carregando' : erro ? 'erro' : null;
  const erroSecao = {
    mensagem: 'Não foi possível carregar os atletas da equipe.',
    onTentarNovamente
  };
  const atalhoAtletas = { rotulo: 'Abrir Meus Atletas', onClick: onAbrirAtletas };

  // Sem atleta vinculado não há o que selecionar: a orientação muda.
  const vazioPorAtleta = (titulo) => (semAtletas
    ? { titulo: 'Nenhum atleta vinculado.' }
    : { titulo, descricao: 'Selecione um atleta em Meus Atletas para ver avaliações e consultas.' });

  const itensAtletas = patients.slice(0, LIMITE_ATLETAS).map((patient) => ({
    id: patient.id,
    titulo: patient.nome || 'Atleta',
    subtitulo: patient.modalidadePrincipal || 'Modalidade não informada',
    meta: `Status: ${patient.status || 'não informado'}`,
    tom: isAtivo(patient) ? 'positivo' : 'neutro',
    onClick: onSelecionarAtleta ? () => onSelecionarAtleta(patient) : undefined
  }));

  return (
    <PainelVisaoGeral>
      <PainelCabecalho
        saudacao={saudacaoPorHorario(new Date())}
        nome={nome}
        papel={papel}
        data={new Date()}
      />

      <PainelIndicadores rotulo="Indicadores" carregando={carregando} itens={indicadores} />

      <PainelSecao
        id="precisa-de-voce"
        titulo="O que precisa de você"
        acao={semAtletas ? undefined : atalhoAtletas}
        estado={estadoBase || 'vazio'}
        vazio={vazioPorAtleta('Pendências são exibidas por atleta')}
        erro={erroSecao}
      />

      <PainelSecao
        id="agenda"
        titulo="Agenda"
        acao={semAtletas ? undefined : atalhoAtletas}
        estado={estadoBase || 'vazio'}
        vazio={vazioPorAtleta('Consultas são exibidas por atleta')}
        erro={erroSecao}
      />

      <PainelSecao
        id="meus-atletas"
        titulo="Meus Atletas"
        descricao={resumo.total > LIMITE_ATLETAS ? `Mostrando ${LIMITE_ATLETAS} de ${resumo.total}.` : undefined}
        acao={resumo.total > 0 ? atalhoAtletas : undefined}
        estado={estadoBase || (resumo.total === 0 ? 'vazio' : 'pronto')}
        vazio={{ titulo: 'Nenhum atleta vinculado.' }}
        erro={erroSecao}
      >
        <PainelLista rotuloAcessivel="Atletas vinculados" itens={itensAtletas} />
      </PainelSecao>
    </PainelVisaoGeral>
  );
};

export default TeamVisaoGeral;
