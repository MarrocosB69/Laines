import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceAvaliacaoSessaoTipoUnique1775989000000 implements MigrationInterface {
  name = 'EnforceAvaliacaoSessaoTipoUnique1775989000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_avaliacoes_sessao_tipo"');

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY sessao_id, tipo
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          ) AS rn
        FROM avaliacoes
        WHERE sessao_id IS NOT NULL
          AND deleted_at IS NULL
      )
      UPDATE avaliacoes AS avaliacao
      SET deleted_at = NOW(), updated_at = NOW()
      FROM ranked
      WHERE avaliacao.id = ranked.id
        AND ranked.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_avaliacoes_sessao_tipo"
      ON "avaliacoes" ("sessao_id", "tipo")
      WHERE "sessao_id" IS NOT NULL
        AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_avaliacoes_sessao_tipo"');
  }
}
