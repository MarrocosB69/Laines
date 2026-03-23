import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokensTable1773153000000 implements MigrationInterface {
  name = 'AddRefreshTokensTable1773153000000';

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

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "token_hash" character varying(128) NOT NULL,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp NULL,
        "revoked_at" timestamp NULL,
        "replaced_by_token_id" uuid NULL,
        "user_agent" character varying(255) NULL,
        "ip_address" character varying(64) NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")'
    );

    const userConstraint = 'FK_refresh_tokens_user_id';
    if (!(await this.constraintExists(queryRunner, userConstraint))) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens"
        ADD CONSTRAINT "${userConstraint}"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE
        NOT VALID
      `);
    }

    const replacedByConstraint = 'FK_refresh_tokens_replaced_by_token_id';
    if (!(await this.constraintExists(queryRunner, replacedByConstraint))) {
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens"
        ADD CONSTRAINT "${replacedByConstraint}"
        FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id")
        ON DELETE SET NULL
        NOT VALID
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const replacedByConstraint = 'FK_refresh_tokens_replaced_by_token_id';
    if (await this.constraintExists(queryRunner, replacedByConstraint)) {
      await queryRunner.query(
        `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "${replacedByConstraint}"`
      );
    }

    const userConstraint = 'FK_refresh_tokens_user_id';
    if (await this.constraintExists(queryRunner, userConstraint)) {
      await queryRunner.query(
        `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "${userConstraint}"`
      );
    }

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_expires_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_family_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_refresh_tokens_token_hash"');
    await queryRunner.query('DROP TABLE IF EXISTS "refresh_tokens"');
  }
}
