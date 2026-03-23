import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('avaliacoes')
export class Avaliacao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
