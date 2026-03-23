const CSV_DELIMITER = ';';

const stringifyCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const normalized = String(value);
  if (
    normalized.includes('"')
    || normalized.includes('\n')
    || normalized.includes('\r')
    || normalized.includes(CSV_DELIMITER)
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

export const downloadCsv = ({ filename, headers, rows }) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const headerLine = headers.map(stringifyCsvValue).join(CSV_DELIMITER);
  const bodyLines = rows.map((row) => row.map(stringifyCsvValue).join(CSV_DELIMITER));
  const csv = [headerLine, ...bodyLines].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};
