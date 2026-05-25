import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvaliacaoSoftDelete1773939000000 implements MigrationInterface {
  name = 'AddAvaliacaoSoftDelete1773939000000';

  private async columnExists(queryRunner: QueryRunner, tableName: string, columnName: string) {
    const rows = await queryRunner.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name  = $1
         AND column_name = $2
       LIMIT 1`,
      [tableName, columnName]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  private async indexExists(queryRunner: QueryRunner, indexName: string) {
    const rows = await queryRunner.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
      [indexName]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Adicionar coluna deleted_at (nullable — não afeta dados existentes)
    const hasColumn = await this.columnExists(queryRunner, 'avaliacoes', 'deleted_at');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "avaliacoes" ADD COLUMN "deleted_at" TIMESTAMPTZ DEFAULT NULL`
      );
    }

    // 2. Índice parcial para performance em queries que excluem registros deletados
    const hasIndex = await this.indexExists(queryRunner, 'IDX_avaliacoes_deleted_at_null');
    if (!hasIndex) {
      await queryRunner.query(
        `CREATE INDEX "IDX_avaliacoes_deleted_at_null"
         ON "avaliacoes" ("paciente_id", "tipo", "created_at" DESC)
         WHERE "deleted_at" IS NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasIndex = await this.indexExists(queryRunner, 'IDX_avaliacoes_deleted_at_null');
    if (hasIndex) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_avaliacoes_deleted_at_null"`);
    }

    const hasColumn = await this.columnExists(queryRunner, 'avaliacoes', 'deleted_at');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "avaliacoes" DROP COLUMN "deleted_at"`);
    }
  }
}
