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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
