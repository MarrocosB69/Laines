import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index
} from 'typeorm';

@Entity('pacientes')
export class Paciente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  prontuario!: string;

  @Column({ length: 120 })
  nome!: string;

  @Index()
  @Column({ length: 20 })
  cpf!: string;

  @Column({ name: 'data_nascimento', type: 'date', nullable: true })
  dataNascimento?: string;

  @Column({ length: 20, default: 'nao_informado' })
  genero!: string;

  // Identidade de genero e sexo biologico sao campos distintos: as formulas de
  // composicao corporal e o questionario de disponibilidade energetica usam o
  // segundo, nunca o primeiro.
  @Column({ name: 'sexo_biologico', length: 20, nullable: true })
  sexoBiologico?: string;

  @Column({ length: 20, nullable: true })
  telefone?: string;

  @Column({ length: 190, nullable: true })
  email?: string;

  @Column({ length: 120, nullable: true })
  endereco?: string;

  @Column({ length: 80, nullable: true })
  bairro?: string;

  @Column({ length: 80, nullable: true })
  cidade?: string;

  @Column({ length: 10, nullable: true })
  estado?: string;

  @Column({ length: 40, default: 'Lista de Espera' })
  status!: string;

  @Column({ name: 'modalidade_principal', length: 120, nullable: true })
  modalidadePrincipal?: string;

  @Column({ name: 'tempo_pratica', length: 60, nullable: true })
  tempoPratica?: string;

  @Column({ name: 'frequencia_semanal', type: 'int', nullable: true })
  frequenciaSemanal?: number;

  @Column({ name: 'duracao_sessao', type: 'int', nullable: true })
  duracaoSessao?: number;

  @Column({ name: 'outras_modalidades', type: 'text', nullable: true })
  outrasModalidades?: string;

  @Column({ name: 'tipo_treino', length: 20, default: 'misto' })
  tipoTreino!: string;

  @Column({ length: 20, default: 'moderada' })
  intensidade!: string;

  @Column({ length: 20, default: 'performance' })
  objetivo!: string;

  @Column({ type: 'text', nullable: true })
  observacoes?: string;

  @Column({ name: 'historico_saude', type: 'text', nullable: true })
  historicoSaude?: string;

  @Column({ name: 'comorbidades_pessoais', type: 'jsonb', nullable: true })
  comorbidadesPessoais?: string[];

  // Formato atual: { pai: string[], mae: string[] }.
  // Registros anteriores a agosto/2026 gravaram string[] — leitores normalizam.
  @Column({ name: 'comorbidades_familiares', type: 'jsonb', nullable: true })
  comorbidadesFamiliares?: Record<string, unknown> | string[];

  @Column({ name: 'confirmacao_atleta', type: 'jsonb', nullable: true })
  confirmacaoAtleta?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  anexos?: Array<Record<string, unknown>>;

  @Column({ name: 'mensagens_professor', type: 'jsonb', nullable: true })
  mensagensProfessor?: Array<Record<string, unknown>>;

  @Column({ name: 'projeto_id', type: 'uuid', nullable: true })
  projetoId?: string;

  @Column({ name: 'projeto_nome', length: 120, nullable: true })
  projetoNome?: string;

  @Index()
  @Column({ name: 'aluno_responsavel_id', type: 'uuid', nullable: true })
  alunoResponsavelId?: string;

  @Column({ name: 'aluno_responsavel_nome', length: 120, nullable: true })
  alunoResponsavelNome?: string;

  @Index()
  @Column({ name: 'professor_supervisor_id', type: 'uuid', nullable: true })
  professorSupervisorId?: string;

  @Column({ name: 'professor_supervisor_nome', length: 120, nullable: true })
  professorSupervisorNome?: string;

  @Column({ name: 'equipe_tecnica_ids', type: 'uuid', array: true, default: () => "'{}'" })
  equipeTecnicaIds!: string[];

  @Column({ name: 'equipe_multi_ids', type: 'uuid', array: true, default: () => "'{}'" })
  equipeMultiIds!: string[];

  @Column({ name: 'equipe_multiprofissional', type: 'jsonb', nullable: true })
  equipeProfissional?: Array<{
    userId: string;
    userName: string;
    area: string;
    papel: string;
  }>;

  @Column({ name: 'atleta_user_id', type: 'uuid', nullable: true })
  atletaUserId?: string;

  @Column({ name: 'consentimento_pesquisa', length: 20, default: 'pendente' })
  consentimentoPesquisa!: string;

  @Column({ name: 'consentimento_data', type: 'date', nullable: true })
  consentimentoData?: string;

  @Column({ name: 'consentimento_versao', length: 40, nullable: true })
  consentimentoVersao?: string;

  @Column({ type: 'int', default: 0 })
  faltas!: number;

  @Column({ name: 'data_cadastro', type: 'timestamp', nullable: true })
  dataCadastro?: Date;

  @Column({ name: 'linked_at', type: 'timestamp', nullable: true })
  linkedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
