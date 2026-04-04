import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvaliacaoSessaoContainer1773900000000 implements MigrationInterface {
  name = 'AddAvaliacaoSessaoContainer1773900000000';

  private async constraintExists(queryRunner: QueryRunner, constraintName: string) {
    const rows = await queryRunner.query(
      `SELECT 1
       FROM pg_constraint c
       WHERE c.conname = $1
       LIMIT 1`,
      [constraintName]
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
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "avaliacao_sessoes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paciente_id" uuid NOT NULL,
        "profissional_id" uuid NULL,
        "projeto_id" uuid NULL,
        "data_referencia" date NOT NULL,
        "observacoes_gerais" text NULL,
        "status" character varying(20) NOT NULL DEFAULT 'rascunho',
        "meta" jsonb NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_avaliacao_sessoes_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacao_sessoes_paciente_id" ON "avaliacao_sessoes" ("paciente_id")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacao_sessoes_profissional_id" ON "avaliacao_sessoes" ("profissional_id")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacao_sessoes_projeto_id" ON "avaliacao_sessoes" ("projeto_id")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacao_sessoes_paciente_data" ON "avaliacao_sessoes" ("paciente_id", "data_referencia" DESC)'
    );

    if (!(await this.columnExists(queryRunner, 'avaliacoes', 'sessao_id'))) {
      await queryRunner.query('ALTER TABLE "avaliacoes" ADD COLUMN "sessao_id" uuid');
    }
    if (!(await this.columnExists(queryRunner, 'avaliacoes', 'schema_version'))) {
      await queryRunner.query('ALTER TABLE "avaliacoes" ADD COLUMN "schema_version" smallint NOT NULL DEFAULT 1');
    }
    if (!(await this.columnExists(queryRunner, 'avaliacoes', 'formula_id'))) {
      await queryRunner.query('ALTER TABLE "avaliacoes" ADD COLUMN "formula_id" character varying(60)');
    }
    if (!(await this.columnExists(queryRunner, 'avaliacoes', 'formula_version'))) {
      await queryRunner.query('ALTER TABLE "avaliacoes" ADD COLUMN "formula_version" character varying(30)');
    }
    if (!(await this.columnExists(queryRunner, 'avaliacoes', 'source_system'))) {
      await queryRunner.query('ALTER TABLE "avaliacoes" ADD COLUMN "source_system" character varying(40)');
    }
    if (!(await this.columnExists(queryRunner, 'avaliacoes', 'source_ref'))) {
      await queryRunner.query('ALTER TABLE "avaliacoes" ADD COLUMN "source_ref" character varying(120)');
    }
    if (!(await this.columnExists(queryRunner, 'avaliacoes', 'measured_at'))) {
      await queryRunner.query('ALTER TABLE "avaliacoes" ADD COLUMN "measured_at" TIMESTAMPTZ');
    }

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacoes_sessao_id" ON "avaliacoes" ("sessao_id")'
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_avaliacoes_sessao_tipo" ON "avaliacoes" ("sessao_id", "tipo") WHERE "sessao_id" IS NOT NULL'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_avaliacoes_paciente_tipo_data" ON "avaliacoes" ("paciente_id", "tipo", "data_avaliacao" DESC, "created_at" DESC)'
    );

    const fkSessaoAvaliacao = 'FK_avaliacoes_sessao_id';
    if (!(await this.constraintExists(queryRunner, fkSessaoAvaliacao))) {
      await queryRunner.query(`
        ALTER TABLE "avaliacoes"
        ADD CONSTRAINT "${fkSessaoAvaliacao}"
        FOREIGN KEY ("sessao_id") REFERENCES "avaliacao_sessoes"("id")
        ON DELETE SET NULL
        NOT VALID
      `);
    }

    const fkSessaoPaciente = 'FK_avaliacao_sessoes_paciente_id';
    if (!(await this.constraintExists(queryRunner, fkSessaoPaciente))) {
      await queryRunner.query(`
        ALTER TABLE "avaliacao_sessoes"
        ADD CONSTRAINT "${fkSessaoPaciente}"
        FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id")
        ON DELETE CASCADE
        NOT VALID
      `);
    }

    const fkSessaoProfissional = 'FK_avaliacao_sessoes_profissional_id';
    if (!(await this.constraintExists(queryRunner, fkSessaoProfissional))) {
      await queryRunner.query(`
        ALTER TABLE "avaliacao_sessoes"
        ADD CONSTRAINT "${fkSessaoProfissional}"
        FOREIGN KEY ("profissional_id") REFERENCES "users"("id")
        ON DELETE SET NULL
        NOT VALID
      `);
    }

    const fkSessaoProjeto = 'FK_avaliacao_sessoes_projeto_id';
    if (!(await this.constraintExists(queryRunner, fkSessaoProjeto))) {
      await queryRunner.query(`
        ALTER TABLE "avaliacao_sessoes"
        ADD CONSTRAINT "${fkSessaoProjeto}"
        FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id")
        ON DELETE SET NULL
        NOT VALID
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const fkSessaoProjeto = 'FK_avaliacao_sessoes_projeto_id';
    if (await this.constraintExists(queryRunner, fkSessaoProjeto)) {
      await queryRunner.query(
        `ALTER TABLE "avaliacao_sessoes" DROP CONSTRAINT "${fkSessaoProjeto}"`
      );
    }

    const fkSessaoProfissional = 'FK_avaliacao_sessoes_profissional_id';
    if (await this.constraintExists(queryRunner, fkSessaoProfissional)) {
      await queryRunner.query(
        `ALTER TABLE "avaliacao_sessoes" DROP CONSTRAINT "${fkSessaoProfissional}"`
      );
    }

    const fkSessaoPaciente = 'FK_avaliacao_sessoes_paciente_id';
    if (await this.constraintExists(queryRunner, fkSessaoPaciente)) {
      await queryRunner.query(
        `ALTER TABLE "avaliacao_sessoes" DROP CONSTRAINT "${fkSessaoPaciente}"`
      );
    }

    const fkSessaoAvaliacao = 'FK_avaliacoes_sessao_id';
    if (await this.constraintExists(queryRunner, fkSessaoAvaliacao)) {
      await queryRunner.query(
        `ALTER TABLE "avaliacoes" DROP CONSTRAINT "${fkSessaoAvaliacao}"`
      );
    }

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_avaliacoes_paciente_tipo_data"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_avaliacoes_sessao_tipo"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_avaliacoes_sessao_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_avaliacao_sessoes_paciente_data"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_avaliacao_sessoes_projeto_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_avaliacao_sessoes_profissional_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_avaliacao_sessoes_paciente_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "avaliacao_sessoes"');

    if (await this.columnExists(queryRunner, 'avaliacoes', 'measured_at')) {
      await queryRunner.query('ALTER TABLE "avaliacoes" DROP COLUMN "measured_at"');
    }
    if (await this.columnExists(queryRunner, 'avaliacoes', 'source_ref')) {
      await queryRunner.query('ALTER TABLE "avaliacoes" DROP COLUMN "source_ref"');
    }
    if (await this.columnExists(queryRunner, 'avaliacoes', 'source_system')) {
      await queryRunner.query('ALTER TABLE "avaliacoes" DROP COLUMN "source_system"');
    }
    if (await this.columnExists(queryRunner, 'avaliacoes', 'formula_version')) {
      await queryRunner.query('ALTER TABLE "avaliacoes" DROP COLUMN "formula_version"');
    }
    if (await this.columnExists(queryRunner, 'avaliacoes', 'formula_id')) {
      await queryRunner.query('ALTER TABLE "avaliacoes" DROP COLUMN "formula_id"');
    }
    if (await this.columnExists(queryRunner, 'avaliacoes', 'schema_version')) {
      await queryRunner.query('ALTER TABLE "avaliacoes" DROP COLUMN "schema_version"');
    }
    if (await this.columnExists(queryRunner, 'avaliacoes', 'sessao_id')) {
      await queryRunner.query('ALTER TABLE "avaliacoes" DROP COLUMN "sessao_id"');
    }
  }
}

