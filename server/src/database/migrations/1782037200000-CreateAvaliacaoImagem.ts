import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAvaliacaoImagem1782037200000 implements MigrationInterface {
  name = 'CreateAvaliacaoImagem1782037200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "avaliacao_imagem_capturas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "avaliacao_id" uuid NOT NULL,
        "vista" varchar(40) NOT NULL,
        "object_key" varchar(500) NOT NULL,
        "mime_type" varchar(100) NOT NULL DEFAULT 'image/jpeg',
        "upload_status" varchar(40) NOT NULL DEFAULT 'pendente',
        "tamanho_bytes" bigint,
        "sha256" varchar(64),
        "confirmado_em" timestamptz,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_avaliacao_imagem_capturas" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_avaliacao_imagem_captura_object_key" UNIQUE ("object_key"),
        CONSTRAINT "UQ_avaliacao_imagem_captura_vista" UNIQUE ("avaliacao_id", "vista"),
        CONSTRAINT "FK_avaliacao_imagem_captura_avaliacao" FOREIGN KEY ("avaliacao_id")
          REFERENCES "avaliacoes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_avaliacao_imagem_captura_avaliacao"
      ON "avaliacao_imagem_capturas" ("avaliacao_id")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "avaliacao_imagem_processamentos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "avaliacao_id" uuid NOT NULL,
        "status" varchar(40) NOT NULL DEFAULT 'aguardando_upload',
        "processor_job_id" varchar(160),
        "algoritmo_version" varchar(80),
        "progresso" double precision,
        "resultados" jsonb,
        "erro_codigo" varchar(80),
        "erro_mensagem" text,
        "concluido_em" timestamptz,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_avaliacao_imagem_processamentos" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_avaliacao_imagem_processamento_avaliacao" UNIQUE ("avaliacao_id"),
        CONSTRAINT "FK_avaliacao_imagem_processamento_avaliacao" FOREIGN KEY ("avaliacao_id")
          REFERENCES "avaliacoes"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "avaliacao_imagem_processamentos"');
    await queryRunner.query('DROP TABLE IF EXISTS "avaliacao_imagem_capturas"');
  }
}
