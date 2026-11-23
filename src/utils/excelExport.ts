import * as XLSX from 'xlsx';
import type { MatrixResponse } from '../types';

export function exportMatrixToExcel(className: string, matrix: MatrixResponse): void {
  const headers = [
    'Öğrenci No',
    'Ad Soyad',
    'Proje Adı',
    ...matrix.courses.map((c) => `${c.name} (${c.short_code})`),
    'Ortalama',
  ];

  const dataRows = matrix.rows.map((row) => [
    row.student_no,
    row.full_name,
    row.project_title ?? '-',
    ...matrix.courses.map((c) => {
      const val = row.scores[String(c.id)];
      return val !== undefined ? val : '';
    }),
    row.average !== null ? row.average : '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 30 },
    ...matrix.courses.map(() => ({ wch: 22 })),
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Proje Notları');
  const safeName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Proje_Not_Cizelgesi_${safeName}.xlsx`);
}
