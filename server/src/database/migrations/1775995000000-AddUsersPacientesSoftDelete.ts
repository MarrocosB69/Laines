import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersPacientesSoftDelete1775995000000 implements MigrationInterface {
  name = 'AddUsersPacientesSoftDelete1775995000000';

  private async columnExists(queryRunner: QueryRunner, tableName: string, columnName: string) {
    const rows = await queryRunner.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
       LIMIT 1`,
      [tableName, columnName]
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
    if (!await this.columnExists(queryRunner, 'users', 'deleted_at')) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMPTZ DEFAULT NULL`);
    }

    if (!await this.columnExists(queryRunner, 'pacientes', 'deleted_at')) {
      await queryRunner.query(`ALTER TABLE "pacientes" ADD COLUMN "deleted_at" TIMESTAMPTZ DEFAULT NULL`);
    }

    if (!await this.indexExists(queryRunner, 'IDX_users_deleted_at_null')) {
      await queryRunner.query(
        `CREATE INDEX "IDX_users_deleted_at_null"
         ON "users" ("status", "role", "created_at" DESC)
         WHERE "deleted_at" IS NULL`
      );
    }

    if (!await this.indexExists(queryRunner, 'IDX_pacientes_deleted_at_null')) {
      await queryRunner.query(
        `CREATE INDEX "IDX_pacientes_deleted_at_null"
         ON "pacientes" ("status", "created_at" DESC)
         WHERE "deleted_at" IS NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indexExists(queryRunner, 'IDX_pacientes_deleted_at_null')) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pacientes_deleted_at_null"`);
    }

    if (await this.indexExists(queryRunner, 'IDX_users_deleted_at_null')) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_deleted_at_null"`);
    }

    if (await this.columnExists(queryRunner, 'pacientes', 'deleted_at')) {
      await queryRunner.query(`ALTER TABLE "pacientes" DROP COLUMN "deleted_at"`);
    }

    if (await this.columnExists(queryRunner, 'users', 'deleted_at')) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    }
  }
}
