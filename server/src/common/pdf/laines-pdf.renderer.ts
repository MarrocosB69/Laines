import { PDF_THEME as T, registerLainesPdfFonts } from './laines-pdf.theme';
import { LainesPdfReport, PdfBlock, PdfChoice, PdfChoiceEntry, PdfField } from './laines-pdf.types';

type Fonts = ReturnType<typeof registerLainesPdfFonts>;

class LainesPdfComposer {
  private readonly width = T.pageWidth - T.left - T.right;
  private y: number = T.bodyTop;

  constructor(private readonly doc: any, private readonly fonts: Fonts, private readonly report: LainesPdfReport) {}

  private font(kind: 'regular' | 'bold' | 'display', size: number, color: string = T.ink) {
    this.doc.font(this.fonts[kind]).fontSize(size).fillColor(color);
  }

  private newPage() {
    this.doc.addPage({ size: 'A4', margins: { top: T.bodyTop, bottom: 74, left: T.left, right: T.right } });
    this.y = T.bodyTop;
  }

  private ensureSpace(height: number) {
    if (this.y + height > T.bodyBottom) this.newPage();
  }

  drawHeader() {
    const previousY = this.doc.y;
    this.doc.save();
    if (this.fonts.logo) this.doc.image(this.fonts.logo, T.left, 35, { fit: [39, 39] });
    this.font('display', 19, T.ink);
    this.doc.text('LAINES', T.left + 49, 35, { width: 120, lineBreak: false });
    this.font('regular', 8.5, T.muted);
    this.doc.text('Liga Acadêmica Interprofissional de Nutrição Esportiva', T.left + 49, 59,
      { width: 340, lineBreak: false });
    this.font('bold', 9, T.blue);
    this.doc.text(this.report.shortTitle || this.report.title, T.pageWidth - T.right - 155, 42,
      { width: 155, align: 'right', lineBreak: false });
    this.doc.moveTo(T.left, 88).lineTo(T.pageWidth - T.right, 88)
      .lineWidth(0.8).strokeColor(T.border).stroke();
    this.doc.restore();
    this.doc.y = previousY || T.bodyTop;
  }

