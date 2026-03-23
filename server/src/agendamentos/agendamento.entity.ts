import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('agendamentos')
export class Agendamento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string;

  @Column({ name: 'paciente_nome', length: 120, nullable: true })
  pacienteNome?: string;

  @Index()
  @Column({ name: 'aluno_id', type: 'uuid', nullable: true })
  alunoId?: string;

  @Column({ name: 'aluno_nome', length: 120, nullable: true })
  alunoNome?: string;

  @Column({ type: 'date', nullable: true })
  date?: string;

  @Column({ length: 10, nullable: true })
  time?: string;

  @Column({ name: 'appointment_type', length: 40, nullable: true })
  appointmentType?: string;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  evaluations!: string[];

  @Column({ length: 20, default: 'agendada' })
  status!: string;

  @Column({ name: 'origem_id', type: 'uuid', nullable: true })
  origemId?: string;

  @Column({ name: 'remarcada_em', type: 'timestamp', nullable: true })
  remarcadaEm?: Date;

  @Column({ name: 'remarcada_para', type: 'timestamp', nullable: true })
  remarcadaPara?: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ name: 'faltou_em', type: 'timestamp', nullable: true })
  faltouEm?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
