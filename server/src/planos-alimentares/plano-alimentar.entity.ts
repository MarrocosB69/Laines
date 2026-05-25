import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum PlanoAlimentarStatus {
  RASCUNHO = 'rascunho',
  ATIVO = 'ativo',
  ENCERRADO = 'encerrado'
}

@Entity('planos_alimentares')
export class PlanoAlimentar {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @Index()
  @Column({ name: 'aluno_id', type: 'uuid', nullable: true })
  alunoId!: string | null;

  @Index()
  @Column({ name: 'projeto_id', type: 'uuid', nullable: true })
  projetoId!: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: PlanoAlimentarStatus,
    default: PlanoAlimentarStatus.RASCUNHO
  })
  status!: PlanoAlimentarStatus;

  @Column({ name: 'data_inicio', type: 'date' })
  dataInicio!: string;

  @Column({ name: 'data_fim', type: 'date', nullable: true })
  dataFim!: string | null;

  @Column({ name: 'tipo_dieta', type: 'varchar', length: 40, default: 'fixa' })
  tipoDieta!: string;

  @Column({ name: 'meta_calorica', type: 'int', nullable: true })
  metaCalorica!: number | null;

  @Column({ name: 'meta_cho_g', type: 'int', nullable: true })
  metaCHOg!: number | null;

  @Column({ name: 'meta_ptn_g', type: 'int', nullable: true })
  metaPTNg!: number | null;

  @Column({ name: 'meta_lip_g', type: 'int', nullable: true })
  metaLIPg!: number | null;

  @Column({ name: 'meta_fibras_g', type: 'int', nullable: true })
  metaFibrasg!: number | null;

  @Column({ name: 'fase_atual', type: 'varchar', length: 80, nullable: true })
  faseAtual!: string | null;

  @Column({ name: 'validado_antidoping', type: 'boolean', default: false })
  validadoAntidoping!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  dados!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  resultados!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp with time zone', nullable: true })
  deletedAt!: Date | null;
}
