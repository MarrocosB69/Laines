import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export type ProjetoIdeiaInteresse = {
  id: string;
  nome: string;
  email?: string;
  role?: string;
  criadoEm: string;
};

@Entity('projeto_ideias')
export class ProjetoIdeia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  titulo!: string;

  @Column({ type: 'text', nullable: true })
  problema?: string;

  @Column({ type: 'text', nullable: true })
  justificativa?: string;

  @Column({ type: 'text', nullable: true })
  objetivo?: string;

  @Column({ length: 60, default: 'multidisciplinar' })
  area!: string;

  @Column({ name: 'palavras_chave', type: 'text', array: true, default: () => "'{}'" })
  palavrasChave!: string[];

  @Column({ length: 40, default: 'ideia' })
  status!: string;

  @Column({ name: 'responsavel_id', type: 'uuid', nullable: true })
  responsavelId?: string;

  @Column({ name: 'responsavel_nome', length: 120, nullable: true })
  responsavelNome?: string;

  @Column({ name: 'criado_por_id', type: 'uuid', nullable: true })
  criadoPorId?: string;

  @Column({ name: 'criado_por_nome', length: 120, nullable: true })
  criadoPorNome?: string;

  @Column({ type: 'text', nullable: true })
  observacoes?: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  interesses!: ProjetoIdeiaInteresse[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
