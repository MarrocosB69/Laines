import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn
} from 'typeorm';

@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_user_id', ['userId'])
@Index('IDX_refresh_tokens_family_id', ['familyId'])
@Index('IDX_refresh_tokens_expires_at', ['expiresAt'])
@Index('UQ_refresh_tokens_token_hash', ['tokenHash'], { unique: true })
export class RefreshToken {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash!: string;

  @Column({ name: 'rotation_counter', type: 'integer', default: 1 })
  rotationCounter!: number;

  @Column({ name: 'session_version', type: 'integer', default: 1 })
  sessionVersion!: number;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'replaced_by_token_id', type: 'uuid', nullable: true })
  replacedByTokenId?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
