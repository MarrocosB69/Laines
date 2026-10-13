import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjetoIdeiaInteresses1782600000000 implements MigrationInterface {
  name = 'AddProjetoIdeiaInteresses1782600000000';

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
    if (!await this.tableExists(queryRunner, 'projeto_ideias')) return;

    if (!await this.columnExists(queryRunner, 'projeto_ideias', 'interesses')) {
      await queryRunner.query(
        `ALTER TABLE "projeto_ideias"
         ADD COLUMN "interesses" jsonb NOT NULL DEFAULT '[]'::jsonb`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!await this.tableExists(queryRunner, 'projeto_ideias')) return;

    if (await this.columnExists(queryRunner, 'projeto_ideias', 'interesses')) {
      await queryRunner.query(
        `ALTER TABLE "projeto_ideias"
         DROP COLUMN "interesses"`
      );
    }
  }
}
