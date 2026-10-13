import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('projeto_producoes')
export class ProjetoProducao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'projeto_id', type: 'uuid', nullable: true })
  projetoId?: string;

  @Column({ name: 'projeto_nome', length: 200, nullable: true })
  projetoNome?: string;

  @Column({ length: 200 })
  titulo!: string;

  @Column({ length: 60, default: 'documento' })
  tipo!: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  autores!: string[];

  @Column({ type: 'integer', nullable: true })
  ano?: number;

  @Column({ length: 60, nullable: true })
  area?: string;

  @Column({ length: 40, default: 'em_revisao' })
  status!: string;

  @Column({ length: 40, default: 'interno_laines' })
  visibilidade!: string;

  @Column({ name: 'link_externo', length: 500, nullable: true })
  linkExterno?: string;

  @Column({ type: 'jsonb', nullable: true })
  arquivo?: Record<string, unknown>;

  @Column({ name: 'criado_por_id', type: 'uuid', nullable: true })
  criadoPorId?: string;

  @Column({ name: 'criado_por_nome', length: 120, nullable: true })
  criadoPorNome?: string;

  @Column({ name: 'validado_por_id', type: 'uuid', nullable: true })
  validadoPorId?: string;

  @Column({ name: 'validado_por_nome', length: 120, nullable: true })
  validadoPorNome?: string;

  @Column({ name: 'validado_em', type: 'timestamptz', nullable: true })
  validadoEm?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
