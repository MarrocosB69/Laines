import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acrescenta a TBCA 7.0 (INA/POF 2017-2018) ao catalogo de alimentos.
 *
 * A TBCA convive com a TACO em vez de substitui-la: as duas divergem em
 * varios alimentos, e planos alimentares ja prescritos referenciam linhas
 * desta tabela pelo id. Apagar a TACO apagaria a base desses planos.
 * A coluna `fonte` distingue a origem de cada alimento na busca.
 *
 * A TBCA tambem traz nutrientes que a TACO nao tem (acidos graxos por classe,
 * selenio, B12, folato) — relevantes em nutricao esportiva, entao ganham
 * coluna propria em vez de serem descartados na importacao.
 */
export class AddTbcaCatalog1782400000000 implements MigrationInterface {
  name = 'AddTbcaCatalog1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "taco"
        ADD COLUMN IF NOT EXISTS "fonte" varchar(12) NOT NULL DEFAULT 'TACO',
        ADD COLUMN IF NOT EXISTS "codigo_texto" varchar(24),
        ADD COLUMN IF NOT EXISTS "tipo_alimento" varchar(60),
        ADD COLUMN IF NOT EXISTS "nome_ingles" varchar(255),
        ADD COLUMN IF NOT EXISTS "carboidrato_disponivel" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "alcool" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "acidos_graxos_saturados" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "acidos_graxos_monoinsaturados" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "acidos_graxos_poliinsaturados" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "acidos_graxos_trans" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "selenio" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "vitamina_a_re" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "vitamina_a_rae" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "vitamina_b12" numeric(8,2),
        ADD COLUMN IF NOT EXISTS "folato" numeric(8,2)
    `);

    // A busca filtra por descricao e agora tambem por fonte.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_taco_fonte" ON "taco" ("fonte")`
    );

    // O codigo numerico e um identificador *dentro* de cada tabela: a TACO
    // numera de 1 a 900 e a TBCA tem a propria sequencia. Unicidade global
    // impedia as duas de conviverem — passa a ser por (fonte, codigo).
    await queryRunner.query(`ALTER TABLE "taco" DROP CONSTRAINT IF EXISTS "UQ_taco_codigo"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_taco_fonte_codigo" ON "taco" ("fonte", "codigo")`
    );
    // O codigo da TBCA e alfanumerico (C0209A) e nao cabe na coluna inteira
    // existente; unico por fonte para o seed poder ser reexecutado.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_taco_fonte_codigo_texto"
       ON "taco" ("fonte", "codigo_texto") WHERE "codigo_texto" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "taco" WHERE "fonte" = 'TBCA'`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_taco_fonte_codigo_texto"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_taco_fonte_codigo"`);
    await queryRunner.query(
      `ALTER TABLE "taco" ADD CONSTRAINT "UQ_taco_codigo" UNIQUE ("codigo")`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_taco_fonte"`);
    await queryRunner.query(`
      ALTER TABLE "taco"
        DROP COLUMN IF EXISTS "folato",
        DROP COLUMN IF EXISTS "vitamina_b12",
        DROP COLUMN IF EXISTS "vitamina_a_rae",
        DROP COLUMN IF EXISTS "vitamina_a_re",
        DROP COLUMN IF EXISTS "selenio",
        DROP COLUMN IF EXISTS "acidos_graxos_trans",
        DROP COLUMN IF EXISTS "acidos_graxos_poliinsaturados",
        DROP COLUMN IF EXISTS "acidos_graxos_monoinsaturados",
        DROP COLUMN IF EXISTS "acidos_graxos_saturados",
        DROP COLUMN IF EXISTS "alcool",
        DROP COLUMN IF EXISTS "carboidrato_disponivel",
        DROP COLUMN IF EXISTS "nome_ingles",
        DROP COLUMN IF EXISTS "tipo_alimento",
        DROP COLUMN IF EXISTS "codigo_texto",
        DROP COLUMN IF EXISTS "fonte"
    `);
  }
}
