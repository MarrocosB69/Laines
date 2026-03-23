import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 60 })
  action!: string;

  @Column({ length: 60 })
  entity!: string;

  @Column({ name: 'entity_id', length: 80, nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  actor?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
