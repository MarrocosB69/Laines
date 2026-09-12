import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import { isValidCpf } from '../common/cpf';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { InscricaoPublicaDto } from './dto/inscricao-publica.dto';
import {
  compactJsonRecord,
  mergeAthleteConfirmation
} from '../pacientes/athlete-cadastro.utils';

type RateLimitState = { count: number; windowStartedAt: number };

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;
const CONSENTIMENTO_VERSAO = 'v1.0-2025';

type FamiliaresPorParentesco = {
  pai: string[];
  mae: string[];
  legado?: string[];
};

@Injectable()
export class PublicService {
  private readonly inscricaoAttempts = new Map<string, RateLimitState>();
  private statsCache: { data: object; cachedAt: number } | null = null;
  private readonly STATS_TTL_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Paciente) private readonly pacientesRepo: Repository<Paciente>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Avaliacao) private readonly avaliacoesRepo: Repository<Avaliacao>
  ) {}

  async getPublicStats() {
    const now = Date.now();
    if (this.statsCache && now - this.statsCache.cachedAt < this.STATS_TTL_MS) {
      return this.statsCache.data;
    }

    const [atletas, avaliacoes, membros] = await Promise.all([
      this.pacientesRepo.createQueryBuilder('p')
        .where('p.status = :status', { status: 'ativo' })
        .andWhere('p.deletedAt IS NULL')
        .getCount(),
      this.avaliacoesRepo.createQueryBuilder('a')
        .where('a.status = :status', { status: 'finalizada' })
        .andWhere('a.deletedAt IS NULL')
        .getCount(),
      this.usersRepo.createQueryBuilder('u')
        .where('u.status = :status', { status: 'ativo' })
        .andWhere('u.deletedAt IS NULL')
        .getCount()
    ]);

    const data = { atletas, avaliacoes, membros };
    this.statsCache = { data, cachedAt: now };
    return data;
  }

  private normalizeCpf(cpf: string) {
    return String(cpf || '').replace(/\D/g, '');
  }

  // Historico familiar passou a ser estruturado por parentesco.
  // Aceita tanto o formato novo { pai, mae } quanto o legado string[].
  private static normalizeFamiliares(value: unknown): FamiliaresPorParentesco | null {
    if (!value) return null;
    if (Array.isArray(value)) {
      const legado = value.map((item) => String(item || '').trim()).filter(Boolean);
      return legado.length ? { pai: [], mae: [], legado } : null;
    }
    if (typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const pick = (key: string) => (
      Array.isArray(record[key])
        ? (record[key] as unknown[]).map((item) => String(item || '').trim()).filter(Boolean)
        : []
    );
    const pai = pick('pai');
    const mae = pick('mae');
    return (pai.length || mae.length) ? { pai, mae } : null;
  }

  private buildDadosInscricao(dto: InscricaoPublicaDto) {
    return compactJsonRecord({
      nome: String(dto.nome || '').trim() || undefined,
      dataNascimento: dto.dataNascimento,
      genero: dto.genero,
      sexoBiologico: dto.sexoBiologico,
      telefone: dto.telefone,
      email: dto.email ? String(dto.email).trim().toLowerCase() : undefined,
      profissao: dto.profissao,
      rendaMensal: dto.rendaMensal,
      escolaridade: dto.escolaridade,
      endereco: dto.endereco,
      bairro: dto.bairro,
      cidade: dto.cidade,
      estado: dto.estado,
      nomeResponsavel: dto.nomeResponsavel,
      cpfResponsavel: dto.cpfResponsavel ? this.normalizeCpf(dto.cpfResponsavel) : undefined,
      modalidadePrincipal: dto.modalidadePrincipal,
      tempoPratica: dto.tempoPratica,
      frequenciaSemanal: dto.frequenciaSemanal,
      duracaoSessao: dto.duracaoSessao,
      outrasModalidades: dto.outrasModalidades,
      tipoTreino: dto.tipoTreino,
      intensidade: dto.intensidade,
      objetivo: dto.objetivo,
      comorbidadesPessoais: dto.comorbidadesPessoais,
      comorbidadesFamiliares: PublicService.normalizeFamiliares(dto.comorbidadesFamiliares) || undefined,
      historicoSaude: dto.historicoSaude,
      observacoes: dto.observacoes,
      hidratacao: dto.hidratacao,
      bristol: dto.bristol,
      urinaPrimeira: dto.urinaPrimeira,
      urinaUltima: dto.urinaUltima,
      suplementoNoDia: dto.suplementoNoDia,
      sinaisClinicos: dto.sinaisClinicos,
      relatoNegativo: dto.relatoNegativo,
      redsInstrumento: dto.redsInstrumento,
      redsRespostas: dto.redsRespostas,
      redsScore: dto.redsScore,
      examesRealizados: dto.examesRealizados,
      avaliacaoSolicitada: dto.avaliacaoSolicitada,
      ebia: dto.ebia,
      comoSoube: dto.comoSoube
    });
  }

  private checkRateLimit(ip: string) {
    const now = Date.now();
    const state = this.inscricaoAttempts.get(ip);
    if (state) {
      if (now - state.windowStartedAt < RATE_WINDOW_MS) {
        if (state.count >= RATE_MAX) {
          throw new HttpException(
            'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
        state.count++;
      } else {
        state.count = 1;
        state.windowStartedAt = now;
      }
    } else {
      this.inscricaoAttempts.set(ip, { count: 1, windowStartedAt: now });
    }
  }

  private async generateProntuarioNumber(repo: Repository<Paciente>): Promise<string> {
    const result = await repo.query(
      `SELECT nextval('pacientes_prontuario_seq')::bigint AS value`
    );
    const value = Number(result?.[0]?.value || 0);
    return `PRT-${String(value).padStart(6, '0')}`;
  }

  async criarInscricao(dto: InscricaoPublicaDto, ip: string) {
    this.checkRateLimit(ip);

    if (!dto.consentimentoAceito) {
      throw new BadRequestException('O Termo de Compromisso deve ser aceito para continuar.');
    }

    const cpf = this.normalizeCpf(dto.cpf);
    if (!cpf || cpf.length !== 11) {
      throw new BadRequestException('CPF inválido. Informe os 11 dígitos.');
    }
    if (!isValidCpf(cpf)) {
      throw new BadRequestException('CPF inválido. Verifique os dígitos informados.');
    }

    const normalizedEmail = dto.email ? String(dto.email).trim().toLowerCase() : '';
    return this.pacientesRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Paciente);
      // Transaction-scoped PostgreSQL locks also serialize concurrent requests on
      // different application instances. Stable order avoids CPF/email deadlocks.
      const keys = [`inscricao:cpf:${cpf}`, ...(normalizedEmail ? [`inscricao:email:${normalizedEmail}`] : [])].sort();
      for (const key of keys) {
        await repo.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
      }
      const existing = await repo.findOne({
        where: [{ cpf }, ...(normalizedEmail ? [{ email: normalizedEmail }] : [])],
        withDeleted: true
      });
      const acknowledgement = {
        message: 'Solicitação recebida. A equipe LAINES seguirá o atendimento pelos contatos do cadastro. Para corrigir informações, entre em contato com a equipe.'
      };
      // Public knowledge of a CPF/email never grants permission to edit an
      // existing record, restore a deleted record, or read its identifier.
      if (existing) return acknowledgement;

      const hoje = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      const dadosInscricao = this.buildDadosInscricao(dto);
      const consentimento = {
        aceito: true,
        versao: CONSENTIMENTO_VERSAO,
        data: hoje
      };
      const incomingConfirmation = {
        origem: 'inscricao_publica',
        inscritoEm: now,
        consentimento,
        inscricaoPublica: {
          atualizadoEm: now,
          dados: dadosInscricao
        },
        dados: dadosInscricao
      };

      const prontuario = await this.generateProntuarioNumber(repo);

      const paciente = repo.create({
        prontuario,
        nome: String(dto.nome || '').trim(),
        cpf,
        dataNascimento: dto.dataNascimento,
        genero: dto.genero || 'nao_informado',
        sexoBiologico: dto.sexoBiologico,
        telefone: dto.telefone,
        email: normalizedEmail || undefined,
        endereco: dto.endereco,
        bairro: dto.bairro,
        cidade: dto.cidade,
        estado: dto.estado,
        status: 'Triagem Publica',
        modalidadePrincipal: dto.modalidadePrincipal,
        tempoPratica: dto.tempoPratica,
        frequenciaSemanal: dto.frequenciaSemanal,
        duracaoSessao: dto.duracaoSessao,
        outrasModalidades: dto.outrasModalidades,
        tipoTreino: dto.tipoTreino || 'misto',
        intensidade: dto.intensidade || 'moderada',
        objetivo: dto.objetivo || 'performance',
        historicoSaude: dto.historicoSaude,
        comorbidadesPessoais: dto.comorbidadesPessoais,
        comorbidadesFamiliares: PublicService.normalizeFamiliares(dto.comorbidadesFamiliares) || undefined,
        observacoes: dto.observacoes,
        consentimentoPesquisa: 'aceito',
        consentimentoData: hoje,
        consentimentoVersao: CONSENTIMENTO_VERSAO,
        dataCadastro: new Date(),
        equipeTecnicaIds: [],
        equipeMultiIds: [],
        faltas: 0,
        confirmacaoAtleta: mergeAthleteConfirmation(
          null,
          incomingConfirmation,
          {
            origem: 'inscricao_publica',
            cadastroStatus: 'triagem_publica',
            timestamp: now
          }
        )
      });

      await repo.save(paciente);
      return acknowledgement;
    });
  }
}
