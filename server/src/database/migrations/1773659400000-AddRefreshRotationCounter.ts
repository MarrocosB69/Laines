import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshRotationCounter1773659400000 implements MigrationInterface {
  name = 'AddRefreshRotationCounter1773659400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "rotation_counter" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      DROP COLUMN IF EXISTS "rotation_counter"
    `);
  }
}

