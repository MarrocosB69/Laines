import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPacienteProntuario1773702000000 implements MigrationInterface {
  name = 'AddPacienteProntuario1773702000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS "pacientes_prontuario_seq"
      START WITH 1000
      INCREMENT BY 1
      MINVALUE 1
      NO MAXVALUE
      CACHE 1
    `);

    await queryRunner.query(`
      ALTER TABLE "pacientes"
      ADD COLUMN IF NOT EXISTS "prontuario" character varying(20)
    `);

    await queryRunner.query(`
      ALTER TABLE "pacientes"
      ALTER COLUMN "prontuario"
      SET DEFAULT ('PRT-' || LPAD(nextval('pacientes_prontuario_seq')::text, 6, '0'))
    `);

    await queryRunner.query(`
      UPDATE "pacientes"
      SET "prontuario" = ('PRT-' || LPAD(nextval('pacientes_prontuario_seq')::text, 6, '0'))
      WHERE "prontuario" IS NULL OR BTRIM("prontuario") = ''
    `);

    await queryRunner.query(`
      SELECT setval(
        'pacientes_prontuario_seq',
        GREATEST(
          COALESCE(
            (
              SELECT MAX((regexp_replace("prontuario", '\\D', '', 'g'))::bigint)
              FROM "pacientes"
              WHERE "prontuario" ~ '[0-9]'
            ),
            0
          ),
          COALESCE((SELECT last_value FROM "pacientes_prontuario_seq"), 0)
        ),
        true
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "pacientes"
      ALTER COLUMN "prontuario"
      SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_pacientes_prontuario"
      ON "pacientes" ("prontuario")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "public"."UQ_pacientes_prontuario"');
    await queryRunner.query('ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "prontuario"');
    await queryRunner.query('DROP SEQUENCE IF EXISTS "pacientes_prontuario_seq"');
  }
}

