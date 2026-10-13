import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPermissions1777740000000 implements MigrationInterface {
  name = 'AddUserPermissions1777740000000';

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await this.columnExists(queryRunner, 'users', 'permissions')) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "permissions" text array NOT NULL DEFAULT '{}'`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "permissions"`);
  }
}
