import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPlanosAlimentares1773123000000 implements MigrationInterface {
  name = 'DropPlanosAlimentares1773123000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('planos_alimentares');
    if (!hasTable) {
      return;
    }

    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_2f89f0543d4ac2f567049bfeec"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_4b5b9ab4f0e64ea8f4596a0309"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_6542be58f1e8e8aa3a8f6ceec8"');
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_2ec8674c7f28670b325548f0c6"');
    await queryRunner.query('DROP TABLE IF EXISTS "planos_alimentares"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('planos_alimentares');
    if (hasTable) {
      return;
    }

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "planos_alimentares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paciente_id" uuid NOT NULL,
        "paciente_nome" character varying(120),
        "atleta_user_id" uuid,
        "aluno_id" uuid,
        "aluno_nome" character varying(120),
        "objetivo" character varying(40),
        "start_date" date,
        "review_date" date,
        "plan_data" jsonb NOT NULL DEFAULT '{}',
        "prescription_text" text,
        "status" character varying(20) NOT NULL DEFAULT 'ativo',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_561128b35f5ee605a0ef209622c" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_2ec8674c7f28670b325548f0c6" ON "planos_alimentares" ("paciente_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_6542be58f1e8e8aa3a8f6ceec8" ON "planos_alimentares" ("atleta_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_4b5b9ab4f0e64ea8f4596a0309" ON "planos_alimentares" ("aluno_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_2f89f0543d4ac2f567049bfeec" ON "planos_alimentares" ("status")',
    );
  }
}
