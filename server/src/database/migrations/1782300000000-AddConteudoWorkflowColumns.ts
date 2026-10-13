import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConteudoWorkflowColumns1782300000000 implements MigrationInterface {
  name = 'AddConteudoWorkflowColumns1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conteudos"
      ADD COLUMN IF NOT EXISTS "status" character varying(40) NOT NULL DEFAULT 'publicado',
      ADD COLUMN IF NOT EXISTS "autores" text array NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "profissional_nome" character varying(120),
      ADD COLUMN IF NOT EXISTS "profissional_credencial" character varying(80),
      ADD COLUMN IF NOT EXISTS "equipe_organizacao" text array NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "criado_por_id" uuid,
      ADD COLUMN IF NOT EXISTS "criado_por_nome" character varying(120),
      ADD COLUMN IF NOT EXISTS "aprovado_por_id" uuid,
      ADD COLUMN IF NOT EXISTS "aprovado_por_nome" character varying(120),
      ADD COLUMN IF NOT EXISTS "aprovado_em" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "publicado_em" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_conteudos_status" ON "conteudos" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_conteudos_status"`);
    await queryRunner.query(`
      ALTER TABLE "conteudos"
      DROP COLUMN IF EXISTS "publicado_em",
      DROP COLUMN IF EXISTS "aprovado_em",
      DROP COLUMN IF EXISTS "aprovado_por_nome",
      DROP COLUMN IF EXISTS "aprovado_por_id",
      DROP COLUMN IF EXISTS "criado_por_nome",
      DROP COLUMN IF EXISTS "criado_por_id",
      DROP COLUMN IF EXISTS "equipe_organizacao",
      DROP COLUMN IF EXISTS "profissional_credencial",
      DROP COLUMN IF EXISTS "profissional_nome",
      DROP COLUMN IF EXISTS "autores",
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
