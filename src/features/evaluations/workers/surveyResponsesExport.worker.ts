import * as XLSX from 'xlsx';

self.addEventListener('message', (event: MessageEvent<{ columns: string[]; rows: (string | number)[][] }>) => {
  try {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([event.data.columns, ...event.data.rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Responses');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    self.postMessage({ bytes }, { transfer: [bytes] });
  } catch {
    self.postMessage({ error: 'Could not create the Excel file.' });
  }
});
