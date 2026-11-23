import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Shuffle, CheckSquare, Square, Scissors } from 'lucide-react';
import { api } from '../api/client';
import type { ClassInfo, Course, PrintDataResponse } from '../types';

interface PrintPageProps {
  courses: Course[];
}

type PrintStudent = PrintDataResponse['students'][number];

const StudentHalfCard: React.FC<{
  student: PrintStudent;
  data: PrintDataResponse;
  filledMode: boolean;
  dateLabel: string;
}> = ({ student, data, filledMode, dateLabel }) => {
  const schoolName = data.class_info.school_name || data.settings.school_name || '';
  const formTitle = data.settings.evaluation_title || 'PROJE DEĞERLENDİRME VE RUBİK FORMU';
  const rubricOutcomes = data.outcomes.filter((o) => !o.is_question_outcome);
  const rubricMax = data.criteria.reduce((sum, c) => sum + c.max_score, 0);
  const totalMax = rubricMax + data.course.question_points;

  return (
    <div className="student-half-card">
      {/* Üst Başlık */}
      <div>
        <div className="flex items-start justify-between border-b border-slate-700 pb-1 mb-1.5">
          <div className="min-w-0 pr-2">
            {schoolName && (
              <div className="text-[8.5px] font-semibold text-slate-600 uppercase truncate">
                {schoolName}
              </div>
            )}
            <div className="text-[10.5px] font-extrabold tracking-tight text-slate-900">
              {formTitle} — <span className="underline">{data.course.name}</span>
            </div>
          </div>
          <div className="text-right text-[8.5px] text-slate-700 shrink-0 leading-tight">
            <div>
              <strong>Sınıf:</strong> {data.class_info.name} ({data.class_info.academic_year})
            </div>
            <div>
              <strong>Tarih:</strong> {dateLabel}
            </div>
          </div>
        </div>

        {/* Öğrenci & Proje Bilgisi */}
        <div className="grid grid-cols-12 gap-1.5 bg-slate-100 border border-slate-300 rounded px-2 py-1 mb-1.5 text-[9.5px]">
          <div className="col-span-2">
            <span className="text-slate-500">No:</span>{' '}
            <strong className="font-mono">{student.student_no}</strong>
          </div>
          <div className="col-span-4 truncate">
            <span className="text-slate-500">Ad Soyad:</span> <strong>{student.full_name}</strong>
          </div>
          <div className="col-span-6 truncate">
            <span className="text-slate-500">Proje Adı:</span>{' '}
            <strong>{student.project_title || '................................................'}</strong>
          </div>
        </div>

        {/* 1-4. Kazanımlar Rubik Tablosu */}
        <table className="w-full border-collapse text-[8.3px] leading-tight mb-1.5">
          <thead>
            <tr className="bg-slate-200 text-slate-900">
              <th className="border border-slate-400 px-1.5 py-0.5 text-left w-[20%]">Kazanım</th>
              <th className="border border-slate-400 px-1.5 py-0.5 text-left">Değerlendirme Kriteri</th>
              <th className="border border-slate-400 px-1 py-0.5 text-center w-[9%]">Maks.</th>
              <th className="border border-slate-400 px-1 py-0.5 text-center w-[11%]">Alınan</th>
            </tr>
          </thead>
          <tbody>
            {rubricOutcomes.map((outcome) => {
              const items = data.criteria.filter((c) => c.outcome_id === outcome.id);
              return items.map((cr, idx) => {
                const earned = student.criterion_scores[String(cr.id)];
                return (
                  <tr key={cr.id}>
                    {idx === 0 && (
                      <td
                        rowSpan={items.length}
                        className="border border-slate-400 px-1.5 py-0.5 font-bold bg-slate-50 align-middle"
                      >
                        {outcome.code}. {outcome.name}
                      </td>
                    )}
                    <td className="border border-slate-400 px-1.5 py-0.5">{cr.name}</td>
                    <td className="border border-slate-400 px-1 py-0.5 text-center font-semibold">
                      {cr.max_score}
                    </td>
                    <td className="border border-slate-400 px-1 py-0.5 text-center font-bold">
                      {filledMode && earned !== undefined ? earned : ''}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>

        {/* 5. Kazanım: Öğrenciye Özel 3 Rastgele Teknik Soru */}
        <div className="border border-slate-400 rounded-xs overflow-hidden">
          <div className="bg-slate-200 px-1.5 py-0.5 text-[8.3px] font-bold flex items-center justify-between border-b border-slate-400">
            <span>K5. Teknik Soru / Cevap (Öğrenciye Özel 3 Soru)</span>
            <span>Maks. {data.course.question_points} Puan</span>
          </div>
          <table className="w-full border-collapse text-[8.2px] leading-tight">
            <tbody>
              {[0, 1, 2].map((i) => {
                const q = student.questions[i];
                return (
                  <tr key={i}>
                    <td className="border-t border-slate-300 px-1.5 py-0.5 w-[80%]">
                      <strong>S{i + 1}:</strong>{' '}
                      {q ? q.question_text : 'Teknik soru henüz atanmadı (Soru Havuzundan dağıtın).'}
                    </td>
                    <td className="border-t border-l border-slate-300 px-1 py-0.5 text-center w-[9%] font-semibold">
                      {q ? `${q.max_score}p` : '-'}
                    </td>
                    <td className="border-t border-l border-slate-300 px-1 py-0.5 text-center w-[11%] font-bold">
                      {filledMode && q && q.score !== null ? q.score : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alt Alan: Toplam Puan & Ders Öğretmeni İmza Bloğu */}
      <div className="flex items-end justify-between gap-3 pt-1.5 mt-1 border-t border-slate-300">
        <div className="flex items-center gap-2">
          <div className="border border-slate-800 rounded px-2 py-1 text-center min-w-[76px]">
            <div className="text-[7.5px] uppercase font-bold text-slate-600">
              Toplam ({totalMax})
            </div>
            <div className="text-[12px] font-extrabold text-slate-900 leading-tight min-h-[15px]">
              {filledMode && student.evaluation ? student.evaluation.total_score : ''}
            </div>
          </div>
          {filledMode && student.evaluation?.notes && (
            <div className="text-[7.8px] text-slate-600 max-w-[165px] line-clamp-2">
              <strong>Not:</strong> {student.evaluation.notes}
            </div>
          )}
        </div>

        {/* Ders Öğretmenleri İmza Bloğu */}
        <div className="flex items-end gap-5">
          {(data.teachers.length > 0
            ? data.teachers
            : [{ id: 0, full_name: '................................', branch: '', title: 'Ders Öğretmeni' }]
          ).map((t) => (
            <div key={t.id} className="text-center min-w-[92px]">
              <div className="text-[8px] font-bold text-slate-900">{t.full_name}</div>
              <div className="text-[7.3px] text-slate-600">{t.title || 'Ders Öğretmeni'}</div>
              <div className="text-[7px] text-slate-400 mt-2">İmza: .....................</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PrintPage: React.FC<PrintPageProps> = ({ courses }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(courses[0]?.id ?? 1);
  const [printData, setPrintData] = useState<PrintDataResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filledMode, setFilledMode] = useState<boolean>(true);
  const [dateLabel, setDateLabel] = useState<string>(
    new Date().toLocaleDateString('tr-TR')
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getClasses().then((list) => {
      setClasses(list);
      if (list.length > 0) setSelectedClassId(list[0].id);
    });
  }, []);

  const loadPrintData = async (cid: number, courseId: number) => {
    if (!cid || !courseId) return;
    setLoading(true);
    try {
      const data = await api.getPrintData(cid, courseId);
      setPrintData(data);
      setSelectedIds(data.students.map((s) => s.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId && selectedCourseId) {
      loadPrintData(selectedClassId, selectedCourseId);
    }
  }, [selectedClassId, selectedCourseId]);

  const handleAssignMissingQuestions = async () => {
    if (!selectedClassId || !selectedCourseId) return;
    await api.assignRandomQuestions({
      class_id: selectedClassId,
      course_id: selectedCourseId,
      force: false,
    });
    await loadPrintData(selectedClassId, selectedCourseId);
  };

  const selectedStudents = useMemo(() => {
    if (!printData) return [];
    return printData.students.filter((s) => selectedIds.includes(s.id));
  }, [printData, selectedIds]);

  // Her Dikey A4 sayfada 2 öğrenci (üst + alt)
  const pages = useMemo(() => {
    const chunks: PrintStudent[][] = [];
    for (let i = 0; i < selectedStudents.length; i += 2) {
      chunks.push(selectedStudents.slice(i, i + 2));
    }
    return chunks;
  }, [selectedStudents]);

  const missingQuestionCount = useMemo(() => {
    if (!printData) return 0;
    return printData.students.filter((s) => s.questions.length < 3).length;
  }, [printData]);

  return (
    <div className="space-y-6">
      {/* Kontrol Paneli (Yazdırırken Gizlenir) */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Dikey A4 Çıktı Merkezi (1 Sayfada 2 Öğrenci)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Üst yarıda 1. öğrenci, ortada kesme çizgisi, alt yarıda 2. öğrenci olacak şekilde A4 dikey yazdırın veya PDF kaydedin.
            </p>
          </div>

          <button
            type="button"
            disabled={pages.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Yazdır / PDF Kaydet ({pages.length} Sayfa A4)
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sınıf</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {classes.length === 0 && <option value={0}>Önce sınıf ekleyin</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.student_count} öğrenci)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Proje Alanı / Ders</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.short_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Çıktı Modu</label>
            <div className="grid grid-cols-2 rounded-lg border border-slate-300 overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilledMode(true)}
                className={`py-2 cursor-pointer ${
                  filledMode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'
                }`}
              >
                Puanlı Çıktı
              </button>
              <button
                type="button"
                onClick={() => setFilledMode(false)}
                className={`py-2 cursor-pointer ${
                  !filledMode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'
                }`}
              >
                Boş Form
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Çıktı Tarihi</label>
            <input
              type="text"
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Eksik Soru Uyarısı */}
        {missingQuestionCount > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
            <span>
              Bu sınıfta <strong>{missingQuestionCount} öğrencinin</strong> bu ders için 3 teknik sorusu henüz atanmamış.
            </span>
            <button
              type="button"
              onClick={handleAssignMissingQuestions}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" /> Eksiklere Rastgele 3 Soru Ata
            </button>
          </div>
        )}

        {/* Öğrenci Seçim Çipleri */}
        {printData && printData.students.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Yazdırılacak Öğrenciler ({selectedIds.length} / {printData.students.length})
              </span>
              <div className="space-x-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedIds(printData.students.map((s) => s.id))}
                  className="text-indigo-600 hover:underline font-medium cursor-pointer"
                >
                  Tümünü Seç
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-slate-500 hover:underline cursor-pointer"
                >
                  Temizle
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {printData.students.map((st) => {
                const checked = selectedIds.includes(st.id);
                return (
                  <button
                    type="button"
                    key={st.id}
                    onClick={() =>
                      setSelectedIds((prev) =>
                        prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer ${
                      checked
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {st.student_no} {st.full_name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dikey A4 Baskı Önizleme ve Yazdırma Alanı */}
      <div className="print-only-container overflow-x-auto pb-8">
        {loading ? (
          <div className="no-print text-center p-12 text-sm text-slate-500">
            Çıktı önizlemesi hazırlanıyor...
          </div>
        ) : !printData || pages.length === 0 ? (
          <div className="no-print bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
            Yazdırılacak öğrenci seçin.
          </div>
        ) : (
          pages.map((pair, pageIndex) => (
            <div key={pageIndex} className="a4-sheet">
              <StudentHalfCard
                student={pair[0]}
                data={printData}
                filledMode={filledMode}
                dateLabel={dateLabel}
              />

              <div className="cut-divider">
                <span className="inline-flex items-center gap-1">
                  <Scissors className="w-2.5 h-2.5" /> Kesme Çizgisi · Sayfa {pageIndex + 1} / {pages.length}
                </span>
              </div>

              {pair[1] ? (
                <StudentHalfCard
                  student={pair[1]}
                  data={printData}
                  filledMode={filledMode}
                  dateLabel={dateLabel}
                />
              ) : (
                <div className="h-[139.5mm]" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
