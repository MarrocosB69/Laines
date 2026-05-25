import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlanosAlimentares1775979000000 implements MigrationInterface {
  name = 'CreatePlanosAlimentares1775979000000';

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

  private async typeExists(queryRunner: QueryRunner, typeName: string) {
    const rows = await queryRunner.query(
      `SELECT 1
       FROM pg_type
       WHERE typname = $1
       LIMIT 1`,
      [typeName]
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
    const enumName = 'planos_alimentares_status_enum';
    const hasEnum = await this.typeExists(queryRunner, enumName);
    if (!hasEnum) {
      await queryRunner.query(
        `CREATE TYPE "${enumName}" AS ENUM ('rascunho', 'ativo', 'encerrado')`
      );
    }

    const hasTable = await this.tableExists(queryRunner, 'planos_alimentares');
    if (!hasTable) {
      await queryRunner.query(
        `CREATE TABLE "planos_alimentares" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "paciente_id" uuid NOT NULL,
          "aluno_id" uuid,
          "projeto_id" uuid,
          "status" "${enumName}" NOT NULL DEFAULT 'rascunho',
          "data_inicio" date NOT NULL,
          "data_fim" date,
          "tipo_dieta" character varying(40) NOT NULL DEFAULT 'fixa',
          "meta_calorica" integer,
          "meta_cho_g" integer,
          "meta_ptn_g" integer,
          "meta_lip_g" integer,
          "meta_fibras_g" integer,
          "fase_atual" character varying(80),
          "validado_antidoping" boolean NOT NULL DEFAULT false,
          "dados" jsonb,
          "resultados" jsonb,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "deleted_at" TIMESTAMP WITH TIME ZONE,
          CONSTRAINT "PK_planos_alimentares_id" PRIMARY KEY ("id"),
          CONSTRAINT "FK_planos_alimentares_paciente" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
          CONSTRAINT "FK_planos_alimentares_aluno" FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
          CONSTRAINT "FK_planos_alimentares_projeto" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        )`
      );
    }

    const indexes = [
      { name: 'IDX_planos_alimentares_paciente_id', sql: `CREATE INDEX "IDX_planos_alimentares_paciente_id" ON "planos_alimentares" ("paciente_id")` },
      { name: 'IDX_planos_alimentares_aluno_id', sql: `CREATE INDEX "IDX_planos_alimentares_aluno_id" ON "planos_alimentares" ("aluno_id")` },
      { name: 'IDX_planos_alimentares_projeto_id', sql: `CREATE INDEX "IDX_planos_alimentares_projeto_id" ON "planos_alimentares" ("projeto_id")` },
      { name: 'IDX_planos_alimentares_status', sql: `CREATE INDEX "IDX_planos_alimentares_status" ON "planos_alimentares" ("status")` },
      { name: 'IDX_planos_alimentares_deleted_at', sql: `CREATE INDEX "IDX_planos_alimentares_deleted_at" ON "planos_alimentares" ("deleted_at")` }
    ];

    for (const item of indexes) {
      const exists = await this.indexExists(queryRunner, item.name);
      if (!exists) {
        await queryRunner.query(item.sql);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      'IDX_planos_alimentares_deleted_at',
      'IDX_planos_alimentares_status',
      'IDX_planos_alimentares_projeto_id',
      'IDX_planos_alimentares_aluno_id',
      'IDX_planos_alimentares_paciente_id'
    ];

    for (const name of indexes) {
      const exists = await this.indexExists(queryRunner, name);
      if (exists) {
        await queryRunner.query(`DROP INDEX "public"."${name}"`);
      }
    }

    const hasTable = await this.tableExists(queryRunner, 'planos_alimentares');
    if (hasTable) {
      await queryRunner.query(`DROP TABLE "planos_alimentares"`);
    }

    const enumName = 'planos_alimentares_status_enum';
    const hasEnum = await this.typeExists(queryRunner, enumName);
    if (hasEnum) {
      await queryRunner.query(`DROP TYPE "${enumName}"`);
    }
  }
}
