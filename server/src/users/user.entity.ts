import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'legacy_uid', nullable: true })
  legacyUid?: string;

  @Index({ unique: true })
  @Column({ length: 190 })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ length: 80, default: 'aluno' })
  role!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 20, nullable: true })
  cpf?: string;

  @Column({ name: 'data_nascimento', type: 'date', nullable: true })
  dataNascimento?: string;

  @Column({ length: 40, nullable: true })
  matricula?: string;

  @Column({ length: 20, nullable: true })
  periodo?: string;

  @Index()
  @Column({ name: 'supervisor_id', type: 'uuid', nullable: true })
  supervisorId?: string;

  @Column({ name: 'supervisor_nome', length: 120, nullable: true })
  supervisorNome?: string;

  @Column({ length: 80, nullable: true })
  diretoria?: string;

  @Column({ length: 80, nullable: true })
  curso?: string;

  @Column({ name: 'projeto_id', type: 'uuid', nullable: true })
  projetoId?: string;

  @Column({ name: 'projeto_nome', length: 120, nullable: true })
  projetoNome?: string;

  @Column({ length: 20, nullable: true })
  telefone?: string;

  @Column({ length: 40, nullable: true })
  crn?: string;

  @Column({ name: 'conselho_tipo', length: 40, nullable: true })
  conselhoTipo?: string;

  @Column({ name: 'conselho_numero', length: 40, nullable: true })
  conselhoNumero?: string;

  @Column({ length: 80, nullable: true })
  departamento?: string;

  @Column({ name: 'nivel_acesso', length: 40, nullable: true })
  nivelAcesso?: string;

  @Column({ name: 'coord_atendimento', type: 'boolean', default: false })
  coordAtendimento?: boolean;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword?: boolean;

  @Column({ name: 'temp_password', type: 'varchar', length: 120, nullable: true })
  tempPassword?: string | null;

  @Column({ name: 'password_updated_at', type: 'timestamp', nullable: true })
  passwordUpdatedAt?: Date;

  @Column({ name: 'session_version', type: 'int', default: 1 })
  sessionVersion!: number;

  @Column({ default: 'ativo' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
