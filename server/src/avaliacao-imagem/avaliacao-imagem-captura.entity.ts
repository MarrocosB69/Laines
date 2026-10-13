import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('avaliacao_imagem_capturas')
@Index('UQ_avaliacao_imagem_captura_vista', ['avaliacaoId', 'vista'], { unique: true })
export class AvaliacaoImagemCaptura {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'avaliacao_id', type: 'uuid' })
  avaliacaoId!: string;

  @Column({ length: 40 })
  vista!: string;

  @Column({ name: 'object_key', length: 500, unique: true })
  objectKey!: string;

  @Column({ name: 'mime_type', length: 100, default: 'image/jpeg' })
  mimeType!: string;

  @Column({ name: 'upload_status', length: 40, default: 'pendente' })
  uploadStatus!: string;

  @Column({ name: 'tamanho_bytes', type: 'bigint', nullable: true })
  tamanhoBytes?: string | null;

  @Column({ name: 'sha256', type: 'varchar', length: 64, nullable: true })
  sha256?: string | null;

  @Column({ name: 'confirmado_em', type: 'timestamptz', nullable: true })
  confirmadoEm?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
