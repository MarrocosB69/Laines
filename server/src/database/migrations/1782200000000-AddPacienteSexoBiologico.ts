import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPacienteSexoBiologico1782200000000 implements MigrationInterface {
  name = 'AddPacienteSexoBiologico1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "sexo_biologico" character varying(20)'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "sexo_biologico"'
    );
  }
}
