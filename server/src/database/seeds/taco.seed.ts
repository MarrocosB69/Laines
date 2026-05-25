import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import dataSource from '../typeorm.config';
import { TacoFood } from '../../taco/taco.entity';

type SeedRow = {
  codigo: number;
  grupo: string;
  descricao: string;
  umidade: string | null;
  energiaKcal: string | null;
  energiaKj: string | null;
  proteina: string | null;
  lipidios: string | null;
  colesterol: string | null;
  carboidrato: string | null;
  fibra: string | null;
  cinzas: string | null;
  calcio: string | null;
  magnesio: string | null;
  manganes: string | null;
  fosforo: string | null;
  ferro: string | null;
  sodio: string | null;
  potassio: string | null;
  cobre: string | null;
  zinco: string | null;
  retinol: string | null;
  tiamina: string | null;
  riboflavina: string | null;
  piridoxina: string | null;
  niacina: string | null;
  vitaminaC: string | null;
  vitaminaD: string | null;
  vitaminaE: string | null;
};

const CSV_PATH = resolve(process.cwd(), 'src/database/seeds/data/taco.csv');

const cleanToken = (value: string) => value.replace(/\uFEFF/g, '').trim();

const parseDecimal = (value: string): string | null => {
  const token = cleanToken(value).replace(',', '.');
  if (!token) return null;
  const lowered = token.toLowerCase();
  if (['na', 'n/a', 'null', 'tr', '-', '*'].includes(lowered)) return null;
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2)).toString();
};

const parseIntStrict = (value: string): number | null => {
  const token = cleanToken(value);
  if (!token) return null;
  const parsed = Number.parseInt(token, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const parseCsvLine = (line: string): string[] => {
  const output: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      output.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  output.push(current);
  return output;
};

const parseRows = (csvRaw: string): SeedRow[] => {
  const lines = csvRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const rows: SeedRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const columns = parseCsvLine(lines[lineIndex]);
    if (columns.length < 29) continue;

    const codigo = parseIntStrict(columns[0]);
    const grupo = cleanToken(columns[1]);
    const descricao = cleanToken(columns[2]);

    if (!Number.isInteger(codigo) || !grupo || !descricao) {
      continue;
    }

    rows.push({
      codigo: codigo as number,
      grupo,
      descricao,
      umidade: parseDecimal(columns[3]),
      energiaKcal: parseDecimal(columns[4]),
      energiaKj: parseDecimal(columns[5]),
      proteina: parseDecimal(columns[6]),
      lipidios: parseDecimal(columns[7]),
      colesterol: parseDecimal(columns[8]),
      carboidrato: parseDecimal(columns[9]),
      fibra: parseDecimal(columns[10]),
      cinzas: parseDecimal(columns[11]),
      calcio: parseDecimal(columns[12]),
      magnesio: parseDecimal(columns[13]),
      manganes: parseDecimal(columns[14]),
      fosforo: parseDecimal(columns[15]),
      ferro: parseDecimal(columns[16]),
      sodio: parseDecimal(columns[17]),
      potassio: parseDecimal(columns[18]),
      cobre: parseDecimal(columns[19]),
      zinco: parseDecimal(columns[20]),
      retinol: parseDecimal(columns[21]),
      tiamina: parseDecimal(columns[24]),
      riboflavina: parseDecimal(columns[25]),
      piridoxina: parseDecimal(columns[26]),
      niacina: parseDecimal(columns[27]),
      vitaminaC: parseDecimal(columns[28]),
      vitaminaD: null,
      vitaminaE: null
    });
  }

  return rows;
};

async function main() {
  if (!existsSync(CSV_PATH)) {
    throw new Error(`Arquivo TACO nao encontrado em ${CSV_PATH}`);
  }

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const repo = dataSource.getRepository(TacoFood);
  const raw = readFileSync(CSV_PATH, 'utf8');
  const rows = parseRows(raw);

  if (!rows.length) {
    throw new Error('Seed TACO nao encontrou registros validos no CSV.');
  }

  await repo.upsert(rows, ['codigo']);
  console.log(`[taco-seed] registros upsertados: ${rows.length}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[taco-seed] falha: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
