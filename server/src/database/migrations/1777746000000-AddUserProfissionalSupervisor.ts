import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfissionalSupervisor1777746000000 implements MigrationInterface {
  name = 'AddUserProfissionalSupervisor1777746000000';

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
    if (!await this.columnExists(queryRunner, 'users', 'profissional_id')) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "profissional_id" uuid`
      );
    }

    if (!await this.columnExists(queryRunner, 'users', 'profissional_nome')) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "profissional_nome" character varying(120)`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profissional_nome"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profissional_id"`);
  }
}
