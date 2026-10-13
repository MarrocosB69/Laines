import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPacienteEquipeMulti1777752000000 implements MigrationInterface {
  name = 'AddPacienteEquipeMulti1777752000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pacientes"
      ADD COLUMN IF NOT EXISTS "equipe_multi_ids" uuid[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "pacientes"
      ADD COLUMN IF NOT EXISTS "equipe_multiprofissional" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "equipe_multiprofissional"');
    await queryRunner.query('ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "equipe_multi_ids"');
  }
}
