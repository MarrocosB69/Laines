import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecureAccountRecovery1789128000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email varchar(190)');
    // Only a request already approved and explicitly linked to the user establishes this contact.
    await queryRunner.query(`UPDATE users u SET recovery_email = approved.email FROM (
      SELECT DISTINCT ON (approved_user_id) approved_user_id, LOWER(TRIM(email)) AS email
      FROM solicitacoes_acesso WHERE status = 'aprovado' AND approved_user_id IS NOT NULL
        AND email LIKE '%@%' ORDER BY approved_user_id, approved_at DESC NULLS LAST
    ) approved WHERE u.id = approved.approved_user_id AND u.recovery_email IS NULL`);
    await queryRunner.query(`UPDATE users SET recovery_email = email
      WHERE recovery_email IS NULL AND email NOT ILIKE '%@laines.ufrn.br'`);
    await queryRunner.query(`CREATE TABLE password_recovery_tokens (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      token_hash varchar(64) NOT NULL UNIQUE,
      expires_at timestamp NOT NULL,
      session_version integer NOT NULL
    )`);
    // Temporary passwords already distributed become unusable; an activation link replaces them.
    await queryRunner.query(`UPDATE users SET password_hash = '!activation-required',
      session_version = session_version + 1 WHERE must_change_password = true AND temp_password IS NOT NULL`);
    await queryRunner.query('UPDATE users SET temp_password = NULL WHERE temp_password IS NOT NULL');
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT users_no_plaintext_password CHECK (temp_password IS NULL)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_no_plaintext_password');
    await queryRunner.query('DROP TABLE IF EXISTS password_recovery_tokens');
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS recovery_email');
    // Scrubbed passwords cannot and must not be restored.
  }
}
