import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConteudoArquivoColumns1778000000000 implements MigrationInterface {
  name = 'AddConteudoArquivoColumns1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conteudos"
      ADD COLUMN IF NOT EXISTS "arquivoPath" character varying(512),
      ADD COLUMN IF NOT EXISTS "arquivoNome" character varying(255),
      ADD COLUMN IF NOT EXISTS "arquivoMime" character varying(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conteudos"
      DROP COLUMN IF EXISTS "arquivoMime",
      DROP COLUMN IF EXISTS "arquivoNome",
      DROP COLUMN IF EXISTS "arquivoPath"
    `);
  }
}
