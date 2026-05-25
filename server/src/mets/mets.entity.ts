import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';

export enum MetsCategoria {
  FORCA = 'forca',
  ENDURANCE = 'endurance',
  COLETIVO = 'coletivo',
  AQUATICO = 'aquatico',
  COMBATE = 'combate',
  OUTRO = 'outro'
}

export enum MetsIntensidade {
  LEVE = 'leve',
  MODERADA = 'moderada',
  VIGOROSA = 'vigorosa',
  MAXIMA = 'maxima'
}

@Entity({ name: 'mets' })
@Unique('UQ_mets_modalidade_categoria_intensidade', ['modalidade', 'categoria', 'intensidade'])
export class Met {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  modalidade!: string;

  @Column({
    type: 'enum',
    enum: MetsCategoria
  })
  categoria!: MetsCategoria;

  @Column({
    type: 'enum',
    enum: MetsIntensidade
  })
  intensidade!: MetsIntensidade;

  @Column({
    name: 'met_value',
    type: 'numeric',
    precision: 3,
    scale: 1
  })
  metValue!: string;

  @Column({ type: 'varchar', length: 120, default: 'Ainsworth 2011' })
  fonte!: string;

  @Column({ name: 'codigo_ainsworth', type: 'varchar', length: 80, nullable: true })
  codigoAinsworth!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
