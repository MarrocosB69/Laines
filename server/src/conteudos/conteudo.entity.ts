import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('conteudos')
export class Conteudo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ length: 60 })
  categoria!: string;

  @Column({ length: 180 })
  titulo!: string;

  @Index()
  @Column({ length: 40, default: 'publicado' })
  status!: string;

  @Column({ type: 'date', nullable: true })
  data?: string;

  @Column({ length: 255, nullable: true })
  link?: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string;

  @Column({ length: 40, nullable: true })
  tipo?: string;

  @Column({ length: 20, nullable: true })
  publico?: string;

  @Column({ type: 'jsonb', nullable: true })
  cursos?: string[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  autores!: string[];

  @Column({ name: 'profissional_nome', length: 120, nullable: true })
  profissionalNome?: string;

  @Column({ name: 'profissional_credencial', length: 80, nullable: true })
  profissionalCredencial?: string;

  @Column({ name: 'equipe_organizacao', type: 'text', array: true, default: () => "'{}'" })
  equipeOrganizacao!: string[];

  @Column({ name: 'criado_por_id', type: 'uuid', nullable: true })
  criadoPorId?: string;

  @Column({ name: 'criado_por_nome', length: 120, nullable: true })
  criadoPorNome?: string;

  @Column({ name: 'aprovado_por_id', type: 'uuid', nullable: true })
  aprovadoPorId?: string;

  @Column({ name: 'aprovado_por_nome', length: 120, nullable: true })
  aprovadoPorNome?: string;

  @Column({ name: 'aprovado_em', type: 'timestamptz', nullable: true })
  aprovadoEm?: Date;

  @Column({ name: 'publicado_em', type: 'timestamptz', nullable: true })
  publicadoEm?: Date;

  @Column({ length: 512, nullable: true })
  arquivoPath?: string;

  @Column({ length: 255, nullable: true })
  arquivoNome?: string;

  @Column({ length: 100, nullable: true })
  arquivoMime?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
