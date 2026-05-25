import { MigrationInterface, QueryRunner } from 'typeorm';

type NullableReferenceFix = {
  table: string;
  column: string;
  referenceTable: string;
  referenceColumn?: string;
};

type DeleteOrphanFix = {
  table: string;
  column: string;
  referenceTable: string;
  referenceColumn?: string;
};

type ConstraintTarget = {
  table: string;
  constraint: string;
};

const NULLABLE_REFERENCE_FIXES: NullableReferenceFix[] = [
  { table: 'users', column: 'supervisor_id', referenceTable: 'users' },
  { table: 'users', column: 'projeto_id', referenceTable: 'projetos' },
  { table: 'pacientes', column: 'aluno_responsavel_id', referenceTable: 'users' },
  { table: 'pacientes', column: 'professor_supervisor_id', referenceTable: 'users' },
  { table: 'pacientes', column: 'atleta_user_id', referenceTable: 'users' },
  { table: 'pacientes', column: 'projeto_id', referenceTable: 'projetos' },
  { table: 'agendamentos', column: 'paciente_id', referenceTable: 'pacientes' },
  { table: 'agendamentos', column: 'aluno_id', referenceTable: 'users' },
  { table: 'avaliacoes', column: 'aluno_id', referenceTable: 'users' },
  { table: 'avaliacoes', column: 'projeto_id', referenceTable: 'projetos' },
  { table: 'avaliacoes', column: 'sessao_id', referenceTable: 'avaliacao_sessoes' },
  { table: 'avaliacao_sessoes', column: 'profissional_id', referenceTable: 'users' },
  { table: 'avaliacao_sessoes', column: 'projeto_id', referenceTable: 'projetos' },
  { table: 'refresh_tokens', column: 'replaced_by_token_id', referenceTable: 'refresh_tokens' }
];

const DELETE_ORPHAN_FIXES: DeleteOrphanFix[] = [
  { table: 'refresh_tokens', column: 'user_id', referenceTable: 'users' },
  { table: 'avaliacao_sessoes', column: 'paciente_id', referenceTable: 'pacientes' },
  { table: 'avaliacoes', column: 'paciente_id', referenceTable: 'pacientes' }
];

const CONSTRAINTS_TO_VALIDATE: ConstraintTarget[] = [
  { table: 'users', constraint: 'FK_users_supervisor_id' },
  { table: 'users', constraint: 'FK_users_projeto_id' },
  { table: 'pacientes', constraint: 'FK_pacientes_aluno_responsavel_id' },
  { table: 'pacientes', constraint: 'FK_pacientes_professor_supervisor_id' },
  { table: 'pacientes', constraint: 'FK_pacientes_atleta_user_id' },
  { table: 'pacientes', constraint: 'FK_pacientes_projeto_id' },
  { table: 'agendamentos', constraint: 'FK_agendamentos_paciente_id' },
  { table: 'agendamentos', constraint: 'FK_agendamentos_aluno_id' },
  { table: 'avaliacoes', constraint: 'FK_avaliacoes_paciente_id' },
  { table: 'avaliacoes', constraint: 'FK_avaliacoes_aluno_id' },
  { table: 'avaliacoes', constraint: 'FK_avaliacoes_projeto_id' },
  { table: 'refresh_tokens', constraint: 'FK_refresh_tokens_user_id' },
  { table: 'refresh_tokens', constraint: 'FK_refresh_tokens_replaced_by_token_id' },
  { table: 'avaliacoes', constraint: 'FK_avaliacoes_sessao_id' },
  { table: 'avaliacao_sessoes', constraint: 'FK_avaliacao_sessoes_paciente_id' },
  { table: 'avaliacao_sessoes', constraint: 'FK_avaliacao_sessoes_profissional_id' },
  { table: 'avaliacao_sessoes', constraint: 'FK_avaliacao_sessoes_projeto_id' }
];

export class SanitizeAndValidateForeignKeys1773927000000 implements MigrationInterface {
  name = 'SanitizeAndValidateForeignKeys1773927000000';

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

