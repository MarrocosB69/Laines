import { MigrationInterface, QueryRunner } from 'typeorm';

type ForeignKeyDefinition = {
  table: string;
  constraint: string;
  expression: string;
};

const FOREIGN_KEYS: ForeignKeyDefinition[] = [
  {
    table: 'users',
    constraint: 'FK_users_supervisor_id',
    expression: 'FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'users',
    constraint: 'FK_users_projeto_id',
    expression: 'FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'pacientes',
    constraint: 'FK_pacientes_aluno_responsavel_id',
    expression: 'FOREIGN KEY ("aluno_responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'pacientes',
    constraint: 'FK_pacientes_professor_supervisor_id',
    expression: 'FOREIGN KEY ("professor_supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'pacientes',
    constraint: 'FK_pacientes_atleta_user_id',
    expression: 'FOREIGN KEY ("atleta_user_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'pacientes',
    constraint: 'FK_pacientes_projeto_id',
    expression: 'FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'agendamentos',
    constraint: 'FK_agendamentos_paciente_id',
    expression: 'FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'agendamentos',
    constraint: 'FK_agendamentos_aluno_id',
    expression: 'FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'avaliacoes',
    constraint: 'FK_avaliacoes_paciente_id',
    expression: 'FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT NOT VALID'
  },
  {
    table: 'avaliacoes',
    constraint: 'FK_avaliacoes_aluno_id',
    expression: 'FOREIGN KEY ("aluno_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID'
  },
  {
    table: 'avaliacoes',
    constraint: 'FK_avaliacoes_projeto_id',
    expression: 'FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE SET NULL NOT VALID'
  }
];

export class AddCoreForeignKeys1773147000000 implements MigrationInterface {
  name = 'AddCoreForeignKeys1773147000000';

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
    for (const item of FOREIGN_KEYS) {
      const exists = await this.constraintExists(queryRunner, item.constraint);
      if (!exists) {
        await queryRunner.query(
          `ALTER TABLE "${item.table}" ADD CONSTRAINT "${item.constraint}" ${item.expression}`
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const item of [...FOREIGN_KEYS].reverse()) {
      const exists = await this.constraintExists(queryRunner, item.constraint);
      if (exists) {
        await queryRunner.query(
          `ALTER TABLE "${item.table}" DROP CONSTRAINT "${item.constraint}"`
        );
      }
    }
  }
}

