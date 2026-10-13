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

  @Index('IDX_tarefas_due_date')
  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'completed_by_id', type: 'uuid', nullable: true })
  completedById?: string | null;

  @Column({ name: 'completed_by_name', type: 'varchar', length: 120, nullable: true })
  completedByName?: string | null;

  @Column({ name: 'completion_note', type: 'text', nullable: true })
  completionNote?: string | null;

  @Index('IDX_tarefas_archived_at')
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
