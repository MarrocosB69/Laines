import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvaliacoesCreatedAtIndex1773138000000 implements MigrationInterface {
  name = 'AddAvaliacoesCreatedAtIndex1773138000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacoes_created_at_desc" ON "avaliacoes" ("created_at" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_avaliacoes_created_at_desc"');
  }
}
