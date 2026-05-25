import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSolicitacaoApprovalTracking1773912000000 implements MigrationInterface {
  name = 'AddSolicitacaoApprovalTracking1773912000000';

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
    if (!(await this.columnExists(queryRunner, 'solicitacoes_acesso', 'approved_user_id'))) {
      await queryRunner.query(
        'ALTER TABLE "solicitacoes_acesso" ADD COLUMN "approved_user_id" uuid'
      );
    }
    if (!(await this.columnExists(queryRunner, 'solicitacoes_acesso', 'approved_at'))) {
      await queryRunner.query(
        'ALTER TABLE "solicitacoes_acesso" ADD COLUMN "approved_at" TIMESTAMP'
      );
    }
    if (!(await this.indexExists(queryRunner, 'IDX_solicitacoes_acesso_approved_user_id'))) {
      await queryRunner.query(
        'CREATE INDEX "IDX_solicitacoes_acesso_approved_user_id" ON "solicitacoes_acesso" ("approved_user_id")'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indexExists(queryRunner, 'IDX_solicitacoes_acesso_approved_user_id')) {
      await queryRunner.query('DROP INDEX "IDX_solicitacoes_acesso_approved_user_id"');
    }
    if (await this.columnExists(queryRunner, 'solicitacoes_acesso', 'approved_at')) {
      await queryRunner.query(
        'ALTER TABLE "solicitacoes_acesso" DROP COLUMN "approved_at"'
      );
    }
    if (await this.columnExists(queryRunner, 'solicitacoes_acesso', 'approved_user_id')) {
      await queryRunner.query(
        'ALTER TABLE "solicitacoes_acesso" DROP COLUMN "approved_user_id"'
      );
    }
  }
}
