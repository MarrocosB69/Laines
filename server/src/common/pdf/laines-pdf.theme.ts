import { existsSync } from 'fs';
import { join } from 'path';

// Fonte: src/views/landing/landing-tokens.css. Impressão usa acentos pequenos.
export const PDF_THEME = {
  ink: '#262947',
  muted: '#555c78',
  subtle: '#5f6782',
  blue: '#2560a8',
  green: '#2d7a1a',
  border: '#d5dee8',
  tint: '#eaf1fa',
  pale: '#f3f8fd',
  white: '#ffffff',
  attention: '#9a3412',
  attentionTint: '#fff7ed',
  pageWidth: 595.28,
  pageHeight: 841.89,
  left: 42,
  right: 42,
  bodyTop: 112,
  // Reserve a safety band before PDFKit's own bottom margin to avoid implicit pages.
  bodyBottom: 738,
  footerTop: 789
} as const;

const assetPath = (name: string) => join(__dirname, 'assets', name);

export function registerLainesPdfFonts(doc: any) {
  const files = {
    regular: assetPath('SofiaSans-Regular.ttf'),
    bold: assetPath('SofiaSans-Bold.ttf'),
    display: assetPath('SofiaSansExtraCondensed-BlackItalic.ttf')
  };
  const available = Object.values(files).every(existsSync);
  if (available) {
    doc.registerFont('LainesRegular', files.regular);
    doc.registerFont('LainesBold', files.bold);
    doc.registerFont('LainesDisplay', files.display);
  }
  return {
    regular: available ? 'LainesRegular' : 'Helvetica',
    bold: available ? 'LainesBold' : 'Helvetica-Bold',
    display: available ? 'LainesDisplay' : 'Helvetica-BoldOblique',
    logo: existsSync(assetPath('logo-laines.png')) ? assetPath('logo-laines.png') : null
  };
}
