/**
 * Converte docs/manual/manual-laines.html → docs/manual/manual-laines.docx
 * Requer: npm install html-to-docx --save-dev
 * Uso: node scripts/convert-manual-to-docx.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HTML_PATH = resolve(ROOT, 'docs/manual/manual-laines.html');
const DOCX_PATH = resolve(ROOT, 'docs/manual/manual-laines.docx');

if (!existsSync(HTML_PATH)) {
  console.error(`[convert-manual] HTML não encontrado: ${HTML_PATH}`);
  console.error('Execute primeiro: node scripts/generate-manual.mjs');
  process.exit(1);
}

console.log('[convert-manual] Lendo HTML...');
const html = readFileSync(HTML_PATH, 'utf-8');

console.log('[convert-manual] Convertendo para DOCX...');

// html-to-docx é um pacote CommonJS — importação dinâmica necessária
const { default: HTMLtoDOCX } = await import('html-to-docx');

const docxBuffer = await HTMLtoDOCX(html, null, {
  table: { row: { cantSplit: true } },
  footer: true,
  pageNumber: true,
  title: 'Manual do Usuário — Sistema LAINES',
  creator: 'LAINES / UFRN',
  description: 'Documentação completa do sistema LAINES — Liga Acadêmica Interprofissional de Nutrição Esportiva',
  font: 'Calibri',
  fontSize: '24',  // 12pt (half-points)
  lang: 'pt-BR',
  orientation: 'portrait',
  margins: {
    top: 1440,     // 1 inch in twips
    right: 1440,
    bottom: 1440,
    left: 1440
  }
});

writeFileSync(DOCX_PATH, docxBuffer);
console.log(`[convert-manual] DOCX gerado: ${DOCX_PATH}`);
