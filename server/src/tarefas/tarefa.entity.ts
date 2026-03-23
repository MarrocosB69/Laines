import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('tarefas')
export class Tarefa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 180 })
  title!: string;

  @Column({ length: 20, default: 'pendente' })
  status!: string;

  @Index()
  @Column({ name: 'assigned_role', length: 60, default: 'todos' })
  assignedRole!: string;

  @Index()
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'created_by_name', length: 120, nullable: true })
  createdByName?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
