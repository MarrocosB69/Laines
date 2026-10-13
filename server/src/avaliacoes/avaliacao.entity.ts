import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index
} from 'typeorm';

@Entity('avaliacoes')
@Index('idx_avaliacoes_paciente_tipo_status', ['pacienteId', 'tipo', 'status'])
@Index('idx_avaliacoes_paciente_status', ['pacienteId', 'status'])
@Index('idx_avaliacoes_projeto_status', ['projetoId', 'status'])
export class Avaliacao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sessao_id', type: 'uuid', nullable: true })
  sessaoId?: string;

  @Index()
  @Column({ length: 60 })
  tipo!: string;

  @Index()
  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @Index()
  @Column({ name: 'projeto_id', type: 'uuid', nullable: true })
  projetoId?: string;

  @Column({ name: 'projeto_nome', length: 120, nullable: true })
  projetoNome?: string;

  @Index()
  @Column({ name: 'aluno_id', type: 'uuid', nullable: true })
  alunoId?: string;

  @Column({ length: 30, default: 'rascunho' })
  status!: string;

  @Column({ name: 'data_avaliacao', type: 'date', nullable: true })
  data?: string;

  @Column({ type: 'jsonb', nullable: true })
  dados?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  resultados?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  registros?: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown>;

  @Column({ name: 'auto_save', type: 'boolean', default: false })
  autoSave!: boolean;

  @Column({ name: 'schema_version', type: 'smallint', default: 1 })
  schemaVersion!: number;

  @Column({ name: 'formula_id', length: 60, nullable: true })
  formulaId?: string;

  @Column({ name: 'formula_version', length: 30, nullable: true })
  formulaVersion?: string;

  @Column({ name: 'source_system', length: 40, nullable: true })
  sourceSystem?: string;

  @Column({ name: 'source_ref', length: 120, nullable: true })
  sourceRef?: string;

  @Column({ name: 'measured_at', type: 'timestamptz', nullable: true })
  measuredAt?: Date;

  @Column({ name: 'total_diario', type: 'float', nullable: true })
  totalDiario?: number;

  @Column({ type: 'jsonb', nullable: true })
  percentuais?: Record<string, unknown>;

  @Column({ length: 60, nullable: true })
  classificacao?: string;

  @Column({ name: 'classificacao_label', length: 120, nullable: true })
  classificacaoLabel?: string;

  @Column({ name: 'pontuacao_ebia', type: 'int', nullable: true })
  pontuacaoEBIA?: number;

  @Column({ name: 'revisado_em', type: 'timestamp', nullable: true })
  revisadoEm?: string | null;

  @Column({ name: 'revisado_por_id', type: 'uuid', nullable: true })
  revisadoPorId?: string | null;

  @Column({ name: 'revisado_por_nome', type: 'varchar', length: 120, nullable: true })
  revisadoPorNome?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
