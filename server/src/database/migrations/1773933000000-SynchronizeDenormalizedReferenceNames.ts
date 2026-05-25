import { MigrationInterface, QueryRunner } from 'typeorm';

export class SynchronizeDenormalizedReferenceNames1773933000000 implements MigrationInterface {
  name = 'SynchronizeDenormalizedReferenceNames1773933000000';

  private async tableExists(queryRunner: QueryRunner, tableName: string) {
    const rows: Array<{ exists: boolean }> = await queryRunner.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS "exists"
      `,
      [tableName]
    );
    return Array.isArray(rows) && rows[0]?.exists === true;
  }

  private async columnExists(queryRunner: QueryRunner, tableName: string, columnName: string) {
    const rows: Array<{ exists: boolean }> = await queryRunner.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS "exists"
      `,
      [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0]?.exists === true;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsers = await this.tableExists(queryRunner, 'users');
    const hasProjetos = await this.tableExists(queryRunner, 'projetos');
    const hasPacientes = await this.tableExists(queryRunner, 'pacientes');
    const hasAgendamentos = await this.tableExists(queryRunner, 'agendamentos');
    const hasAvaliacoes = await this.tableExists(queryRunner, 'avaliacoes');

    if (
      hasUsers
      && hasProjetos
      && await this.columnExists(queryRunner, 'users', 'supervisor_id')
      && await this.columnExists(queryRunner, 'users', 'supervisor_nome')
      && await this.columnExists(queryRunner, 'users', 'projeto_id')
      && await this.columnExists(queryRunner, 'users', 'projeto_nome')
      && await this.columnExists(queryRunner, 'users', 'name')
      && await this.columnExists(queryRunner, 'projetos', 'nome')
    ) {
      await queryRunner.query(`
        UPDATE "users" AS u
        SET "supervisor_nome" = s."name"
        FROM "users" AS s
        WHERE u."supervisor_id" = s."id"
          AND u."supervisor_nome" IS DISTINCT FROM s."name"
      `);
      await queryRunner.query(`
        UPDATE "users" AS u
        SET "projeto_nome" = p."nome"
        FROM "projetos" AS p
        WHERE u."projeto_id" = p."id"
          AND u."projeto_nome" IS DISTINCT FROM p."nome"
      `);
      await queryRunner.query(`
        UPDATE "users"
        SET "supervisor_nome" = NULL
        WHERE "supervisor_id" IS NULL
          AND "supervisor_nome" IS NOT NULL
      `);
      await queryRunner.query(`
        UPDATE "users"
        SET "projeto_nome" = NULL
        WHERE "projeto_id" IS NULL
          AND "projeto_nome" IS NOT NULL
      `);
    }

    if (
      hasPacientes
      && hasUsers
      && hasProjetos
      && await this.columnExists(queryRunner, 'pacientes', 'aluno_responsavel_id')
      && await this.columnExists(queryRunner, 'pacientes', 'aluno_responsavel_nome')
      && await this.columnExists(queryRunner, 'pacientes', 'professor_supervisor_id')
      && await this.columnExists(queryRunner, 'pacientes', 'professor_supervisor_nome')
      && await this.columnExists(queryRunner, 'pacientes', 'projeto_id')
      && await this.columnExists(queryRunner, 'pacientes', 'projeto_nome')
      && await this.columnExists(queryRunner, 'users', 'name')
      && await this.columnExists(queryRunner, 'projetos', 'nome')
    ) {
      await queryRunner.query(`
        UPDATE "pacientes" AS pa
        SET "aluno_responsavel_nome" = u."name"
        FROM "users" AS u
        WHERE pa."aluno_responsavel_id" = u."id"
          AND pa."aluno_responsavel_nome" IS DISTINCT FROM u."name"
      `);
      await queryRunner.query(`
        UPDATE "pacientes" AS pa
        SET "professor_supervisor_nome" = u."name"
        FROM "users" AS u
        WHERE pa."professor_supervisor_id" = u."id"
          AND pa."professor_supervisor_nome" IS DISTINCT FROM u."name"
      `);
      await queryRunner.query(`
        UPDATE "pacientes" AS pa
        SET "projeto_nome" = p."nome"
        FROM "projetos" AS p
        WHERE pa."projeto_id" = p."id"
          AND pa."projeto_nome" IS DISTINCT FROM p."nome"
      `);
      await queryRunner.query(`
        UPDATE "pacientes"
        SET "aluno_responsavel_nome" = NULL
        WHERE "aluno_responsavel_id" IS NULL
          AND "aluno_responsavel_nome" IS NOT NULL
      `);
      await queryRunner.query(`
        UPDATE "pacientes"
        SET "professor_supervisor_nome" = NULL
        WHERE "professor_supervisor_id" IS NULL
          AND "professor_supervisor_nome" IS NOT NULL
      `);
      await queryRunner.query(`
        UPDATE "pacientes"
        SET "projeto_nome" = NULL
        WHERE "projeto_id" IS NULL
          AND "projeto_nome" IS NOT NULL
      `);
    }

    if (
      hasAgendamentos
      && hasUsers
      && hasPacientes
      && await this.columnExists(queryRunner, 'agendamentos', 'aluno_id')
      && await this.columnExists(queryRunner, 'agendamentos', 'aluno_nome')
      && await this.columnExists(queryRunner, 'agendamentos', 'paciente_id')
      && await this.columnExists(queryRunner, 'agendamentos', 'paciente_nome')
      && await this.columnExists(queryRunner, 'users', 'name')
      && await this.columnExists(queryRunner, 'pacientes', 'nome')
    ) {
      await queryRunner.query(`
        UPDATE "agendamentos" AS a
        SET "aluno_nome" = u."name"
        FROM "users" AS u
        WHERE a."aluno_id" = u."id"
          AND a."aluno_nome" IS DISTINCT FROM u."name"
      `);
      await queryRunner.query(`
        UPDATE "agendamentos" AS a
        SET "paciente_nome" = p."nome"
        FROM "pacientes" AS p
        WHERE a."paciente_id" = p."id"
          AND a."paciente_nome" IS DISTINCT FROM p."nome"
      `);
      await queryRunner.query(`
        UPDATE "agendamentos"
        SET "aluno_nome" = NULL
        WHERE "aluno_id" IS NULL
          AND "aluno_nome" IS NOT NULL
      `);
      await queryRunner.query(`
        UPDATE "agendamentos"
        SET "paciente_nome" = NULL
        WHERE "paciente_id" IS NULL
          AND "paciente_nome" IS NOT NULL
      `);
    }

    if (
      hasAvaliacoes
      && hasProjetos
      && await this.columnExists(queryRunner, 'avaliacoes', 'projeto_id')
      && await this.columnExists(queryRunner, 'avaliacoes', 'projeto_nome')
      && await this.columnExists(queryRunner, 'projetos', 'nome')
    ) {
      await queryRunner.query(`
        UPDATE "avaliacoes" AS a
        SET "projeto_nome" = p."nome"
        FROM "projetos" AS p
        WHERE a."projeto_id" = p."id"
          AND a."projeto_nome" IS DISTINCT FROM p."nome"
      `);
      await queryRunner.query(`
        UPDATE "avaliacoes"
        SET "projeto_nome" = NULL
        WHERE "projeto_id" IS NULL
          AND "projeto_nome" IS NOT NULL
      `);
    }
  }

  public async down(): Promise<void> {
    // Irreversible migration: synchronizes denormalized names with reference entities.
  }
}