  private async constraintExists(queryRunner: QueryRunner, constraintName: string) {
    const rows = await queryRunner.query(
      `
        SELECT 1
        FROM pg_constraint c
        WHERE c.conname = $1
        LIMIT 1
      `,
      [constraintName]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  private async constraintIsValidated(queryRunner: QueryRunner, constraintName: string) {
    const rows: Array<{ validated: boolean }> = await queryRunner.query(
      `
        SELECT c.convalidated AS "validated"
        FROM pg_constraint c
        WHERE c.conname = $1
        LIMIT 1
      `,
      [constraintName]
    );
    return Array.isArray(rows) && rows[0]?.validated === true;
  }

  private async nullifyOrphans(queryRunner: QueryRunner, fix: NullableReferenceFix) {
    const referenceColumn = fix.referenceColumn ?? 'id';
    const [tableOk, columnOk, refTableOk] = await Promise.all([
      this.tableExists(queryRunner, fix.table),
      this.columnExists(queryRunner, fix.table, fix.column),
      this.tableExists(queryRunner, fix.referenceTable)
    ]);

    if (!tableOk || !columnOk || !refTableOk) {
      return;
    }

    await queryRunner.query(`
      UPDATE "${fix.table}" AS child
      SET "${fix.column}" = NULL
      WHERE child."${fix.column}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "${fix.referenceTable}" AS parent
          WHERE parent."${referenceColumn}" = child."${fix.column}"
        )
    `);
  }

  private async deleteOrphans(queryRunner: QueryRunner, fix: DeleteOrphanFix) {
    const referenceColumn = fix.referenceColumn ?? 'id';
    const [tableOk, columnOk, refTableOk] = await Promise.all([
      this.tableExists(queryRunner, fix.table),
      this.columnExists(queryRunner, fix.table, fix.column),
      this.tableExists(queryRunner, fix.referenceTable)
    ]);

    if (!tableOk || !columnOk || !refTableOk) {
      return;
    }

    await queryRunner.query(`
      DELETE FROM "${fix.table}" AS child
      WHERE child."${fix.column}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "${fix.referenceTable}" AS parent
          WHERE parent."${referenceColumn}" = child."${fix.column}"
        )
    `);
  }

  private async repairAvaliacoesPacienteBySessao(queryRunner: QueryRunner) {
    const [avaliacoesOk, pacienteColumnOk, sessaoColumnOk, sessaoTableOk, pacientesOk] =
      await Promise.all([
        this.tableExists(queryRunner, 'avaliacoes'),
        this.columnExists(queryRunner, 'avaliacoes', 'paciente_id'),
        this.columnExists(queryRunner, 'avaliacoes', 'sessao_id'),
        this.tableExists(queryRunner, 'avaliacao_sessoes'),
        this.tableExists(queryRunner, 'pacientes')
      ]);

    if (!avaliacoesOk || !pacienteColumnOk || !sessaoColumnOk || !sessaoTableOk || !pacientesOk) {
      return;
    }

    await queryRunner.query(`
      UPDATE "avaliacoes" AS a
      SET "paciente_id" = s."paciente_id"
      FROM "avaliacao_sessoes" AS s
      WHERE a."sessao_id" = s."id"
        AND s."paciente_id" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM "pacientes" AS p_valid
          WHERE p_valid."id" = s."paciente_id"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "pacientes" AS p_current
          WHERE p_current."id" = a."paciente_id"
        )
    `);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const fix of NULLABLE_REFERENCE_FIXES) {
      await this.nullifyOrphans(queryRunner, fix);
    }

    await this.repairAvaliacoesPacienteBySessao(queryRunner);

    for (const fix of DELETE_ORPHAN_FIXES) {
      await this.deleteOrphans(queryRunner, fix);
    }

    for (const item of CONSTRAINTS_TO_VALIDATE) {
      const exists = await this.constraintExists(queryRunner, item.constraint);
      if (!exists) {
        continue;
      }

      const validated = await this.constraintIsValidated(queryRunner, item.constraint);
      if (validated) {
        continue;
      }

      await queryRunner.query(
        `ALTER TABLE "${item.table}" VALIDATE CONSTRAINT "${item.constraint}"`
      );
    }
  }

  public async down(): Promise<void> {
    // Irreversible migration: data cleanup and FK validation.
  }
}
