import React, { useEffect, useState } from 'react';
import {
  Plus,
  Upload,
  Trash2,
  FileSpreadsheet,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { api } from '../api/client';
import type { ClassInfo, Project, SettingsMap, Student } from '../types';
import { parseStudentFile, type ParsedStudentRow } from '../utils/fileParsers';

interface ClassesPageProps {
  settings: SettingsMap;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({ settings }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Yeni Sınıf Formu
  const [newClassName, setNewClassName] = useState('');
  const [newYear, setNewYear] = useState(settings.academic_year || '2025-2026');
  const [newSchool, setNewSchool] = useState('');

  // Tekil Öğrenci Formu
  const [studentNo, setStudentNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [projectId, setProjectId] = useState<string>('');

  // Dosya İçe Aktarma (CSV / Excel / PDF)
  const [importRows, setImportRows] = useState<ParsedStudentRow[]>([]);
  const [importing, setImporting] = useState(false);

  const loadBase = async () => {
    const [cList, pList] = await Promise.all([api.getClasses(), api.getProjects()]);
    setClasses(cList);
    setProjects(pList);
    if (cList.length > 0 && selectedClassId === 0) {
      setSelectedClassId(cList[0].id);
    }
  };

  const loadStudents = async (cid: number) => {
    if (!cid) {
      setStudents([]);
      return;
    }
    const list = await api.getStudents(cid);
    setStudents(list);
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    loadStudents(selectedClassId);
  }, [selectedClassId]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await api.createClass({
        name: newClassName.trim(),
        academic_year: newYear.trim(),
        school_name: newSchool.trim(),
      });
      setNewClassName('');
      await loadBase();
      setSelectedClassId(res.id);
      setMessage({ type: 'ok', text: 'Yeni sınıf oluşturuldu.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Sınıf eklenemedi.' });
    }
  };

  const handleDeleteClass = async (id: number) => {
    if (!confirm('Bu sınıfı ve içindeki tüm öğrencileri silmek istediğinize emin misiniz?')) return;
    setMessage(null);
    try {
      await api.deleteClass(id);
      setSelectedClassId(0);
      await loadBase();
      setMessage({ type: 'ok', text: 'Sınıf silindi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Silinemedi.' });
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;
    setMessage(null);
    try {
      await api.createStudent({
        class_id: selectedClassId,
        student_no: studentNo.trim(),
        full_name: fullName.trim(),
        project_id: projectId ? Number(projectId) : null,
      });
      setStudentNo('');
      setFullName('');
      setProjectId('');
      await Promise.all([loadStudents(selectedClassId), loadBase()]);
      setMessage({ type: 'ok', text: 'Öğrenci sınıfa eklendi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Öğrenci eklenemedi.' });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    try {
      const parsed = await parseStudentFile(file);
      if (parsed.length === 0) {
        setMessage({
          type: 'err',
          text: 'Dosyadan öğrenci satırı ayrıştırılamadı. Lütfen No ve Ad Soyad sütunlarının bulunduğundan emin olun.',
        });
        return;
      }
      setImportRows(parsed);
      setMessage({
        type: 'ok',
        text: `${file.name} dosyasından ${parsed.length} öğrenci okundu. Aşağıdan kontrol edip "Onayla ve Kaydet" butonuna basın.`,
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Dosya okunamadı.' });
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedClassId || importRows.length === 0) return;
    setImporting(true);
    setMessage(null);
    try {
      const res = await api.importStudents(selectedClassId, importRows);
      setImportRows([]);
      await Promise.all([loadStudents(selectedClassId), loadBase()]);
      setMessage({ type: 'ok', text: `${res.imported} öğrenci sınıfa başarıyla aktarıldı.` });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Aktarım başarısız.' });
    } finally {
      setImporting(false);
    }
  };

  const handleAssignProject = async (studentId: number, newProjectId: string) => {
    try {
      await api.updateStudent({
        id: studentId,
        project_id: newProjectId ? Number(newProjectId) : null,
      });
      await loadStudents(selectedClassId);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Proje atanamadı.' });
    }
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm('Bu öğrenciyi silmek istiyor musunuz?')) return;
    try {
      await api.deleteStudent(id);
      await Promise.all([loadStudents(selectedClassId), loadBase()]);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Silinemedi.' });
    }
  };

  const activeClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sınıflar &amp; Öğrenci Yönetimi</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sınıf oluşturun, <strong>CSV / Excel (.xlsx) / PDF (e-Okul)</strong> ile toplu öğrenci yükleyin ve her öğrenciye tüm 4 derste ortak geçerli proje adını atayın.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm border ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Sol Kolon: Sınıf Listesi & Yeni Sınıf */}
        <div className="lg:col-span-4 space-y-4">
          <form
            onSubmit={handleCreateClass}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              Yeni Sınıf Ekle
            </div>
            <input
              type="text"
              required
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Sınıf Adı (Örn: 11-A Bilişim)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="Eğitim Yılı (2025-2026)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newSchool}
              onChange={(e) => setNewSchool(e.target.value)}
              placeholder="Okul Adı (Boş bırakılırsa Ayarlar'dan alınır)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Sınıf Oluştur
            </button>
          </form>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold text-sm text-slate-800">
              Sınıflar ({classes.length})
            </div>
            <div className="divide-y divide-slate-100">
              {classes.length === 0 && (
                <div className="p-4 text-xs text-slate-500 text-center">Henüz sınıf eklenmedi.</div>
              )}
              {classes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`px-4 py-3 flex items-center justify-between cursor-pointer transition ${
                    selectedClassId === c.id ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.academic_year} · {c.student_count} öğrenci
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClass(c.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                    title="Sınıfı Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sağ Kolon: Seçili Sınıf Öğrencileri & Dosya İçe Aktarma */}
        <div className="lg:col-span-8 space-y-4">
          {!activeClass ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              Öğrenci eklemek veya dosya içe aktarmak için soldan bir sınıf seçin ya da yeni sınıf oluşturun.
            </div>
          ) : (
            <>
              {/* CSV / Excel / PDF İçe Aktarma Kartı */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {activeClass.name} — Toplu Öğrenci Yükle (CSV / Excel / PDF)
                      </h2>
                      <p className="text-xs text-slate-500">
                        e-Okul PDF sınıf listesi, Excel (.xlsx/.xls) veya CSV dosyası seçin.
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer transition">
                    <Upload className="w-4 h-4" />
                    Dosya Seç (CSV / Excel / PDF)
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.pdf,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Önizleme Tablosu */}
                {importRows.length > 0 && (
                  <div className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/30">
                    <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-900">
                        İçe Aktarma Önizlemesi ({importRows.length} öğrenci)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setImportRows([])}
                          className="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer"
                        >
                          İptal
                        </button>
                        <button
                          type="button"
                          disabled={importing}
                          onClick={handleConfirmImport}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          {importing ? 'Kaydediliyor...' : 'Onayla ve Sınıfa Kaydet'}
                        </button>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-white border-b border-emerald-100 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 w-24">No</th>
                            <th className="px-3 py-2">Ad Soyad</th>
                            <th className="px-3 py-2">Proje (Varsa)</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100 bg-white">
                          {importRows.map((row, idx) => (
                            <tr key={idx}>
                              <td className="px-2 py-1.5">
                                <input
                                  value={row.student_no}
                                  onChange={(e) => {
                                    const copy = [...importRows];
                                    copy[idx] = { ...copy[idx], student_no: e.target.value };
                                    setImportRows(copy);
                                  }}
                                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  value={row.full_name}
                                  onChange={(e) => {
                                    const copy = [...importRows];
                                    copy[idx] = { ...copy[idx], full_name: e.target.value };
                                    setImportRows(copy);
                                  }}
                                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  value={row.project_title ?? ''}
                                  onChange={(e) => {
                                    const copy = [...importRows];
                                    copy[idx] = { ...copy[idx], project_title: e.target.value };
                                    setImportRows(copy);
                                  }}
                                  placeholder="Opsiyonel"
                                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImportRows(importRows.filter((_, i) => i !== idx))
                                  }
                                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Manuel Öğrenci Ekle */}
              <form
                onSubmit={handleAddStudent}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">No *</label>
                  <input
                    type="text"
                    required
                    value={studentNo}
                    onChange={(e) => setStudentNo(e.target.value)}
                    placeholder="101"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ad Soyad *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ayşe Demir"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Proje Adı</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">-- Proje Seç (Opsiyonel) --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" /> Ekle
                  </button>
                </div>
              </form>

              {/* Öğrenci Tablosu */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-800">
                    {activeClass.name} Öğrenci Listesi ({students.length})
                  </span>
                  <span className="text-xs text-slate-500">
                    Proje adı seçimi tüm 4 proje alanında otomatik görünür
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 w-20">No</th>
                        <th className="px-4 py-2.5">Ad Soyad</th>
                        <th className="px-4 py-2.5">Atanan Proje Adı</th>
                        <th className="px-4 py-2.5 w-14 text-right">Sil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 text-sm">
                            Bu sınıfta henüz öğrenci yok. Yukarıdan dosya yükleyebilir veya tek tek ekleyebilirsiniz.
                          </td>
                        </tr>
                      )}
                      {students.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-slate-600">{st.student_no}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{st.full_name}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={st.project_id ?? ''}
                              onChange={(e) => handleAssignProject(st.id, e.target.value)}
                              className="w-full max-w-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                              <option value="">-- Proje Seçilmedi --</option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.title}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(st.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
