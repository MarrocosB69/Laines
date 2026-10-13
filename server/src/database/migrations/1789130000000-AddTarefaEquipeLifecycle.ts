import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTarefaEquipeLifecycle1789130000000 implements MigrationInterface {
  name = 'AddTarefaEquipeLifecycle1789130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "due_date" date`);
    await queryRunner.query(`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "completed_by_id" uuid`);
    await queryRunner.query(`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "completed_by_name" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "completion_note" text`);
    await queryRunner.query(`ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tarefas_due_date" ON "tarefas" ("due_date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tarefas_archived_at" ON "tarefas" ("archived_at")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tarefa_eventos" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "action" varchar(40) NOT NULL,
        "actor_id" uuid,
        "actor_name" varchar(120),
        "team_role" varchar(60) NOT NULL,
        "details" jsonb,
        "occurred_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tarefa_eventos_task_id" ON "tarefa_eventos" ("task_id")`);
  }

  public async down(): Promise<void> {
    throw new Error('A reversao deste historico requer um plano de retencao dos registros de tarefas.');
  }
}
