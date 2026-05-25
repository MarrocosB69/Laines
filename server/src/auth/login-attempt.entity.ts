import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('login_attempts')
@Index('UQ_login_attempts_email_ip', ['email', 'ip'], { unique: true })
@Index('IDX_login_attempts_blocked_until', ['blockedUntil'])
@Index('IDX_login_attempts_updated_at', ['updatedAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 190 })
  email!: string;

  @Column({ type: 'varchar', length: 64 })
  ip!: string;

  @Column({ type: 'integer', default: 0 })
  count!: number;

  @Column({ name: 'blocked_until', type: 'timestamp', nullable: true })
  blockedUntil!: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
