import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionVersionToUsers1773144000000 implements MigrationInterface {
  name = 'AddSessionVersionToUsers1773144000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('users', 'session_version');
    if (!hasColumn) {
      await queryRunner.query('ALTER TABLE "users" ADD COLUMN "session_version" integer NOT NULL DEFAULT 1');
    }
    await queryRunner.query('UPDATE "users" SET "session_version" = 1 WHERE "session_version" IS NULL OR "session_version" < 1');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('users', 'session_version');
    if (hasColumn) {
      await queryRunner.query('ALTER TABLE "users" DROP COLUMN "session_version"');
    }
  }
}