  private drawFooters() {
    const pages = this.doc.bufferedPageRange();
    const date = (this.report.issuedAt || new Date()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    for (let index = 0; index < pages.count; index += 1) {
      this.doc.switchToPage(pages.start + index);
      const bottom = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 24;
      this.doc.save();
      this.doc.moveTo(T.left, T.footerTop - 9).lineTo(T.pageWidth - T.right, T.footerTop - 9)
        .lineWidth(0.6).strokeColor(T.border).stroke();
      this.font('regular', 8, T.muted);
      this.doc.text(`LAINES  ·  Emitido em ${date}`, T.left, T.footerTop,
        { width: 330, lineBreak: false });
      this.doc.text(`Página ${index + 1} de ${pages.count}`, T.pageWidth - T.right - 100, T.footerTop,
        { width: 100, align: 'right', lineBreak: false });
      this.doc.restore();
      this.doc.page.margins.bottom = bottom;
    }
  }

  render() {
    this.newPage();
    this.drawIntro();
    for (const block of this.report.blocks) this.renderBlock(block);
    this.drawFooters();
  }

  private drawIntro() {
    this.font('display', 27);
    this.doc.text(this.report.title, T.left, this.y, { width: this.width });
    this.y = this.doc.y + 3;
    if (this.report.subtitle) this.paragraph(this.report.subtitle, true);
    if (this.report.status) this.callout('Situação do documento', this.report.status, 'info');
    if (this.report.patient?.length) {
      if (this.report.patientVariant === 'compact') this.compactPatient(this.report.patient);
      else this.fields(this.report.patient, this.report.patientVariant);
    }
    this.y += 11;
  }

  private compactPatient(items: PdfField[]) {
    const [person, ...details] = items;
    this.font('regular', 8.5, T.muted);
    this.doc.text(person.label.toUpperCase(), T.left, this.y, { width: this.width });
    this.y = this.doc.y + 2;
    this.font('bold', 13);
    this.doc.text(person.value || '—', T.left, this.y, { width: this.width });
    this.y = this.doc.y + 4;
    const professional = details.find((item) => item.label === 'Profissional');
    const detail = details.filter((item) => item !== professional)
      .map((item) => `${item.label}: ${item.value || '—'}`).join('    ·    ');
    if (detail) {
      this.font('regular', 9, T.muted);
      this.doc.text(detail, T.left, this.y, { width: this.width, lineGap: 2 });
      this.y = this.doc.y + 5;
    }
    if (professional) {
      this.font('regular', 9, T.muted);
      this.doc.text(`${professional.label}: ${professional.value}`, T.left, this.y,
        { width: this.width });
      this.y = this.doc.y + 5;
    }
    this.doc.moveTo(T.left, this.y).lineTo(T.left + this.width, this.y)
      .lineWidth(0.6).strokeColor(T.border).stroke();
  }

  private renderBlock(block: PdfBlock): void {
    switch (block.kind) {
      case 'section': return this.section(block.title, block.blocks, false, block.minHeight);
      case 'subsection': return this.section(block.title, block.blocks, true);
      case 'paragraph': return this.paragraph(block.text, block.subtle);
      case 'fields': return this.fields(block.items, block.variant);
      case 'metrics': return this.metrics(block.items);
      case 'table': return this.table(block.columns, block.rows, block.emptyText,
        block.continuationTitle, block.variant);
      case 'choiceList': return this.choiceList(block.title, block.time, block.entries,
        block.unlinked, block.note);
      case 'callout': return this.callout(block.title, block.text, block.tone);
      case 'image': return this.image(block.source, block.title, block.caption, block.unit, block.maxHeight);
      case 'signature': return this.signature(block.name, block.area, block.registration, block.institution);
    }
  }

  private section(title: string, blocks: PdfBlock[], minor: boolean, minHeight = 0) {
    // Keep the heading with at least the first lines of its content.
    this.ensureSpace(Math.min(T.bodyBottom - T.bodyTop, Math.max(minor ? 78 : 88, minHeight)));
    this.y += minor ? 9 : 14;
    if (minor) {
      this.font('bold', 10.5);
      this.doc.text(title, T.left, this.y, { width: this.width });
      this.y = this.doc.y + 8;
    } else {
      this.doc.rect(T.left, this.y + 2, 3, 15).fill(T.green);
      this.font('bold', 12);
      this.doc.text(title, T.left + 12, this.y, { width: this.width - 12 });
      this.y = this.doc.y + 10;
    }
    for (const block of blocks) this.renderBlock(block);
  }

  private paragraph(text: string, subtle = false) {
    if (!text?.trim()) return;
    this.font('regular', 9.5, subtle ? T.muted : T.ink);
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.doc.widthOfString(candidate) <= this.width) { line = candidate; continue; }
        if (line) lines.push(line);
        line = '';
        for (const character of word) {
          if (this.doc.widthOfString(line + character) > this.width && line) {
            lines.push(line);
            line = '';
          }
          line += character;
        }
      }
      lines.push(line);
    }
    const lineHeight = this.doc.currentLineHeight() + 2;
    for (const line of lines) {
      this.ensureSpace(lineHeight + 2);
      // A page header changes PDFKit's font; restore the body font after a page break.
      this.font('regular', 9.5, subtle ? T.muted : T.ink);
      this.doc.text(line || ' ', T.left, this.y, { width: this.width, lineBreak: false });
      this.y += lineHeight;
    }
    this.y += 9;
  }

  private fields(items: PdfField[], variant: 'card' | 'plain' = 'card') {
    const gap = 10;
    const cellWidth = (this.width - gap) / 2;
    for (let i = 0; i < items.length; i += 2) {
      const pair = items.slice(i, i + 2);
      const heights = pair.map((item) => {
        this.font('bold', 10);
        return Math.max(variant === 'plain' ? 35 : 44,
          this.doc.heightOfString(item.value || '—', { width: cellWidth - 20 }) + (variant === 'plain' ? 21 : 29));
      });
      const height = Math.max(...heights);
      this.ensureSpace(height + (variant === 'plain' ? 8 : 6));
      pair.forEach((item, column) => {
        const x = T.left + column * (cellWidth + gap);
        if (variant === 'card') this.doc.roundedRect(x, this.y, cellWidth, height, 7)
          .fillAndStroke(T.pale, T.border);
        this.font('bold', 8, T.muted);
        this.doc.text(item.label.toUpperCase(), x + (variant === 'plain' ? 0 : 10), this.y + (variant === 'plain' ? 1 : 8),
          { width: cellWidth - 20, lineBreak: false });
        this.font('bold', 10);
        this.doc.text(item.value || '—', x + (variant === 'plain' ? 0 : 10), this.y + (variant === 'plain' ? 16 : 23),
          { width: cellWidth - 20 });
        if (variant === 'plain') this.doc.moveTo(x, this.y + height).lineTo(x + cellWidth, this.y + height)
          .lineWidth(0.45).strokeColor(T.border).stroke();
      });
      this.y += height + (variant === 'plain' ? 8 : 6);
    }
  }

  private metrics(items: { label: string; value: string; unit?: string }[]) {
    const gap = 8;
    for (let i = 0; i < items.length; i += 3) {
      const row = items.slice(i, i + 3);
      const width = (this.width - gap * 2) / 3;
      this.ensureSpace(63);
      row.forEach((item, column) => {
        const x = T.left + column * (width + gap);
        this.doc.roundedRect(x, this.y, width, 55, 7).fillAndStroke(T.white, T.border);
        this.font('bold', 8, T.muted);
        this.doc.text(item.label.toUpperCase(), x + 10, this.y + 8,
          { width: width - 20, lineBreak: false });
        this.font('bold', 15, T.ink);
        this.doc.text(`${item.value}${item.unit ? ` ${item.unit}` : ''}`, x + 10, this.y + 25,
          { width: width - 20, lineBreak: false });
      });
      this.y += 63;
    }
  }

  private choiceHeight(item: PdfChoice, width: number, primary = false) {
    if (primary) {
      this.font('bold', 11.5);
      const nameWidth = this.doc.widthOfString(item.name);
      const name = this.doc.heightOfString(item.name, { width, lineGap: 1 });
      this.font('regular', 10, T.muted);
      const detailWidth = this.doc.widthOfString(`· ${item.quantity}`);
      const quantity = this.doc.heightOfString(item.quantity, { width, lineGap: 1 });
      return nameWidth + detailWidth + 16 < width ? Math.max(name, quantity) + 5
        : name + quantity + 5;
    }
    this.font('regular', 10.5);
    const value = this.doc.heightOfString(`${item.name} · ${item.quantity}`,
      { width, lineGap: 1.2 });
    this.font('regular', 9.5, T.muted);
    return value + (item.note ? this.doc.heightOfString(item.note, { width }) + 2 : 0) + 3;
  }

  private drawChoice(item: PdfChoice, x: number, top: number, width: number, primary = false) {
    if (primary) {
      this.font('bold', 11.5);
      const nameWidth = this.doc.widthOfString(item.name);
      this.font('regular', 10, T.muted);
      const detailWidth = this.doc.widthOfString(`· ${item.quantity}`);
      const inline = nameWidth + detailWidth + 16 < width;
      this.font('bold', 11.5);
      this.doc.text(item.name, x, top, { width: inline ? nameWidth + 2 : width,
        lineBreak: !inline, lineGap: 1 });
      this.font('regular', 10, T.muted);
      this.doc.text(inline ? `· ${item.quantity}` : item.quantity,
        inline ? x + nameWidth + 10 : x, inline ? top + 1 : this.doc.y + 2,
        { width: inline ? width - nameWidth - 10 : width, lineBreak: !inline, lineGap: 1 });
      return;
    }
    this.font('regular', 10.5);
    this.doc.text(`${item.name} · ${item.quantity}`, x, top, { width, lineGap: 1.2 });
    if (item.note) {
      this.font('regular', 9.5, T.muted);
      this.doc.text(item.note, x, this.doc.y + 2, { width });
    }
  }

  private choicesHeight(items: PdfChoice[], width: number) {
    return items.reduce((sum, item, index) =>
      sum + this.choiceHeight(item, width) + (index ? 13 : 0), 0);
  }

  private drawChoices(items: PdfChoice[], x: number, top: number, width: number) {
    let y = top;
    items.forEach((item, index) => {
      if (index) {
        this.font('bold', 8.2, T.blue);
        this.doc.text('OU', x, y + 2, { width: 25, lineBreak: false });
        y += 13;
      }
      this.drawChoice(item, x, y, width);
      y += this.choiceHeight(item, width);
    });
  }

  private choiceHeadingHeight(title: string, time?: string, continued = false) {
    this.font('bold', 13.5);
    const name = `${title}${continued ? ' (continuação)' : ''}`;
    const nameWidth = this.doc.widthOfString(name);
    const nameHeight = this.doc.heightOfString(name, { width: this.width - 12 });
    if (!time) return 8 + Math.max(nameHeight, 16) + 10;
    this.font('bold', 11.5, T.blue);
    const inline = nameWidth + this.doc.widthOfString(time) + 32 < this.width;
    return 8 + Math.max(nameHeight, 16) + (inline ? 10 : 27);
  }

  private drawChoiceHeading(title: string, time?: string, continued = false) {
    this.y += 8;
    const name = `${title}${continued ? ' (continuação)' : ''}`;
    this.doc.rect(T.left, this.y + 2, 3, 15).fill(T.green);
    this.font('bold', 13.5);
    const nameWidth = this.doc.widthOfString(name);
    this.doc.text(name, T.left + 12, this.y, { width: this.width - 12 });
    const titleBottom = this.doc.y;
    if (time) {
      this.font('bold', 11.5, T.blue);
      const inline = nameWidth + this.doc.widthOfString(time) + 32 < this.width;
      this.doc.text(time, inline ? T.left + nameWidth + 23 : T.left + 12,
        inline ? this.y + 2 : titleBottom + 3,
        { width: this.width - (inline ? nameWidth + 23 : 12), lineBreak: false });
      this.y = inline ? titleBottom + 8 : this.doc.y + 8;
    } else {
      this.y = titleBottom + 8;
    }
    this.doc.moveTo(T.left, this.y).lineTo(T.left + this.width, this.y)
      .lineWidth(0.65).strokeColor(T.border).stroke();
  }

  private choiceRowHeight(entry: PdfChoiceEntry, alternatives: PdfChoice[]) {
    const primary = this.choiceHeight(entry.primary, this.width - 6, true);
    return primary + (alternatives.length
      ? this.choicesHeight(alternatives, this.width - 37) + 32 : 14);
  }

  private drawChoiceRow(entry: PdfChoiceEntry, alternatives: PdfChoice[]) {
    const top = this.y;
    const height = this.choiceRowHeight(entry, alternatives);
    const primaryHeight = this.choiceHeight(entry.primary, this.width - 6, true);
    this.drawChoice(entry.primary, T.left + 3, top + 8, this.width - 6, true);
    if (alternatives.length) {
      const arrowX = T.left + 13;
      const arrowY = top + 8 + primaryHeight - 2;
      this.doc.save().strokeColor(T.green).lineWidth(1.25)
        .moveTo(arrowX, arrowY).lineTo(arrowX, arrowY + 7)
        .bezierCurveTo(arrowX, arrowY + 10, arrowX + 3, arrowY + 12, arrowX + 6, arrowY + 12)
        .lineTo(arrowX + 14, arrowY + 12).stroke();
      this.doc.moveTo(arrowX + 10, arrowY + 9).lineTo(arrowX + 14, arrowY + 12)
        .lineTo(arrowX + 10, arrowY + 15).stroke();
      this.doc.restore();
      this.font('bold', 9.5, T.ink);
      this.doc.text('Substitutos', T.left + 33, arrowY + 1,
        { width: this.width - 37, lineBreak: false });
      this.drawChoices(alternatives, T.left + 33, arrowY + 18, this.width - 37);
    }
    this.doc.moveTo(T.left, top + height).lineTo(T.left + this.width, top + height)
      .lineWidth(0.45).strokeColor(T.border).stroke();
    this.y = top + height;
  }

  private choiceList(title: string, time: string | undefined,
    entries: PdfChoiceEntry[], unlinked: PdfChoice[] = [], note?: string) {
    const noteText = note?.trim() || '';
    this.font('regular', 9.5);
    const noteHeight = noteText ? this.doc.heightOfString(noteText, { width: this.width }) + 34 : 0;
    const first = entries[0];
    const firstRow = first ? this.choiceRowHeight(first, first.alternatives.slice(0, 1)) : 34;
    const headingHeight = this.choiceHeadingHeight(title, time);
    const completeHeight = headingHeight + noteHeight + entries.reduce((sum, entry) =>
      sum + this.choiceRowHeight(entry, entry.alternatives), 0) + 12;
    this.ensureSpace(!unlinked.length && completeHeight <= 160
      ? completeHeight : headingHeight + firstRow + 10);
    this.drawChoiceHeading(title, time);
    for (const [entryIndex, entry] of entries.entries()) {
      const lastEntry = entryIndex === entries.length - 1;
      const pending = [...entry.alternatives];
      if (!pending.length) {
        const rowHeight = this.choiceRowHeight(entry, []);
        const freshCapacity = T.bodyBottom - T.bodyTop
          - this.choiceHeadingHeight(title, time, true);
        if (rowHeight > freshCapacity) {
          this.paragraph(`Alimento prescrito: ${entry.primary.name} · ${entry.primary.quantity}`);
          if (entry.primary.note) this.paragraph(entry.primary.note, true);
          continue;
        }
        const canKeepNote = rowHeight + noteHeight <= T.bodyBottom - T.bodyTop
          - this.choiceHeadingHeight(title, time, true);
        if (this.y + rowHeight + (lastEntry && canKeepNote ? noteHeight : 0) > T.bodyBottom) {
          this.newPage();
          this.drawChoiceHeading(title, time, true);
        }
        this.drawChoiceRow(entry, []);
        continue;
      }
      let continued = false;
      while (pending.length) {
        const current = continued ? { ...entry,
          primary: { ...entry.primary, name: `${entry.primary.name} (continuação)` } } : entry;
        let count = 0;
        for (let index = 1; index <= pending.length; index += 1) {
          const height = this.choiceRowHeight(current, pending.slice(0, index));
          const canKeepNote = height + noteHeight <= T.bodyBottom - T.bodyTop
            - this.choiceHeadingHeight(title, time, true);
          const noteSpace = lastEntry && index === pending.length && canKeepNote ? noteHeight : 0;
          if (this.y + height + noteSpace > T.bodyBottom) break;
          count = index;
        }
        if (!count) {
          const freshCapacity = T.bodyBottom - T.bodyTop - this.choiceHeadingHeight(title, time, true);
          const firstHeight = this.choiceRowHeight(current, pending.slice(0, 1));
          if (firstHeight > freshCapacity) {
            this.paragraph(`Alimento prescrito: ${current.primary.name} · ${current.primary.quantity}`);
            const alternative = pending.shift()!;
            this.paragraph(`Se precisar trocar: ${alternative.name} · ${alternative.quantity}`);
            if (alternative.note) this.paragraph(alternative.note, true);
            continued = true;
            continue;
          }
          this.newPage();
          this.drawChoiceHeading(title, time, true);
          continue;
        }
        this.drawChoiceRow(current, pending.splice(0, count));
        if (pending.length) {
          continued = true;
          this.newPage();
          this.drawChoiceHeading(title, time, true);
        }
      }
    }
    if (!entries.length) this.paragraph('Nenhum alimento registrado nesta refeição.', true);
    if (unlinked.length) this.unlinkedChoices(unlinked);
    if (noteText) {
      if (this.y + Math.min(noteHeight, 65) > T.bodyBottom) {
        this.newPage();
        this.drawChoiceHeading(title, time, true);
      }
      this.mealGuidance(noteText);
    }
    this.y += 5;
  }

  private mealGuidance(text: string) {
    this.y += 9;
    this.font('bold', 8.5, T.muted);
    this.doc.text('ORIENTAÇÃO DA REFEIÇÃO', T.left + 3, this.y,
      { width: this.width - 3, lineBreak: false });
    this.y = this.doc.y + 3;
    this.paragraph(text);
  }

  private unlinkedChoices(items: PdfChoice[]) {
    this.section('Alternativas sem vínculo registrado', [], true);
    this.paragraph('O registro original não informa qual alimento cada alternativa substitui.', true);
    for (const item of items) {
      const height = this.choiceHeight(item, this.width - 6) + 16;
      if (height > T.bodyBottom - T.bodyTop - 20) {
        this.paragraph(`${item.name} · ${item.quantity}`);
        if (item.note) this.paragraph(item.note, true);
        continue;
      }
      this.ensureSpace(height);
      const top = this.y;
      this.drawChoice(item, T.left + 3, top + 8, this.width - 6);
      this.doc.moveTo(T.left, top + height).lineTo(T.left + this.width, top + height)
        .lineWidth(0.45).strokeColor(T.border).stroke();
      this.y = top + height;
    }
  }

  private table(columns: { label: string; width: number; align?: 'left' | 'right' }[], rows: string[][],
    emptyText?: string, continuationTitle?: string, variant: 'striped' | 'plain' = 'striped') {
    if (!columns.length) return;
    if (!rows.length) return this.paragraph(emptyText || 'Nenhum item registrado.', true);
    const weight = columns.reduce((sum, column) => sum + Math.max(0, column.width), 0);
    if (weight <= 0) throw new Error('Tabela PDF sem larguras válidas.');
    const widths = columns.map((column) => this.width * Math.max(0, column.width) / weight);
    const positions = widths.map((_, index) => T.left + widths.slice(0, index).reduce((sum, value) => sum + value, 0));
    this.font('bold', 8.5);
    const headerHeight = Math.max(variant === 'plain' ? 22 : 25, ...columns.map((column, index) =>
      this.doc.heightOfString(column.label, { width: widths[index] - 12, lineGap: 1 }) + 12));
    const drawHead = () => {
      this.ensureSpace(headerHeight + 26);
      const top = this.y;
      if (variant === 'striped') this.doc.rect(T.left, top, this.width, headerHeight).fill(T.tint);
      columns.forEach((column, index) => {
        this.font('bold', variant === 'plain' ? 8 : 8.5, variant === 'plain' ? T.muted : T.ink);
        this.doc.text(column.label, positions[index] + 6, top + 6,
          { width: widths[index] - 12, align: column.align || 'left', lineGap: 1 });
      });
      if (variant === 'plain') this.doc.moveTo(T.left, top + headerHeight)
        .lineTo(T.left + this.width, top + headerHeight).lineWidth(0.65).strokeColor(T.border).stroke();
      this.y = top + headerHeight;
    };
    drawHead();
    rows.forEach((row, rowIndex) => {
      this.font('regular', 8.8);
      const values = columns.map((_, index) => String(row[index] ?? '—'));
      const height = Math.max(variant === 'plain' ? 24 : 25, ...values.map((value, index) =>
        this.doc.heightOfString(value, { width: widths[index] - 12, lineGap: 1.5 }) + 12));
      if (height > T.bodyBottom - T.bodyTop - headerHeight - 12) {
        this.ensureSpace(40);
        values.forEach((value, index) => this.paragraph(`${columns[index].label}: ${value}`));
        return;
      }
      if (this.y + height > T.bodyBottom) {
        this.newPage();
        if (continuationTitle) {
          this.font('bold', 10.5);
          this.doc.text(continuationTitle, T.left, this.y, { width: this.width });
          this.y = this.doc.y + 8;
        }
        drawHead();
      }
      const top = this.y;
      if (variant === 'striped' && rowIndex % 2 === 1) this.doc.rect(T.left, top, this.width, height).fill(T.pale);
      values.forEach((value, index) => {
        this.font('regular', 8.8);
        this.doc.text(value, positions[index] + 6, top + 6,
          { width: widths[index] - 12, align: columns[index].align || 'left', lineGap: 1.5 });
      });
      this.doc.moveTo(T.left, top + height).lineTo(T.left + this.width, top + height)
        .lineWidth(0.45).strokeColor(T.border).stroke();
      this.y = top + height;
    });
    this.y += 7;
  }

  private callout(title: string | undefined, text: string, tone: 'neutral' | 'info' | 'attention' = 'neutral') {
    if (!text?.trim()) return;
    this.font('regular', 9.2);
    const textHeight = this.doc.heightOfString(text, { width: this.width - 28, lineGap: 2 });
    const height = textHeight + (title ? 29 : 18);
    if (height > T.bodyBottom - T.bodyTop) {
      if (title) this.section(title, [], true);
      this.paragraph(text);
      return;
    }
    this.ensureSpace(height + 8);
    const top = this.y;
    const background = tone === 'attention' ? T.attentionTint : T.tint;
    const accent = tone === 'attention' ? T.attention : tone === 'info' ? T.blue : T.green;
    this.doc.roundedRect(T.left, top, this.width, height, 7).fill(background);
    this.doc.rect(T.left, top + 5, 3, height - 10).fill(accent);
    let textTop = top + 9;
    if (title) {
      this.font('bold', 9.5, T.ink);
      this.doc.text(title, T.left + 13, textTop, { width: this.width - 26, lineBreak: false });
      textTop += 16;
    }
    this.font('regular', 9.2, T.ink);
    this.doc.text(text, T.left + 13, textTop, { width: this.width - 26, lineGap: 2 });
    this.y = top + height + 8;
  }

  private image(source: string | Buffer, title?: string, caption?: string, unit?: string, requestedMaxHeight?: number) {
    let opened: any;
    try { opened = this.doc.openImage(source); } catch {
      this.paragraph('Imagem não disponível nesta exportação.', true);
      return;
    }
    const maxWidth = this.width;
    const maxHeight = Number.isFinite(requestedMaxHeight) && Number(requestedMaxHeight) > 0
      ? Math.min(335, Number(requestedMaxHeight)) : 335;
    const scale = Math.min(maxWidth / opened.width, maxHeight / opened.height, 1);
    const width = opened.width * scale;
    const height = opened.height * scale;
    this.font('regular', 8.5);
    const captionHeight = caption ? this.doc.heightOfString(caption, { width: this.width }) + 5 : 0;
    this.ensureSpace(height + captionHeight + (title ? 28 : 0) + 16);
    if (title) {
      this.font('bold', 10);
      this.doc.text(`${title}${unit ? ` (${unit})` : ''}`, T.left, this.y, { width: this.width });
      this.y = this.doc.y + 8;
    }
    this.doc.image(source, T.left + (this.width - width) / 2, this.y, { width, height });
    this.y += height + 6;
    if (caption) this.paragraph(caption, true);
  }

  private signature(name?: string, area?: string, registration?: string, institution?: string) {
    if (!name) return;
    const detail = [area, registration, institution].filter(Boolean).join(' · ');
    this.font('bold', 9.5);
    const nameHeight = this.doc.heightOfString(name, { width: 250 });
    this.font('regular', 8.5);
    const detailHeight = detail ? this.doc.heightOfString(detail, { width: 350 }) : 0;
    this.ensureSpace(7 + nameHeight + detailHeight + 27);
    this.y += 7;
    this.doc.moveTo(T.left, this.y).lineTo(T.left + 250, this.y)
      .lineWidth(0.8).strokeColor(T.muted).stroke();
    this.y += 6;
    this.font('regular', 7.5, T.muted);
    this.doc.text('Espaço para assinatura manual, quando aplicável', T.left, this.y, { width: 280 });
    this.y = this.doc.y + 5;
    this.font('bold', 9.5);
    this.doc.text(name, T.left, this.y, { width: 250 });
    this.y = this.doc.y + 2;
    this.font('regular', 8.5, T.muted);
    if (detail) this.doc.text(detail, T.left, this.y, { width: 350 });
    this.y = this.doc.y + 6;
  }
}

export function renderLainesPdf(report: LainesPdfReport): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true,
      info: { Title: report.title, Author: 'LAINES', Subject: report.shortTitle || report.title } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      const fonts = registerLainesPdfFonts(doc);
      const composer = new LainesPdfComposer(doc, fonts, report);
      doc.on('pageAdded', () => composer.drawHeader());
      composer.render();
      doc.end();
    } catch (error) { reject(error); }
  });
}
