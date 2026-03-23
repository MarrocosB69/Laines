import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1773132000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1773132000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_pacientes_aluno_created_at" ON "pacientes" ("aluno_responsavel_id", "created_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_pacientes_prof_created_at" ON "pacientes" ("professor_supervisor_id", "created_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_pacientes_atleta_created_at" ON "pacientes" ("atleta_user_id", "created_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacoes_aluno_created_at" ON "avaliacoes" ("aluno_id", "created_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacoes_paciente_created_at" ON "avaliacoes" ("paciente_id", "created_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_agendamentos_aluno_sched_at" ON "agendamentos" ("aluno_id", "scheduled_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_agendamentos_paciente_sched_at" ON "agendamentos" ("paciente_id", "scheduled_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_agendamentos_status_sched_at" ON "agendamentos" ("status", "scheduled_at" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_agendamentos_status_sched_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_agendamentos_paciente_sched_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_agendamentos_aluno_sched_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_avaliacoes_paciente_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_avaliacoes_aluno_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_pacientes_atleta_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_pacientes_prof_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_pacientes_aluno_created_at"');
  }
}
