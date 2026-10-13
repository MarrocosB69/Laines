import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvaliacaoReviewColumns1778060000000 implements MigrationInterface {
  name = 'AddAvaliacaoReviewColumns1778060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "avaliacoes"
      ADD COLUMN IF NOT EXISTS "revisado_em" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "revisado_por_id" uuid,
      ADD COLUMN IF NOT EXISTS "revisado_por_nome" character varying(120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "avaliacoes"
      DROP COLUMN IF EXISTS "revisado_por_nome",
      DROP COLUMN IF EXISTS "revisado_por_id",
      DROP COLUMN IF EXISTS "revisado_em"
    `);
  }
}
