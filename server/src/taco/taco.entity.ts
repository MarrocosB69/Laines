import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'taco' })
@Unique('UQ_taco_codigo', ['codigo'])
export class TacoFood {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'integer' })
  codigo!: number;

  @Index('IDX_taco_descricao')
  @Column({ type: 'varchar', length: 255 })
  descricao!: string;

  @Column({ type: 'varchar', length: 120 })
  grupo!: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  umidade!: string | null;

  @Column({ name: 'energia_kcal', type: 'numeric', precision: 8, scale: 2, nullable: true })
  energiaKcal!: string | null;

  @Column({ name: 'energia_kj', type: 'numeric', precision: 8, scale: 2, nullable: true })
  energiaKj!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  proteina!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  lipidios!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  colesterol!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  carboidrato!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  fibra!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  cinzas!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  calcio!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  magnesio!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  manganes!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  fosforo!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  ferro!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  sodio!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  potassio!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  cobre!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  zinco!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  retinol!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  tiamina!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  riboflavina!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  piridoxina!: string | null;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  niacina!: string | null;

  @Column({ name: 'vitamina_c', type: 'numeric', precision: 8, scale: 2, nullable: true })
  vitaminaC!: string | null;

  @Column({ name: 'vitamina_d', type: 'numeric', precision: 8, scale: 2, nullable: true })
  vitaminaD!: string | null;

  @Column({ name: 'vitamina_e', type: 'numeric', precision: 8, scale: 2, nullable: true })
  vitaminaE!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
