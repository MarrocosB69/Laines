import { MigrationInterface, QueryRunner } from 'typeorm';

// Dois vocabularios que estavam livres e passaram a divergir em producao:
//
//   users.diretoria      — 5 usuarios, 5 convencoes ("Ensino e Capacitacao",
//                          "diretoria_marketing", ...). Quem nao batia com a
//                          tabela de apelidos ficava sem nenhuma area.
//   pacientes.status     — 'Ativo' e 'ativo', 'Lista de Espera' e 'espera'
//                          convivendo, fazendo todo filtro por status errar.
export class NormalizeDiretoriaEStatusPaciente1782310000000 implements MigrationInterface {
  name = 'NormalizeDiretoriaEStatusPaciente1782310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users" SET "diretoria" = CASE
        WHEN lower(translate("diretoria", 'ãáàâçéêíõóôúüÃÁÀÂÇÉÊÍÕÓÔÚÜ', 'aaaaceeioouuAAAACEEIOOUU')) LIKE '%pesquisa%'   THEN 'diretoria_pesquisa'
        WHEN lower(translate("diretoria", 'ãáàâçéêíõóôúüÃÁÀÂÇÉÊÍÕÓÔÚÜ', 'aaaaceeioouuAAAACEEIOOUU')) LIKE '%extensao%'   THEN 'diretoria_extensao'
        WHEN lower(translate("diretoria", 'ãáàâçéêíõóôúüÃÁÀÂÇÉÊÍÕÓÔÚÜ', 'aaaaceeioouuAAAACEEIOOUU')) LIKE '%ensino%'     THEN 'diretoria_ensino'
        WHEN lower(translate("diretoria", 'ãáàâçéêíõóôúüÃÁÀÂÇÉÊÍÕÓÔÚÜ', 'aaaaceeioouuAAAACEEIOOUU')) LIKE '%marketing%'
          OR lower(translate("diretoria", 'ãáàâçéêíõóôúüÃÁÀÂÇÉÊÍÕÓÔÚÜ', 'aaaaceeioouuAAAACEEIOOUU')) LIKE '%comunicacao%' THEN 'diretoria_marketing'
        ELSE "diretoria"
      END
      WHERE "diretoria" IS NOT NULL AND "diretoria" <> ''
    `);

    await queryRunner.query(`
      UPDATE "pacientes" SET "status" = CASE
        WHEN lower("status") IN ('ativo')                              THEN 'Ativo'
        WHEN lower("status") IN ('inativo')                            THEN 'Inativo'
        WHEN lower("status") IN ('triagem')                            THEN 'Triagem'
        WHEN lower("status") IN ('espera', 'lista de espera', 'lista_espera') THEN 'Lista de Espera'
        ELSE "status"
      END
    `);
  }

  public async down(): Promise<void> {
    // Normalizacao de vocabulario nao tem reversao util: os valores originais
    // eram justamente o defeito.
  }
}
