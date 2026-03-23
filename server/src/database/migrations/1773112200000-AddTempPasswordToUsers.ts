import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTempPasswordToUsers1773112200000 implements MigrationInterface {
  name = 'AddTempPasswordToUsers1773112200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsers = await queryRunner.hasTable('users');
    if (!hasUsers) return;

    const hasColumn = await queryRunner.hasColumn('users', 'temp_password');
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "temp_password" character varying(120)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasUsers = await queryRunner.hasTable('users');
    if (!hasUsers) return;

    const hasColumn = await queryRunner.hasColumn('users', 'temp_password');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "temp_password"`);
    }
  }
}
