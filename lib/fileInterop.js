import * as XLSX from 'xlsx';

export function parseTabularFile({ filename, buffer }) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

export function buildExportFile({ format, columns, rows }) {
  const worksheetRows = rows.map((row) => {
    const output = {};
    columns.forEach((column) => {
      output[column] = row[column] ?? '';
    });
    return output;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'data');

  if (format === 'xlsx') {
    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    };
  }

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  return {
    mimeType: 'text/csv; charset=utf-8',
    extension: 'csv',
    buffer: Buffer.from(csv, 'utf-8')
  };
}
