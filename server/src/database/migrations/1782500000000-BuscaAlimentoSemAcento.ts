import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Busca de alimentos insensivel a acento.
 *
 * O catalogo tem 35 alimentos com "feijao" no nome, todos grafados "Feijão".
 * Quem digitava "feijao" — o caso comum — nao encontrava nenhum. Numa base
 * brasileira de alimentos isso deixa boa parte do catalogo inalcancavel.
 *
 * `unaccent()` nao e IMMUTABLE porque depende do dicionario carregado, entao
 * nao pode ser usada direto em indice. O envoltorio abaixo fixa o dicionario
 * e declara a imutabilidade, que e o caminho padrao para indexar.
 */
export class BuscaAlimentoSemAcento1782500000000 implements MigrationInterface {
  name = 'BuscaAlimentoSemAcento1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION imutavel_unaccent(texto text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      PARALLEL SAFE
      STRICT
      AS $$ SELECT public.unaccent('public.unaccent', texto) $$
    `);

    // Indice para o LIKE com curinga a esquerda ainda nao ajuda, mas o
    // trigram sim — e a busca do catalogo e sempre "contem".
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_taco_descricao_sem_acento"
      ON "taco" USING gin (imutavel_unaccent(lower("descricao")) gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_taco_descricao_sem_acento"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS imutavel_unaccent(text)`);
    // As extensoes ficam: outras partes do banco podem passar a usa-las, e
    // remove-las quebraria qualquer indice criado depois.
  }
}
