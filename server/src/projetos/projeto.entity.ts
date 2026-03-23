import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('projetos')
export class Projeto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  nome!: string;

  @Column({ length: 40, default: 'nutricao' })
  area!: string;

  @Column({ length: 40, default: 'planejamento' })
  status!: string;

  @Column({ length: 120, nullable: true })
  coordenador?: string;

  @Column({ name: 'coordenador_id', type: 'uuid', nullable: true })
  coordenadorId?: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  equipe!: string[];

  @Column({ name: 'alunos_ids', type: 'uuid', array: true, default: () => "'{}'" })
  alunosIds!: string[];

  @Column({ name: 'alunos_nomes', type: 'text', array: true, default: () => "'{}'" })
  alunosNomes!: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
