type RegistroFila = {
  posicaoFila: number;
  nome: string;
  prontuario: string;
  createdAt: Date | string;
};

export type LinhaRelatorioTriagem = {
  posicao: number;
  nome: string;
  protocolo: string;
  dataInscricao: string;
};

const texto = (value: unknown, max = 120) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const data = (value: Date | string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo'
  }).format(parsed);
};

export function projetarRelatorioTriagem(fila: RegistroFila[]): LinhaRelatorioTriagem[] {
  return fila.map((item) => ({
    posicao: item.posicaoFila,
    nome: texto(item.nome),
    protocolo: texto(item.prontuario, 40),
    dataInscricao: data(item.createdAt)
  }));
}

export function gerarRelatorioTriagemPdf(linhas: LinhaRelatorioTriagem[]): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 42;
    const right = doc.page.width - 42;
    const bottom = doc.page.height - 42;
    const columns = [left, left + 54, left + 290, left + 401];
    const widths = [48, 228, 104, right - columns[3]];
    const header = () => {
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#17334b')
        .text('LAINES | Fila de triagem pública', left, 42);
      doc.font('Helvetica').fontSize(9).fillColor('#475569')
        .text(`Uso interno • Gerado em ${data(new Date())} • ${linhas.length} inscrição(ões)`, left, 67);
      doc.moveTo(left, 88).lineTo(right, 88).strokeColor('#d4dde5').stroke();
      doc.y = 100;
      const titles = ['Posição', 'Nome', 'Protocolo', 'Inscrição'];
      const headingY = doc.y;
      titles.forEach((title, index) => doc.font('Helvetica-Bold').fontSize(9)
        .fillColor('#17334b').text(title, columns[index], headingY, { width: widths[index] }));
      doc.y = 122;
    };
    header();
    if (!linhas.length) {
      doc.font('Helvetica').fontSize(10).fillColor('#475569')
        .text('Nenhuma inscrição pública aguarda contato.', left, doc.y);
    }
    linhas.forEach((item) => {
      doc.font('Helvetica').fontSize(9);
      const values = [String(item.posicao), item.nome, item.protocolo, item.dataInscricao];
      const height = Math.max(28, ...values.map((value, column) =>
        doc.heightOfString(value, { width: widths[column] }) + 12));
      if (doc.y + height > bottom) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      values.forEach((value, column) => doc.fillColor('#24364b')
        .text(value, columns[column], y + 6, { width: widths[column] }));
      doc.moveTo(left, y + height).lineTo(right, y + height).strokeColor('#e5eaf0').stroke();
      doc.y = y + height;
    });
    doc.end();
  });
}
