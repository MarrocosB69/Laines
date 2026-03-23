import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1773103580343 implements MigrationInterface {
    name = 'Init1773103580343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
await queryRunner.query(`CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "legacy_uid" character varying, "email" character varying(190) NOT NULL, "password_hash" character varying NOT NULL, "role" character varying(80) NOT NULL DEFAULT 'aluno', "name" character varying(120) NOT NULL, "cpf" character varying(20), "data_nascimento" date, "matricula" character varying(40), "periodo" character varying(20), "supervisor_id" uuid, "supervisor_nome" character varying(120), "diretoria" character varying(80), "curso" character varying(80), "projeto_id" uuid, "projeto_nome" character varying(120), "telefone" character varying(20), "crn" character varying(40), "conselho_tipo" character varying(40), "conselho_numero" character varying(40), "departamento" character varying(80), "nivel_acesso" character varying(40), "coord_atendimento" boolean NOT NULL DEFAULT false, "must_change_password" boolean NOT NULL DEFAULT false, "password_updated_at" TIMESTAMP, "status" character varying NOT NULL DEFAULT 'ativo', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_862e17f0a2f8559e0226447c95" ON "users" ("legacy_uid") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_9a1bf4d0601de6693fc9b31d7f" ON "users" ("supervisor_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tarefas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(180) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pendente', "assigned_role" character varying(60) NOT NULL DEFAULT 'todos', "created_by" uuid, "created_by_name" character varying(120), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2f57a4443470e61ac5de297e30a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_076bc8ff061f6d02c3594f4aed" ON "tarefas" ("assigned_role") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_051d1d614730344d38f6c456f0" ON "tarefas" ("created_by") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "solicitacoes_acesso" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nome" character varying(120) NOT NULL, "email" character varying(190) NOT NULL, "cpf" character varying(20) NOT NULL, "data_nascimento" date, "telefone" character varying(30), "area" character varying(80), "cargo_solicitado" character varying(40), "matricula" character varying(40), "conselho_tipo" character varying(40), "conselho_numero" character varying(40), "instituicao" character varying(120), "diretoria" character varying(80), "projeto_id" uuid, "projeto_nome" character varying(120), "justificativa" text, "status" character varying(20) NOT NULL DEFAULT 'pendente', "origem" character varying(30) NOT NULL DEFAULT 'landing', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b2491c0ed3d90f2c2cc7c73f642" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_2a52d8b3d3443c10672f0eebd0" ON "solicitacoes_acesso" ("nome") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_61a09849df9f818644dcd149ad" ON "solicitacoes_acesso" ("email") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_21cefd3642d8f7af49e7ccc130" ON "solicitacoes_acesso" ("cpf") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "projetos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nome" character varying(200) NOT NULL, "area" character varying(40) NOT NULL DEFAULT 'nutricao', "status" character varying(40) NOT NULL DEFAULT 'planejamento', "coordenador" character varying(120), "coordenador_id" uuid, "descricao" text, "equipe" text array NOT NULL DEFAULT '{}', "alunos_ids" uuid array NOT NULL DEFAULT '{}', "alunos_nomes" text array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fb6b6aed4b30e10b976fe8bdf5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "pacientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nome" character varying(120) NOT NULL, "cpf" character varying(20) NOT NULL, "data_nascimento" date, "genero" character varying(20) NOT NULL DEFAULT 'nao_informado', "telefone" character varying(20), "email" character varying(190), "endereco" character varying(120), "bairro" character varying(80), "cidade" character varying(80), "estado" character varying(10), "status" character varying(40) NOT NULL DEFAULT 'Lista de Espera', "modalidade_principal" character varying(120), "tempo_pratica" character varying(60), "frequencia_semanal" integer, "duracao_sessao" integer, "outras_modalidades" text, "tipo_treino" character varying(20) NOT NULL DEFAULT 'misto', "intensidade" character varying(20) NOT NULL DEFAULT 'moderada', "objetivo" character varying(20) NOT NULL DEFAULT 'performance', "observacoes" text, "historico_saude" text, "comorbidades_pessoais" jsonb, "comorbidades_familiares" jsonb, "confirmacao_atleta" jsonb, "anexos" jsonb, "mensagens_professor" jsonb, "projeto_id" uuid, "projeto_nome" character varying(120), "aluno_responsavel_id" uuid, "aluno_responsavel_nome" character varying(120), "professor_supervisor_id" uuid, "professor_supervisor_nome" character varying(120), "equipe_tecnica_ids" uuid array NOT NULL DEFAULT '{}', "atleta_user_id" uuid, "consentimento_pesquisa" character varying(20) NOT NULL DEFAULT 'pendente', "consentimento_data" date, "consentimento_versao" character varying(40), "faltas" integer NOT NULL DEFAULT '0', "data_cadastro" TIMESTAMP, "linked_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aa9c9f624ff22fc06c44d8b1609" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_d6737b831d4e311678dfce056b" ON "pacientes" ("cpf") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_50d0c8cad5164a57b3c306f075" ON "pacientes" ("aluno_responsavel_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_746683d807fc47d74a90875254" ON "pacientes" ("professor_supervisor_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "notificacoes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "titulo" character varying(120) NOT NULL, "mensagem" text NOT NULL, "tipo" character varying(20) NOT NULL DEFAULT 'info', "read_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1161e00a97df46d9d3c5eed6545" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ef6f1caee15a51b552fdc05842" ON "notificacoes" ("user_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "conteudos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "categoria" character varying(60) NOT NULL, "titulo" character varying(180) NOT NULL, "data" date, "link" character varying(255), "descricao" text, "tipo" character varying(40), "publico" character varying(20), "cursos" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_56cc3b3344c007f6378440afd1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_16e3839a79ee53155ba5e6375b" ON "conteudos" ("categoria") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "avaliacoes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" character varying(60) NOT NULL, "paciente_id" uuid NOT NULL, "projeto_id" uuid, "projeto_nome" character varying(120), "aluno_id" uuid, "status" character varying(30) NOT NULL DEFAULT 'rascunho', "data_avaliacao" date, "dados" jsonb, "resultados" jsonb, "registros" jsonb, "meta" jsonb, "auto_save" boolean NOT NULL DEFAULT false, "total_diario" double precision, "percentuais" jsonb, "classificacao" character varying(60), "classificacao_label" character varying(120), "pontuacao_ebia" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_84647fe39434d93a8b0ced69d7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f5941cc5894ead0fbf5b150427" ON "avaliacoes" ("tipo") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_376ffa7115cc32f4dc86ab9a4b" ON "avaliacoes" ("paciente_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3d203a76e72c579dc5f131d0fc" ON "avaliacoes" ("projeto_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a0c1a51b9e36e300e28795d2da" ON "avaliacoes" ("aluno_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "auditoria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying(60) NOT NULL, "entity" character varying(60) NOT NULL, "entity_id" character varying(80), "meta" jsonb, "actor" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_135fe98308816fe3a2d458e6637" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "agendamentos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "paciente_id" uuid, "paciente_nome" character varying(120), "aluno_id" uuid, "aluno_nome" character varying(120), "date" date, "time" character varying(10), "scheduled_at" TIMESTAMP, "evaluations" text array NOT NULL DEFAULT '{}', "status" character varying(20) NOT NULL DEFAULT 'agendada', "origem_id" uuid, "remarcada_em" TIMESTAMP, "remarcada_para" TIMESTAMP, "completed_at" TIMESTAMP, "faltou_em" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3890b7448ebc7efdfd1d43bf0c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6d126dfca43749da338ef17bb6" ON "agendamentos" ("paciente_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_814b60788bddc097c9921b924b" ON "agendamentos" ("aluno_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasUsersTable = await queryRunner.hasTable('users');
        if (!hasUsersTable) {
            return;
        }
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_814b60788bddc097c9921b924b"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_6d126dfca43749da338ef17bb6"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "agendamentos"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "auditoria"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_a0c1a51b9e36e300e28795d2da"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_3d203a76e72c579dc5f131d0fc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_376ffa7115cc32f4dc86ab9a4b"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_f5941cc5894ead0fbf5b150427"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "avaliacoes"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_16e3839a79ee53155ba5e6375b"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "conteudos"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ef6f1caee15a51b552fdc05842"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notificacoes"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_746683d807fc47d74a90875254"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_50d0c8cad5164a57b3c306f075"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_d6737b831d4e311678dfce056b"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pacientes"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "projetos"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_21cefd3642d8f7af49e7ccc130"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_61a09849df9f818644dcd149ad"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_2a52d8b3d3443c10672f0eebd0"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "solicitacoes_acesso"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_051d1d614730344d38f6c456f0"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_076bc8ff061f6d02c3594f4aed"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tarefas"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_9a1bf4d0601de6693fc9b31d7f"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_862e17f0a2f8559e0226447c95"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    }

}



