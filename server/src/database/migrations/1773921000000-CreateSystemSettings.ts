import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemSettings1773921000000 implements MigrationInterface {
  name = 'CreateSystemSettings1773921000000';

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
    if (!(await this.tableExists(queryRunner, 'system_settings'))) {
      await queryRunner.query(`
        CREATE TABLE "system_settings" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "scope" character varying(80) NOT NULL,
          "payload" jsonb NOT NULL,
          "updated_by" jsonb,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_system_settings_id" PRIMARY KEY ("id")
        )
      `);
    }

    if (!(await this.indexExists(queryRunner, 'IDX_system_settings_scope_unique'))) {
      await queryRunner.query(
        'CREATE UNIQUE INDEX "IDX_system_settings_scope_unique" ON "system_settings" ("scope")'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indexExists(queryRunner, 'IDX_system_settings_scope_unique')) {
      await queryRunner.query('DROP INDEX "IDX_system_settings_scope_unique"');
    }
    if (await this.tableExists(queryRunner, 'system_settings')) {
      await queryRunner.query('DROP TABLE "system_settings"');
    }
  }
}
