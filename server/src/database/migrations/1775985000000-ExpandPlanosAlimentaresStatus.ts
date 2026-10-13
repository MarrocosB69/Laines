import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandPlanosAlimentaresStatus1775985000000 implements MigrationInterface {
  name = 'ExpandPlanosAlimentaresStatus1775985000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "planos_alimentares_status_enum" ADD VALUE IF NOT EXISTS 'em_revisao'`
    );
    await queryRunner.query(
      `ALTER TYPE "planos_alimentares_status_enum" ADD VALUE IF NOT EXISTS 'arquivado'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "planos_alimentares" SET "status" = 'encerrado' WHERE "status" = 'arquivado'`
    );
    await queryRunner.query(
      `UPDATE "planos_alimentares" SET "status" = 'rascunho' WHERE "status" = 'em_revisao'`
    );
  }
}
