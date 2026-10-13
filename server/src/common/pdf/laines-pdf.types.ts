export type PdfTone = 'neutral' | 'info' | 'attention';

export type PdfField = { label: string; value: string };
export type PdfMetric = { label: string; value: string; unit?: string };
export type PdfColumn = { label: string; width: number; align?: 'left' | 'right' };
export type PdfChoice = { name: string; quantity: string; note?: string };
export type PdfChoiceEntry = { primary: PdfChoice; alternatives: PdfChoice[] };

export type PdfBlock =
  | { kind: 'section'; title: string; blocks: PdfBlock[]; minHeight?: number }
  | { kind: 'subsection'; title: string; blocks: PdfBlock[] }
  | { kind: 'paragraph'; text: string; subtle?: boolean }
  | { kind: 'fields'; items: PdfField[]; variant?: 'card' | 'plain' }
  | { kind: 'metrics'; items: PdfMetric[] }
  | { kind: 'table'; columns: PdfColumn[]; rows: string[][]; emptyText?: string;
    continuationTitle?: string; variant?: 'striped' | 'plain' }
  | { kind: 'choiceList'; title: string; time?: string; entries: PdfChoiceEntry[];
    unlinked?: PdfChoice[]; note?: string }
  | { kind: 'callout'; title?: string; text: string; tone?: PdfTone }
  | { kind: 'image'; source: string | Buffer; title?: string; caption?: string;
    unit?: string; maxHeight?: number }
  | { kind: 'signature'; name?: string; area?: string; registration?: string; institution?: string };

export type LainesPdfReport = {
  title: string;
  shortTitle?: string;
  subtitle?: string;
  patient?: PdfField[];
  patientVariant?: 'card' | 'plain' | 'compact';
  issuedAt?: Date;
  status?: string;
  blocks: PdfBlock[];
};
