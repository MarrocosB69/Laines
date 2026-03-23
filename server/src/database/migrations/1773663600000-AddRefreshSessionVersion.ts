import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshSessionVersion1773663600000 implements MigrationInterface {
  name = 'AddRefreshSessionVersion1773663600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      DROP COLUMN IF EXISTS "session_version"
    `);
  }
}
