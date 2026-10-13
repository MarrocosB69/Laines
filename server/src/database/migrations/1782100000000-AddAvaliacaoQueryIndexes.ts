import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvaliacaoQueryIndexes1782100000000 implements MigrationInterface {
  name = 'AddAvaliacaoQueryIndexes1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_avaliacoes_paciente_tipo_status"
      ON "avaliacoes" ("paciente_id", "tipo", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_avaliacoes_paciente_status"
      ON "avaliacoes" ("paciente_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_avaliacoes_projeto_status"
      ON "avaliacoes" ("projeto_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_avaliacoes_projeto_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_avaliacoes_paciente_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_avaliacoes_paciente_tipo_status"');
  }
}
