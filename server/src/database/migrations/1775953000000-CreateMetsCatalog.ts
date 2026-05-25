import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMetsCatalog1775953000000 implements MigrationInterface {
  name = 'CreateMetsCatalog1775953000000';

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    const categoriaType = await this.typeExists(queryRunner, 'mets_categoria_enum');
    if (!categoriaType) {
      await queryRunner.query(
        `CREATE TYPE "mets_categoria_enum" AS ENUM ('forca', 'endurance', 'coletivo', 'aquatico', 'combate', 'outro')`
      );
    }

    const intensidadeType = await this.typeExists(queryRunner, 'mets_intensidade_enum');
    if (!intensidadeType) {
      await queryRunner.query(
        `CREATE TYPE "mets_intensidade_enum" AS ENUM ('leve', 'moderada', 'vigorosa', 'maxima')`
      );
    }

    const hasTable = await this.tableExists(queryRunner, 'mets');
    if (!hasTable) {
      await queryRunner.query(
        `CREATE TABLE "mets" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "modalidade" character varying(120) NOT NULL,
          "categoria" "mets_categoria_enum" NOT NULL,
          "intensidade" "mets_intensidade_enum" NOT NULL,
          "met_value" numeric(3,1) NOT NULL,
          "fonte" character varying(120) NOT NULL DEFAULT 'Ainsworth 2011',
          "codigo_ainsworth" character varying(80),
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_mets_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_mets_modalidade_categoria_intensidade" UNIQUE ("modalidade", "categoria", "intensidade")
        )`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await this.tableExists(queryRunner, 'mets');
    if (hasTable) {
      await queryRunner.query(`DROP TABLE "mets"`);
    }

    const intensidadeType = await this.typeExists(queryRunner, 'mets_intensidade_enum');
    if (intensidadeType) {
      await queryRunner.query(`DROP TYPE "mets_intensidade_enum"`);
    }

    const categoriaType = await this.typeExists(queryRunner, 'mets_categoria_enum');
    if (categoriaType) {
      await queryRunner.query(`DROP TYPE "mets_categoria_enum"`);
    }
  }
}
