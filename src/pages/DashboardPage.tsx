import React, { useEffect, useState } from 'react';
import {
  Users,
  BookOpen,
  FolderKanban,
  HelpCircle,
  ClipboardCheck,
  Download,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { api } from '../api/client';
import type { ClassInfo, MatrixResponse } from '../types';
import { exportMatrixToExcel } from '../utils/excelExport';

interface DashboardPageProps {
  onNavigateEvaluate: (classId: number, courseId: number, studentId?: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateEvaluate }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClasses().then((list) => {
      setClasses(list);
      if (list.length > 0) {
        setSelectedClassId(list[0].id);
      } else {
        api.getMatrix().then(setMatrix).finally(() => setLoading(false));
      }
    });
  }, []);

  useEffect(() => {
    if (selectedClassId > 0) {
      setLoading(true);
      api
        .getMatrix(selectedClassId)
        .then(setMatrix)
        .finally(() => setLoading(false));
    }
  }, [selectedClassId]);

  const activeClass = classes.find((c) => c.id === selectedClassId);

  const statCards = [
    { label: 'Toplam Sınıf', value: matrix?.stats.classes ?? 0, icon: GraduationCap, color: 'bg-blue-50 text-blue-700' },
    { label: 'Toplam Öğrenci', value: matrix?.stats.students ?? 0, icon: Users, color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Proje Konusu', value: matrix?.stats.projects ?? 0, icon: FolderKanban, color: 'bg-amber-50 text-amber-700' },
    { label: 'Teknik Soru Havuzu', value: matrix?.stats.questions ?? 0, icon: HelpCircle, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Yapılan Değerlendirme', value: matrix?.stats.evaluations ?? 0, icon: ClipboardCheck, color: 'bg-purple-50 text-purple-700' },
    { label: 'Ders Öğretmeni', value: matrix?.stats.teachers ?? 0, icon: BookOpen, color: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Genel Bakış &amp; Çoklu Ders Not Matrisi</h1>
        <p className="text-sm text-slate-500 mt-1">
          Aynı öğrencinin aynı proje ismiyle 4 farklı proje alanından aldığı notları tek tabloda izleyin ve Excel&apos;e aktarın.
        </p>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color} mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Çoklu Ders Not Matrisi */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900">Sınıf Proje Not Çizelgesi</h2>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {classes.length === 0 && <option value={0}>Önce sınıf ekleyin</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.academic_year}) — {c.student_count} Öğrenci
                </option>
              ))}
            </select>
          </div>

          {matrix && activeClass && matrix.rows.length > 0 && (
            <button
              onClick={() => exportMatrixToExcel(activeClass.name, matrix)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Excel (.xlsx) İndir
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Yükleniyor...</div>
        ) : !matrix || matrix.rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Bu sınıfta henüz öğrenci bulunmuyor. <strong>Sınıflar &amp; Öğrenciler</strong> ekranından CSV/Excel/PDF ile sınıf yükleyebilirsiniz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold w-20">No</th>
                  <th className="px-4 py-3 font-semibold">Öğrenci Adı Soyadı</th>
                  <th className="px-4 py-3 font-semibold">Proje Adı</th>
                  {matrix.courses.map((course) => (
                    <th key={course.id} className="px-3 py-3 font-semibold text-center">
                      <div>{course.short_code}</div>
                      <div className="text-[10px] font-normal normal-case text-slate-400 truncate max-w-[130px] mx-auto">
                        {course.name}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-center">Ort.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrix.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-slate-600">{row.student_no}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.project_title ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
                          {row.project_title}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Atanmadı</span>
                      )}
                    </td>
                    {matrix.courses.map((course) => {
                      const score = row.scores[String(course.id)];
                      return (
                        <td key={course.id} className="px-3 py-3 text-center">
                          <button
                            onClick={() => onNavigateEvaluate(selectedClassId, course.id, row.id)}
                            title={`${row.full_name} — ${course.name} değerlendir`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              score !== undefined
                                ? score >= 70
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : score >= 50
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
                            }`}
                          >
                            {score !== undefined ? score : 'Puanla'}
                            <ArrowRight className="w-3 h-3 opacity-60" />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {row.average !== null ? row.average : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
