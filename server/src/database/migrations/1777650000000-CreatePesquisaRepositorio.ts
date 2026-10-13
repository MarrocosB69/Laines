import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePesquisaRepositorio1777650000000 implements MigrationInterface {
  name = 'CreatePesquisaRepositorio1777650000000';

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
    const hasProducoes = await this.tableExists(queryRunner, 'projeto_producoes');
    if (!hasProducoes) {
      await queryRunner.query(
        `CREATE TABLE "projeto_producoes" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "projeto_id" uuid,
          "projeto_nome" character varying(200),
          "titulo" character varying(200) NOT NULL,
          "tipo" character varying(60) NOT NULL DEFAULT 'documento',
          "descricao" text,
          "autores" text array NOT NULL DEFAULT '{}',
          "ano" integer,
          "area" character varying(60),
          "status" character varying(40) NOT NULL DEFAULT 'em_revisao',
          "visibilidade" character varying(40) NOT NULL DEFAULT 'interno_laines',
          "link_externo" character varying(500),
          "arquivo" jsonb,
          "criado_por_id" uuid,
          "criado_por_nome" character varying(120),
          "validado_por_id" uuid,
          "validado_por_nome" character varying(120),
          "validado_em" TIMESTAMP WITH TIME ZONE,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "deleted_at" TIMESTAMP WITH TIME ZONE,
          CONSTRAINT "PK_projeto_producoes_id" PRIMARY KEY ("id"),
          CONSTRAINT "FK_projeto_producoes_projeto" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        )`
      );
    }

    const hasIdeias = await this.tableExists(queryRunner, 'projeto_ideias');
    if (!hasIdeias) {
      await queryRunner.query(
        `CREATE TABLE "projeto_ideias" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "titulo" character varying(200) NOT NULL,
          "problema" text,
          "justificativa" text,
          "objetivo" text,
          "area" character varying(60) NOT NULL DEFAULT 'multidisciplinar',
          "palavras_chave" text array NOT NULL DEFAULT '{}',
          "status" character varying(40) NOT NULL DEFAULT 'ideia',
          "responsavel_id" uuid,
          "responsavel_nome" character varying(120),
          "criado_por_id" uuid,
          "criado_por_nome" character varying(120),
          "observacoes" text,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "deleted_at" TIMESTAMP WITH TIME ZONE,
          CONSTRAINT "PK_projeto_ideias_id" PRIMARY KEY ("id")
        )`
      );
    }

    const indexes = [
      { name: 'IDX_projeto_producoes_projeto_id', sql: `CREATE INDEX "IDX_projeto_producoes_projeto_id" ON "projeto_producoes" ("projeto_id")` },
      { name: 'IDX_projeto_producoes_status', sql: `CREATE INDEX "IDX_projeto_producoes_status" ON "projeto_producoes" ("status")` },
      { name: 'IDX_projeto_producoes_visibilidade', sql: `CREATE INDEX "IDX_projeto_producoes_visibilidade" ON "projeto_producoes" ("visibilidade")` },
      { name: 'IDX_projeto_producoes_deleted_at', sql: `CREATE INDEX "IDX_projeto_producoes_deleted_at" ON "projeto_producoes" ("deleted_at")` },
      { name: 'IDX_projeto_ideias_status', sql: `CREATE INDEX "IDX_projeto_ideias_status" ON "projeto_ideias" ("status")` },
      { name: 'IDX_projeto_ideias_deleted_at', sql: `CREATE INDEX "IDX_projeto_ideias_deleted_at" ON "projeto_ideias" ("deleted_at")` }
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
      'IDX_projeto_ideias_deleted_at',
      'IDX_projeto_ideias_status',
      'IDX_projeto_producoes_deleted_at',
      'IDX_projeto_producoes_visibilidade',
      'IDX_projeto_producoes_status',
      'IDX_projeto_producoes_projeto_id'
    ];

    for (const name of indexes) {
      const exists = await this.indexExists(queryRunner, name);
      if (exists) {
        await queryRunner.query(`DROP INDEX "public"."${name}"`);
      }
    }

    if (await this.tableExists(queryRunner, 'projeto_ideias')) {
      await queryRunner.query(`DROP TABLE "projeto_ideias"`);
    }
    if (await this.tableExists(queryRunner, 'projeto_producoes')) {
      await queryRunner.query(`DROP TABLE "projeto_producoes"`);
    }
  }
}
