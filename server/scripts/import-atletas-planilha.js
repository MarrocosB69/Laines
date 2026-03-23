/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const INPUT_JSON_PATH = path.resolve(process.cwd(), 'tmp/atletas_planilha_import.json');
const OUTPUT_SQL_PATH = path.resolve(process.cwd(), 'tmp/atletas_planilha_upsert.sql');
const OUTPUT_REPORT_PATH = path.resolve(process.cwd(), 'tmp/atletas_planilha_relatorio.json');

const stripBom = (value) => String(value || '').replace(/^\uFEFF/, '');

const normalizeName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '')
  .trim();

const sqlLiteral = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const raw = String(value).replace(/'/g, "''");
  return `'${raw}'`;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTextOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const cpfCheckDigit = (digits) => {
  const factorStart = digits.length + 1;
  const total = digits.reduce((acc, digit, index) => acc + digit * (factorStart - index), 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

const buildCpfFromSeed = (seedText, extraSalt = 0) => {
  const digest = crypto.createHash('sha256').update(`${seedText}:${extraSalt}`).digest('hex');
  const baseDigits = digest
    .replace(/[a-f]/g, (char) => String((char.charCodeAt(0) - 87) % 10))
    .slice(0, 9)
    .split('')
    .map((digit) => Number(digit));
  const d1 = cpfCheckDigit(baseDigits);
  const d2 = cpfCheckDigit([...baseDigits, d1]);
  return [...baseDigits, d1, d2].join('');
};

const loadInput = () => {
  if (!fs.existsSync(INPUT_JSON_PATH)) {
    throw new Error(`Arquivo de entrada nao encontrado: ${INPUT_JSON_PATH}`);
  }
  const content = stripBom(fs.readFileSync(INPUT_JSON_PATH, 'utf8'));
  const parsed = JSON.parse(content);
  const athletes = Array.isArray(parsed.athletes) ? parsed.athletes : [];
  return {
    sourceFile: parsed.source_file || null,
    generatedAt: parsed.generated_at || null,
    athletes
  };
};

const buildDadosPayload = (athlete) => ({
  identificacao: athlete.identificacao || {},
  medidas_basicas: athlete.medidas_basicas || {},
  dobras_cutaneas: athlete.dobras_cutaneas || {},
  observacoes: athlete.observacoes || {},
  bioimpedancia: athlete.bioimpedancia || {},
  raw_values: athlete.raw_values || {}
});

const buildResultadosPayload = (athlete) => ({
  ...((athlete.resultados_automaticos && typeof athlete.resultados_automaticos === 'object')
    ? athlete.resultados_automaticos
    : {})
});

const buildPatientObservations = (athlete) => {
  const ident = athlete.identificacao || {};
  const med = athlete.medidas_basicas || {};
  const notes = [];
  notes.push('Cadastro importado de planilha de avaliacao de atletismo.');
  if (ident.data_avaliacao) notes.push(`Data da avaliacao: ${ident.data_avaliacao}.`);
  if (ident.categoria) notes.push(`Categoria: ${ident.categoria}.`);
  if (ident.modalidade_prova) notes.push(`Modalidade/prova: ${ident.modalidade_prova}.`);
  if (ident.clube_treinador) notes.push(`Clube/treinador: ${ident.clube_treinador}.`);
  if (med.estatura_m !== null && med.estatura_m !== undefined && med.estatura_m !== '') {
    notes.push(`Estatura: ${med.estatura_m} m.`);
  }
  const obs = athlete.observacoes?.observacoes_avaliador;
  if (obs) notes.push(`Obs. avaliador: ${obs}`);
  return notes.join(' ');
};

const main = async () => {
  const { athletes, sourceFile, generatedAt } = loadInput();
  const report = {
    source_file: sourceFile,
    source_generated_at: generatedAt,
    executed_at: new Date().toISOString(),
    atletas_encontrados: athletes.length,
    atletas_inseridos: 0,
    atletas_atualizados: 0,
    avaliacoes_inseridas: 0,
    avaliacoes_atualizadas: 0,
    campos_ausentes_ou_inconsistentes: [],
    detalhes: []
  };

  const sqlLines = [];
  sqlLines.push('-- Script gerado automaticamente para importacao de atletas/pacientes da planilha');
  sqlLines.push(`-- Fonte: ${sourceFile || 'desconhecida'}`);
  sqlLines.push(`-- Gerado em: ${new Date().toISOString()}`);
  sqlLines.push('BEGIN;');

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await client.connect();
  try {
    const existingPatientsRes = await client.query('SELECT id, nome, cpf FROM pacientes');
    const existingByNormalizedName = new Map(
      existingPatientsRes.rows
        .map((row) => [normalizeName(row.nome), row])
        .filter(([key]) => !!key)
    );

    const allCpfs = new Set(existingPatientsRes.rows.map((row) => String(row.cpf || '').trim()).filter(Boolean));

    for (const athlete of athletes) {
      const ident = athlete.identificacao || {};
      const nome = toTextOrNull(ident.nome);
      const dataAvaliacao = toTextOrNull(ident.data_avaliacao);
      const normalizedName = normalizeName(nome);
      const inconsistencias = Array.isArray(athlete.inconsistencias) ? athlete.inconsistencias : [];

      if (!nome) {
        report.campos_ausentes_ou_inconsistentes.push({
          sheet: athlete.sheet_name,
          field: 'identificacao.nome',
          reason: 'nome ausente'
        });
        report.detalhes.push({
          sheet: athlete.sheet_name,
          nome: null,
          paciente_status: 'ignorado',
          avaliacao_status: 'ignorada',
          motivo: 'nome ausente'
        });
        continue;
      }

      for (const issue of inconsistencias) {
        report.campos_ausentes_ou_inconsistentes.push({
          sheet: athlete.sheet_name,
          field: issue.field,
          raw_value: issue.raw_value,
          reason: issue.reason
        });
      }

      let patient = existingByNormalizedName.get(normalizedName) || null;
      let cpf = patient?.cpf || null;
      if (!cpf) {
        let salt = 0;
        while (!cpf) {
          const candidate = buildCpfFromSeed(normalizedName || nome, salt);
          if (!allCpfs.has(candidate)) {
            cpf = candidate;
            allCpfs.add(candidate);
            break;
          }
          salt += 1;
        }
      }

      const genero = toTextOrNull(ident.sexo) || 'nao_informado';
      const modalidade = toTextOrNull(ident.modalidade_prova);
      const tempoPratica = toTextOrNull(ident.tempo_treino);
      const observacoes = buildPatientObservations(athlete);

      let pacienteId = null;
      let pacienteStatus = null;
      if (patient) {
        const updateRes = await client.query(
          `UPDATE pacientes
           SET genero = COALESCE($2, genero),
               modalidade_principal = COALESCE($3, modalidade_principal),
               tempo_pratica = COALESCE($4, tempo_pratica),
               status = 'Ativo',
               observacoes = COALESCE($5, observacoes),
               updated_at = now()
           WHERE id = $1
           RETURNING id`,
          [patient.id, genero, modalidade, tempoPratica, observacoes]
        );
        pacienteId = updateRes.rows[0].id;
        pacienteStatus = 'atualizado';
        report.atletas_atualizados += 1;
        sqlLines.push(`-- ${athlete.sheet_name} (${nome})`);
        sqlLines.push(`UPDATE pacientes SET genero = ${sqlLiteral(genero)}, modalidade_principal = ${sqlLiteral(modalidade)}, tempo_pratica = ${sqlLiteral(tempoPratica)}, status = 'Ativo', observacoes = ${sqlLiteral(observacoes)}, updated_at = now() WHERE id = ${sqlLiteral(patient.id)};`);
      } else {
        const insertRes = await client.query(
          `INSERT INTO pacientes (
             nome, cpf, genero, status, modalidade_principal, tempo_pratica, observacoes,
             tipo_treino, intensidade, objetivo, data_cadastro, created_at, updated_at
           ) VALUES (
             $1, $2, $3, 'Ativo', $4, $5, $6,
             'misto', 'moderada', 'performance', now(), now(), now()
           )
           RETURNING id, nome, cpf`,
          [nome, cpf, genero, modalidade, tempoPratica, observacoes]
        );
        patient = insertRes.rows[0];
        pacienteId = patient.id;
        pacienteStatus = 'inserido';
        report.atletas_inseridos += 1;
        existingByNormalizedName.set(normalizedName, patient);
        sqlLines.push(`-- ${athlete.sheet_name} (${nome})`);
        sqlLines.push(`INSERT INTO pacientes (nome, cpf, genero, status, modalidade_principal, tempo_pratica, observacoes, tipo_treino, intensidade, objetivo, data_cadastro, created_at, updated_at) VALUES (${sqlLiteral(nome)}, ${sqlLiteral(cpf)}, ${sqlLiteral(genero)}, 'Ativo', ${sqlLiteral(modalidade)}, ${sqlLiteral(tempoPratica)}, ${sqlLiteral(observacoes)}, 'misto', 'moderada', 'performance', now(), now(), now());`);
      }

      const dadosPayload = buildDadosPayload(athlete);
      const resultadosPayload = buildResultadosPayload(athlete);
      const classificacaoImc = toTextOrNull(resultadosPayload.classificacao_imc);

      let avaliacaoStatus = null;
      if (dataAvaliacao) {
        const existingEvalRes = await client.query(
          `SELECT id
             FROM avaliacoes
            WHERE paciente_id = $1
              AND tipo = 'antropometria_atletismo'
              AND data_avaliacao = $2::date
            ORDER BY created_at DESC
            LIMIT 1`,
          [pacienteId, dataAvaliacao]
        );

        if (existingEvalRes.rowCount > 0) {
          const avaliacaoId = existingEvalRes.rows[0].id;
          await client.query(
            `UPDATE avaliacoes
                SET status = 'concluida',
                    dados = $2::jsonb,
                    resultados = $3::jsonb,
                    classificacao = $4,
                    classificacao_label = $4,
                    updated_at = now()
              WHERE id = $1`,
            [avaliacaoId, JSON.stringify(dadosPayload), JSON.stringify(resultadosPayload), classificacaoImc]
          );
          avaliacaoStatus = 'atualizada';
          report.avaliacoes_atualizadas += 1;
          sqlLines.push(`UPDATE avaliacoes SET status = 'concluida', dados = ${sqlLiteral(JSON.stringify(dadosPayload))}::jsonb, resultados = ${sqlLiteral(JSON.stringify(resultadosPayload))}::jsonb, classificacao = ${sqlLiteral(classificacaoImc)}, classificacao_label = ${sqlLiteral(classificacaoImc)}, updated_at = now() WHERE id = ${sqlLiteral(avaliacaoId)};`);
        } else {
          const insertEvalRes = await client.query(
            `INSERT INTO avaliacoes (
               tipo, paciente_id, status, data_avaliacao,
               dados, resultados, classificacao, classificacao_label, created_at, updated_at
             ) VALUES (
               'antropometria_atletismo', $1, 'concluida', $2::date,
               $3::jsonb, $4::jsonb, $5, $5, now(), now()
             )
             RETURNING id`,
            [pacienteId, dataAvaliacao, JSON.stringify(dadosPayload), JSON.stringify(resultadosPayload), classificacaoImc]
          );
          avaliacaoStatus = 'inserida';
          report.avaliacoes_inseridas += 1;
          sqlLines.push(`INSERT INTO avaliacoes (tipo, paciente_id, status, data_avaliacao, dados, resultados, classificacao, classificacao_label, created_at, updated_at) VALUES ('antropometria_atletismo', ${sqlLiteral(pacienteId)}, 'concluida', ${sqlLiteral(dataAvaliacao)}::date, ${sqlLiteral(JSON.stringify(dadosPayload))}::jsonb, ${sqlLiteral(JSON.stringify(resultadosPayload))}::jsonb, ${sqlLiteral(classificacaoImc)}, ${sqlLiteral(classificacaoImc)}, now(), now());`);
          sqlLines.push(`-- avaliacao_id: ${insertEvalRes.rows[0].id}`);
        }
      } else {
        avaliacaoStatus = 'ignorada_sem_data';
      }

      report.detalhes.push({
        sheet: athlete.sheet_name,
        nome,
        data_avaliacao: dataAvaliacao,
        paciente_status: pacienteStatus,
        paciente_id: pacienteId,
        avaliacao_status: avaliacaoStatus,
        inconsistencias: inconsistencias.length
      });
    }

    sqlLines.push('COMMIT;');
  } catch (error) {
    sqlLines.push('ROLLBACK;');
    throw error;
  } finally {
    await client.end();
  }

  fs.mkdirSync(path.dirname(OUTPUT_SQL_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_SQL_PATH, `${sqlLines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log(JSON.stringify({
    message: 'Importacao concluida',
    input_json: INPUT_JSON_PATH,
    output_sql: OUTPUT_SQL_PATH,
    output_report: OUTPUT_REPORT_PATH,
    resumo: {
      atletas_encontrados: report.atletas_encontrados,
      atletas_inseridos: report.atletas_inseridos,
      atletas_atualizados: report.atletas_atualizados,
      avaliacoes_inseridas: report.avaliacoes_inseridas,
      avaliacoes_atualizadas: report.avaliacoes_atualizadas,
      inconsistencias: report.campos_ausentes_ou_inconsistentes.length
    }
  }, null, 2));
};

main().catch((error) => {
  console.error('[import-atletas-planilha] failed:', error.message);
  process.exitCode = 1;
});
