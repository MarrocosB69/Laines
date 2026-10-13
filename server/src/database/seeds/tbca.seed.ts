import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import dataSource from '../typeorm.config';

/**
 * Carrega a TBCA 7.0 (INA/POF 2017-2018) no catalogo de alimentos.
 *
 * O arquivo original e desmembrado por ingrediente: a composicao de um
 * alimento so aparece somando as linhas do grupo (cod_pof, prep_pof, cod_tbca).
 * Essa agregacao ja foi feita na geracao do CSV — aqui a leitura e direta.
 *
 * Reexecutar e seguro: o upsert usa (fonte, codigo_texto).
 */

const CSV_PATH = resolve(process.cwd(), 'src/database/seeds/data/tbca.csv');
const LOTE = 200;

// Divide respeitando aspas: descricoes da TBCA tem virgula ("Arroz, polido").
const partirLinha = (linha: string): string[] => {
  const campos: string[] = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') { atual += '"'; i += 1; }
      else entreAspas = !entreAspas;
    } else if (c === ',' && !entreAspas) {
      campos.push(atual); atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
};

const numero = (valor: string): number | null => {
  const t = String(valor ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

async function main() {
  if (!existsSync(CSV_PATH)) {
    throw new Error(`CSV da TBCA nao encontrado em ${CSV_PATH}`);
  }

  const linhas = readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const cabecalho = partirLinha(linhas[0]);
  const registros = linhas.slice(1).map((l) => {
    const campos = partirLinha(l);
    const obj: Record<string, string> = {};
    cabecalho.forEach((h, i) => { obj[h] = campos[i] ?? ''; });
    return obj;
  });

  await dataSource.initialize();
  console.log(`[tbca] ${registros.length} alimentos no CSV`);

  // Colunas numericas: o nome no CSV e o mesmo da coluna no banco.
  const numericas = cabecalho.filter((h) => !['codigo', 'descricao', 'grupo', 'tipo', 'nome_ingles'].includes(h));
  const colunas = ['fonte', 'codigo', 'codigo_texto', 'descricao', 'grupo', 'tipo_alimento', 'nome_ingles', ...numericas];

  let gravados = 0;
  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = registros.slice(i, i + LOTE);
    const valores: unknown[] = [];
    const marcadores = lote.map((r, idxLote) => {
      const base = idxLote * colunas.length;
      valores.push(
        'TBCA',
        // A coluna `codigo` e inteira e obrigatoria desde a TACO; o codigo
        // real da TBCA e alfanumerico e vive em `codigo_texto`.
        i + idxLote + 1,
        r.codigo,
        r.descricao,
        r.grupo,
        r.tipo,
        r.nome_ingles || null,
        ...numericas.map((n) => numero(r[n]))
      );
      return `(${colunas.map((_, k) => `$${base + k + 1}`).join(', ')})`;
    });

    await dataSource.query(
      `INSERT INTO "taco" (${colunas.map((c) => `"${c}"`).join(', ')})
       VALUES ${marcadores.join(', ')}
       ON CONFLICT ("fonte", "codigo_texto") WHERE "codigo_texto" IS NOT NULL
       DO UPDATE SET ${[...numericas, 'descricao', 'grupo', 'tipo_alimento', 'nome_ingles']
         .map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')}`,
      valores
    );
    gravados += lote.length;
  }

  const [{ total }] = await dataSource.query(
    `SELECT COUNT(*)::int AS total FROM "taco" WHERE "fonte" = 'TBCA'`
  );
  console.log(`[tbca] gravados ${gravados} · na base: ${total}`);
  await dataSource.destroy();
}

main().catch((erro) => {
  console.error('[tbca] falhou:', erro?.message || erro);
  process.exit(1);
});
