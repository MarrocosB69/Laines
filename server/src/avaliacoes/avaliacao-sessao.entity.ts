import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('avaliacao_sessoes')
export class AvaliacaoSessao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId!: string;

  @Index()
  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Index()
  @Column({ name: 'projeto_id', type: 'uuid', nullable: true })
  projetoId?: string;

  @Column({ name: 'data_referencia', type: 'date' })
  dataReferencia!: string;

  @Column({ name: 'observacoes_gerais', type: 'text', nullable: true })
  observacoesGerais?: string;

  @Column({ length: 20, default: 'rascunho' })
  status!: string;

  @Column({ name: 'meta', type: 'jsonb', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

