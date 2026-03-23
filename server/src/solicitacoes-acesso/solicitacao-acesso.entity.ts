import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('solicitacoes_acesso')
export class SolicitacaoAcesso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ length: 120 })
  nome!: string;

  @Index()
  @Column({ length: 190 })
  email!: string;

  @Index()
  @Column({ length: 20 })
  cpf!: string;

  @Column({ name: 'data_nascimento', type: 'date', nullable: true })
  dataNascimento?: string;

  @Column({ length: 30, nullable: true })
  telefone?: string;

  @Column({ length: 80, nullable: true })
  area?: string;

  @Column({ name: 'cargo_solicitado', length: 40, nullable: true })
  cargoSolicitado?: string;

  @Column({ length: 40, nullable: true })
  matricula?: string;

  @Column({ name: 'conselho_tipo', length: 40, nullable: true })
  conselhoTipo?: string;

  @Column({ name: 'conselho_numero', length: 40, nullable: true })
  conselhoNumero?: string;

  @Column({ length: 120, nullable: true })
  instituicao?: string;

  @Column({ length: 80, nullable: true })
  diretoria?: string;

  @Column({ name: 'projeto_id', type: 'uuid', nullable: true })
  projetoId?: string;

  @Column({ name: 'projeto_nome', length: 120, nullable: true })
  projetoNome?: string;

  @Column({ type: 'text', nullable: true })
  justificativa?: string;

  @Column({ length: 20, default: 'pendente' })
  status!: string;

  @Column({ length: 30, default: 'landing' })
  origem!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
