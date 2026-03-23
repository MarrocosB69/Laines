import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppointmentTypeToAgendamentos1773119000000 implements MigrationInterface {
  name = 'AddAppointmentTypeToAgendamentos1773119000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('agendamentos');
    if (!hasTable) {
      return;
    }

    const hasColumn = await queryRunner.hasColumn('agendamentos', 'appointment_type');
    if (!hasColumn) {
      await queryRunner.query(
        'ALTER TABLE "agendamentos" ADD COLUMN "appointment_type" character varying(40)'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('agendamentos');
    if (!hasTable) {
      return;
    }

    const hasColumn = await queryRunner.hasColumn('agendamentos', 'appointment_type');
    if (hasColumn) {
      await queryRunner.query('ALTER TABLE "agendamentos" DROP COLUMN "appointment_type"');
    }
  }
}
