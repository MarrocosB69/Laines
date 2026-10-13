import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tarefa_eventos')
export class TarefaEvento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_tarefa_eventos_task_id')
  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @Column({ length: 40 })
  action!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 120, nullable: true })
  actorName?: string | null;

  @Column({ name: 'team_role', length: 60 })
  teamRole!: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
