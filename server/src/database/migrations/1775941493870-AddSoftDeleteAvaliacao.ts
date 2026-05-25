import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteAvaliacao1775941493870 implements MigrationInterface {
  name = 'AddSoftDeleteAvaliacao1775941493870';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // A coluna deleted_at e o indice parcial ja sao criados por AddAvaliacaoSoftDelete1773939000000.
    // Esta migration permanece como no-op para preservar a ordem/historico sem duplicar rollback.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op intencional: remover deleted_at aqui quebraria a migration anterior ainda aplicada.
  }
}
