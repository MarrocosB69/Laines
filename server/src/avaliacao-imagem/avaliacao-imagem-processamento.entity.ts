import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('avaliacao_imagem_processamentos')
export class AvaliacaoImagemProcessamento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'avaliacao_id', type: 'uuid', unique: true })
  avaliacaoId!: string;

  @Column({ length: 40, default: 'aguardando_upload' })
  status!: string;

  @Column({ name: 'processor_job_id', type: 'varchar', length: 160, nullable: true })
  processorJobId?: string | null;

  @Column({ name: 'algoritmo_version', type: 'varchar', length: 80, nullable: true })
  algoritmoVersion?: string | null;

  @Column({ type: 'float', nullable: true })
  progresso?: number | null;

  @Column({ type: 'jsonb', nullable: true })
  resultados?: Record<string, unknown> | null;

  @Column({ name: 'erro_codigo', type: 'varchar', length: 80, nullable: true })
  erroCodigo?: string | null;

  @Column({ name: 'erro_mensagem', type: 'text', nullable: true })
  erroMensagem?: string | null;

  @Column({ name: 'concluido_em', type: 'timestamptz', nullable: true })
  concluidoEm?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
