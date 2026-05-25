import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTacoCatalog1775967000000 implements MigrationInterface {
  name = 'CreateTacoCatalog1775967000000';

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
    const hasTable = await this.tableExists(queryRunner, 'taco');
    if (!hasTable) {
      await queryRunner.query(
        `CREATE TABLE "taco" (
          "id" SERIAL NOT NULL,
          "codigo" integer NOT NULL,
          "descricao" character varying(255) NOT NULL,
          "grupo" character varying(120) NOT NULL,
          "umidade" numeric(8,2),
          "energia_kcal" numeric(8,2),
          "energia_kj" numeric(8,2),
          "proteina" numeric(8,2),
          "lipidios" numeric(8,2),
          "colesterol" numeric(8,2),
          "carboidrato" numeric(8,2),
          "fibra" numeric(8,2),
          "cinzas" numeric(8,2),
          "calcio" numeric(8,2),
          "magnesio" numeric(8,2),
          "manganes" numeric(8,2),
          "fosforo" numeric(8,2),
          "ferro" numeric(8,2),
          "sodio" numeric(8,2),
          "potassio" numeric(8,2),
          "cobre" numeric(8,2),
          "zinco" numeric(8,2),
          "retinol" numeric(8,2),
          "tiamina" numeric(8,2),
          "riboflavina" numeric(8,2),
          "piridoxina" numeric(8,2),
          "niacina" numeric(8,2),
          "vitamina_c" numeric(8,2),
          "vitamina_d" numeric(8,2),
          "vitamina_e" numeric(8,2),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_taco_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_taco_codigo" UNIQUE ("codigo")
        )`
      );
    }

    const hasDescricaoIdx = await this.indexExists(queryRunner, 'IDX_taco_descricao');
    if (!hasDescricaoIdx) {
      await queryRunner.query(
        `CREATE INDEX "IDX_taco_descricao" ON "taco" ("descricao")`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasDescricaoIdx = await this.indexExists(queryRunner, 'IDX_taco_descricao');
    if (hasDescricaoIdx) {
      await queryRunner.query(`DROP INDEX "public"."IDX_taco_descricao"`);
    }

    const hasTable = await this.tableExists(queryRunner, 'taco');
    if (hasTable) {
      await queryRunner.query(`DROP TABLE "taco"`);
    }
  }
}
