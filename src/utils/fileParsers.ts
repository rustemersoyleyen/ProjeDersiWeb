import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';

// Vite ile uyumlu PDF.js worker yapılandırması
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ParsedStudentRow {
  student_no: string;
  full_name: string;
  project_title?: string;
}

function normalizeHeader(h: string): string {
  return h
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

function extractFromRows(rows: string[][]): ParsedStudentRow[] {
  const cleaned = rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''));

  if (cleaned.length === 0) return [];

  // Başlık satırını tespit et
  let headerIdx = -1;
  let noCol = -1;
  let fullNameCol = -1;
  let firstNameCol = -1;
  let lastNameCol = -1;
  let projectCol = -1;

  for (let i = 0; i < Math.min(cleaned.length, 10); i++) {
    const norms = cleaned[i].map(normalizeHeader);
    const hasNo = norms.findIndex((c) =>
      ['no', 'ogrencino', 'okulno', 'numara', 'numarasi', 'ogrno', 'studentno'].includes(c)
    );
    const hasFull = norms.findIndex((c) =>
      ['adsoyad', 'adisoyadi', 'ogrenciadi', 'ogrenci', 'fullname', 'adivesoyadi'].includes(c)
    );
    const hasFirst = norms.findIndex((c) => ['ad', 'adi', 'isim', 'ismi'].includes(c));
    const hasLast = norms.findIndex((c) => ['soyad', 'soyadi'].includes(c));
    const hasProj = norms.findIndex((c) =>
      ['proje', 'projeadi', 'projekonusu', 'project'].includes(c)
    );

    if (hasNo !== -1 || hasFull !== -1 || (hasFirst !== -1 && hasLast !== -1)) {
      headerIdx = i;
      noCol = hasNo;
      fullNameCol = hasFull;
      firstNameCol = hasFirst;
      lastNameCol = hasLast;
      projectCol = hasProj;
      break;
    }
  }

  const startRow = headerIdx !== -1 ? headerIdx + 1 : 0;
  const result: ParsedStudentRow[] = [];
  const seen = new Set<string>();

  for (let i = startRow; i < cleaned.length; i++) {
    const row = cleaned[i];
    let studentNo = '';
    let fullName = '';
    let projectTitle = '';

    if (headerIdx !== -1) {
      if (noCol !== -1) studentNo = row[noCol] ?? '';
      if (fullNameCol !== -1) {
        fullName = row[fullNameCol] ?? '';
      } else if (firstNameCol !== -1 || lastNameCol !== -1) {
        fullName = `${row[firstNameCol] ?? ''} ${row[lastNameCol] ?? ''}`.trim();
      }
      if (projectCol !== -1) projectTitle = row[projectCol] ?? '';
    } else {
      // Başlıksız tablo: Sayısal sütunu no, metin sütunlarını ad soyad al
      const nonEmpty = row.filter((c) => c !== '');
      if (nonEmpty.length >= 2) {
        if (/^\d{1,6}$/.test(nonEmpty[0])) {
          studentNo = nonEmpty[0];
          // 2. sütun da sıra no ise (e-Okul: Sıra | No | Ad | Soyad)
          if (nonEmpty.length >= 3 && /^\d{1,6}$/.test(nonEmpty[1])) {
            studentNo = nonEmpty[1];
            fullName = nonEmpty.slice(2, 4).join(' ');
          } else {
            fullName = nonEmpty.slice(1, 3).join(' ');
          }
        }
      }
    }

    studentNo = studentNo.replace(/\s+/g, '');
    fullName = fullName.replace(/\s+/g, ' ').trim();

    if (studentNo && fullName && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(fullName)) {
      const key = `${studentNo}|${fullName}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          student_no: studentNo,
          full_name: fullName,
          project_title: projectTitle || undefined,
        });
      }
    }
  }

  return result;
}

export async function parseExcelFile(file: File): Promise<ParsedStudentRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, raw: false });
  return extractFromRows(rows);
}

export async function parseCsvFile(file: File): Promise<ParsedStudentRow[]> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      skipEmptyLines: true,
      complete: (res) => resolve(extractFromRows(res.data)),
      error: (err: Error) => reject(err),
    });
  });
}

export async function parsePdfFile(file: File): Promise<ParsedStudentRow[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Öğeleri Y koordinatına göre satırlara grupla (e-Okul sınıf listeleri için ideal)
    const rowMap = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = item.str.trim();
      if (!str) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const x = item.transform[4];
      const arr = rowMap.get(y) ?? [];
      arr.push({ x, text: str });
      rowMap.set(y, arr);
    }

    const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = (rowMap.get(y) ?? []).sort((a, b) => a.x - b.x);
      lines.push(items.map((it) => it.text).join(' '));
    }
  }

  const parsed: ParsedStudentRow[] = [];
  const seen = new Set<string>();

  // e-Okul formatı örneği: "1 245 AHMET YILMAZ E" veya "245 AHMET YILMAZ"
  const eOkulRegex = /^(?:\d{1,2}\s+)?(\d{1,6})\s+([A-ZÇĞİÖŞÜa-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,}){1,4})(?:\s+[EKek]\b.*)?$/;
  const stopWords = ['SINIF', 'ÖĞRENCİ', 'OGRENCI', 'LİSTESİ', 'LISTESI', 'MÜDÜRLÜĞÜ', 'OKUL', 'TOPLAM', 'ADI SOYADI', 'TARİH'];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    const upper = line.toLocaleUpperCase('tr-TR');
    if (stopWords.some((w) => upper.includes(w))) continue;

    const match = line.match(eOkulRegex);
    if (match) {
      const studentNo = match[1].trim();
      const fullName = match[2].trim();
      if (!seen.has(studentNo)) {
        seen.add(studentNo);
        parsed.push({ student_no: studentNo, full_name: fullName });
      }
    }
  }

  return parsed;
}

export async function parseStudentFile(file: File): Promise<ParsedStudentRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(file);
  }
  if (ext === 'csv' || ext === 'txt') {
    return parseCsvFile(file);
  }
  if (ext === 'pdf') {
    return parsePdfFile(file);
  }
  throw new Error('Desteklenmeyen dosya türü. Lütfen CSV, Excel (.xlsx/.xls) veya PDF yükleyin.');
}
