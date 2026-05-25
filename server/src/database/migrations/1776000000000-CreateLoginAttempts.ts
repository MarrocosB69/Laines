import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoginAttempts1776000000000 implements MigrationInterface {
  name = 'CreateLoginAttempts1776000000000';

  private async tableExists(queryRunner: QueryRunner, tableName: string) {
    const rows = await queryRunner.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
       LIMIT 1`,
      [tableName]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  private async indexExists(queryRunner: QueryRunner, indexName: string) {
    const rows = await queryRunner.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = $1
       LIMIT 1`,
      [indexName]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await this.tableExists(queryRunner, 'login_attempts')) {
      await queryRunner.query(`
        CREATE TABLE "login_attempts" (
          "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "email" VARCHAR(190) NOT NULL,
          "ip" VARCHAR(64) NOT NULL,
          "count" INTEGER NOT NULL DEFAULT 0,
          "blocked_until" TIMESTAMP DEFAULT NULL,
          "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    if (!await this.indexExists(queryRunner, 'UQ_login_attempts_email_ip')) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_login_attempts_email_ip" ON "login_attempts" ("email", "ip")`
      );
    }

    if (!await this.indexExists(queryRunner, 'IDX_login_attempts_blocked_until')) {
      await queryRunner.query(
        `CREATE INDEX "IDX_login_attempts_blocked_until" ON "login_attempts" ("blocked_until")`
      );
    }

    if (!await this.indexExists(queryRunner, 'IDX_login_attempts_updated_at')) {
      await queryRunner.query(
        `CREATE INDEX "IDX_login_attempts_updated_at" ON "login_attempts" ("updated_at")`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_login_attempts_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_login_attempts_blocked_until"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_login_attempts_email_ip"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "login_attempts"`);
  }
}
