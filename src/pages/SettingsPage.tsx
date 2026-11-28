import React, { useEffect, useState } from 'react';
import {
  Save,
  KeyRound,
  Building2,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Wand2,
  X,
  Layers,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  ClassInfo,
  Course,
  EvaluationMode,
  SettingsMap,
  Subject,
  SubjectModelType,
  User,
} from '../types';

interface SettingsPageProps {
  user: User;
  settings: SettingsMap;
  subjects: Subject[];
  courses: Course[];
  onRefresh: () => Promise<void>;
}

const TERM_COURSE_PRESETS: Record<number, { name: string; short_code: string }> = {
  1: { name: '1.Dönem 1.Uygulama (Nesne Tabanlı Programlama)', short_code: '1D-1U' },
  2: { name: '1.Dönem 2.Uygulama (FrontEnd Web Tasarımı)', short_code: '1D-2U' },
  3: { name: '2.Dönem 1.Uygulama (Web Tabanlı Proje)', short_code: '2D-1U' },
  4: { name: '2.Dönem 2.Uygulama (Mobil Uygulama)', short_code: '2D-2U' },
};

const MODE_LABELS: Record<EvaluationMode, string> = {
  rubric_full: 'Standart 5 Kazanım Rubiği',
  weekly_plus_final: 'Haftalık Takip + Proje Sonu Final',
  practice_simple: 'Uygulama Ödevi / Pratik Not',
};

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  settings,
  subjects,
  courses,
  onRefresh,
}) => {
  const [schoolName, setSchoolName] = useState(settings.school_name ?? '');
  const [academicYear, setAcademicYear] = useState(settings.academic_year ?? '2025-2026');
  const [evalTitle, setEvalTitle] = useState(
    settings.evaluation_title ?? 'PROJE DEĞERLENDİRME VE RUBİK FORMU'
  );

  // Şifre değiştirme
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Ana Ders (Subject) Ekleme + Sınıf Seçimi
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjModel, setNewSubjModel] = useState<SubjectModelType>('practice_assignment');
  const [newSubjClassIds, setNewSubjClassIds] = useState<number[]>([]);

  useEffect(() => {
    api.getClasses().then(setClasses).catch(() => {});
  }, []);

  // Satır içi uygulama/proje düzenleme
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number>(0);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editSubjectId, setEditSubjectId] = useState<number>(1);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editMode, setEditMode] = useState<EvaluationMode>('rubric_full');
  const [editQPoints, setEditQPoints] = useState(20);
  const [editCompletionPts, setEditCompletionPts] = useState(20);
  const [editReportPts, setEditReportPts] = useState(10);
  const [editOrder, setEditOrder] = useState(1);

  // Yeni proje alanı / uygulama ödevi ekleme
  const [newCourseSubjectId, setNewCourseSubjectId] = useState<number>(subjects[0]?.id ?? 1);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseMode, setNewCourseMode] = useState<EvaluationMode>('practice_simple');
  const [newCourseQPoints, setNewCourseQPoints] = useState(0);
  const [applyingPresets, setApplyingPresets] = useState(false);

  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.saveSettings({
        school_name: schoolName,
        academic_year: academicYear,
        evaluation_title: evalTitle,
      });
      await onRefresh();
      setMessage({ type: 'ok', text: 'Kurum ve çıktı ayarları güncellendi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Kaydedilemedi.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'err', text: 'Yeni şifreler birbiriyle eşleşmiyor.' });
      return;
    }
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await onRefresh();
      setMessage({ type: 'ok', text: 'Şifreniz başarıyla değiştirildi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Şifre değiştirilemedi.' });
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await api.createSubject({
        name: newSubjName.trim(),
        code: newSubjCode.trim().toUpperCase(),
        model_type: newSubjModel,
        sort_order: subjects.length + 1,
        class_ids: newSubjClassIds,
      });
      setNewSubjName('');
      setNewSubjCode('');
      setNewSubjClassIds([]);
      setNewCourseSubjectId(res.id);
      await onRefresh();
      setMessage({
        type: 'ok',
        text: 'Yeni ana ders, ilk uygulaması ve seçili sınıf bağlantıları oluşturuldu.',
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Ders eklenemedi.' });
    }
  };

  const handleDeleteSubject = async (id: number) => {
    if (!confirm('Bu ana dersi silmek istiyor musunuz?')) return;
    setMessage(null);
    try {
      await api.deleteSubject(id);
      await onRefresh();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Silinemedi.' });
    }
  };

  const startEditCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setEditSubjectId(c.subject_id || 1);
    setEditName(c.name);
    setEditCode(c.short_code);
    setEditMode(c.evaluation_mode || 'rubric_full');
    setEditQPoints(c.question_points);
    setEditCompletionPts(c.final_completion_points ?? 20);
    setEditReportPts(c.final_report_points ?? 10);
    setEditOrder(c.sort_order);
  };

  const handleSaveInlineCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId) return;
    setMessage(null);
    try {
      await api.updateCourse({
        id: editingCourseId,
        subject_id: editSubjectId,
        name: editName.trim(),
        short_code: editCode.trim(),
        evaluation_mode: editMode,
        question_points: editQPoints,
        final_completion_points: editCompletionPts,
        final_report_points: editReportPts,
        sort_order: editOrder,
      });
      setEditingCourseId(null);
      await onRefresh();
      setMessage({ type: 'ok', text: 'Uygulama / proje ayarları güncellendi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Güncellenemedi.' });
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.createCourse({
        subject_id: newCourseSubjectId,
        name: newCourseName.trim(),
        short_code: newCourseCode.trim(),
        evaluation_mode: newCourseMode,
        question_points: newCourseQPoints,
        final_completion_points: 20,
        final_report_points: 10,
        sort_order: courses.length + 1,
      });
      setNewCourseName('');
      setNewCourseCode('');
      await onRefresh();
      setMessage({ type: 'ok', text: 'Yeni uygulama / proje notu eklendi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Eklenemedi.' });
    }
  };

  const handleApplyTermPresets = async () => {
    setApplyingPresets(true);
    setMessage(null);
    try {
      for (const c of courses) {
        const preset = TERM_COURSE_PRESETS[c.id];
        if (!preset) continue;
        await api.updateCourse({
          id: c.id,
          subject_id: c.subject_id || 1,
          name: preset.name,
          short_code: preset.short_code,
          description: c.description ?? '',
          question_points: c.question_points,
          evaluation_mode: c.evaluation_mode || 'rubric_full',
          final_completion_points: c.final_completion_points ?? 20,
          final_report_points: c.final_report_points ?? 10,
          sort_order: c.sort_order,
        });
      }
      await onRefresh();
      setMessage({
        type: 'ok',
        text: '4 uygulama adı (1.Dönem 1.Uygulama ... 2.Dönem 2.Uygulama) veritabanında güncellendi.',
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Güncellenemedi.' });
    } finally {
      setApplyingPresets(false);
    }
  };

  const handleDeleteCourse = async (id: number) => {
    if (!confirm('Bu uygulama/ödevi ve bağlı notları silmek istiyor musunuz?')) return;
    await api.deleteCourse(id);
    await onRefresh();
  };

  const filteredCourses =
    selectedSubjectFilter > 0
      ? courses.filter((c) => c.subject_id === selectedSubjectFilter)
      : courses;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dersler, Değerlendirme Modları &amp; Sistem Ayarları</h1>
        <p className="text-sm text-slate-500 mt-1">
          <strong>Seçmeli Yazılım Dersi</strong> için 4 dönemlik proje yapısını koruyun; ek olarak <strong>Uygulama Dersleri</strong> ekleyip ayrı uygulama ödevleri ve <strong>Haftalık Süreç + Proje Sonu Final</strong> modlarını yönetin.
        </p>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-sm border ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 1. Ana Dersler (Admin) */}
      {user.role === 'admin' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-semibold text-base text-slate-900">
            <Layers className="w-5 h-5 text-indigo-600" />
            Ana Dersler ({subjects.length})
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {subjects.map((s) => (
              <div key={s.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 mr-2">
                    {s.code}
                  </span>
                  <span className="font-semibold text-slate-900">{s.name}</span>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      s.model_type === 'project_rubric'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {s.model_type === 'project_rubric' ? 'Proje Rubik Modeli' : 'Uygulama Ödevi / Pratik'}
                  </span>
                </div>
                {s.id > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSubject(s.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateSubject} className="space-y-3">
            <div className="grid sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Ders Adı</label>
                <input
                  type="text"
                  required
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                  placeholder="Örn: Programlama Temelleri"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Kısa Kod</label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  value={newSubjCode}
                  onChange={(e) => setNewSubjCode(e.target.value)}
                  placeholder="PT-1"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Değerlendirme Modeli</label>
                <select
                  value={newSubjModel}
                  onChange={(e) => setNewSubjModel(e.target.value as SubjectModelType)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white"
                >
                  <option value="practice_assignment">Uygulama Ödevi / Pratik</option>
                  <option value="project_rubric">Proje Rubik Modeli</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Ders Ekle
                </button>
              </div>
            </div>

            {/* Bu Dersin Okutulacağı Sınıflar */}
            {classes.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    Bu Dersin Okutulacağı Sınıflar ({newSubjClassIds.length} seçili)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubjClassIds(
                        newSubjClassIds.length === classes.length ? [] : classes.map((c) => c.id)
                      )
                    }
                    className="text-indigo-600 hover:underline font-medium cursor-pointer"
                  >
                    {newSubjClassIds.length === classes.length ? 'Temizle' : 'Tüm Sınıfları Seç'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {classes.map((c) => {
                    const checked = newSubjClassIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() =>
                          setNewSubjClassIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                          checked
                            ? 'bg-emerald-600 border-emerald-600 text-white font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3" />}
                        <span>
                          {c.name} ({c.student_count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* 2. Proje Alanları / Uygulama Ödevleri (Mod Seçimi + Satır İçi Düzenleme) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 font-semibold text-base text-slate-900">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Proje Notları &amp; Uygulama Ödevleri ({filteredCourses.length})
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Herhangi bir projede <strong>Haftalık Süreç Takibi + Proje Sonu Final</strong> modunu açabilir veya adını düzenleyebilirsiniz.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value={0}>Tüm Ana Dersler</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={applyingPresets}
              onClick={handleApplyTermPresets}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {applyingPresets ? 'Güncelleniyor...' : '1./2. Dönem Adlarını Uygula'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {filteredCourses.map((c) => {
            const isEditing = editingCourseId === c.id;
            const subj = subjects.find((s) => s.id === c.subject_id);
            if (isEditing) {
              return (
                <form
                  key={c.id}
                  onSubmit={handleSaveInlineCourse}
                  className="p-4 bg-indigo-50/50 space-y-3"
                >
                  <div className="grid sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Bağlı Ana Ders
                      </label>
                      <select
                        value={editSubjectId}
                        onChange={(e) => setEditSubjectId(Number(e.target.value))}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Uygulama / Proje Adı
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kısa Kod
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={20}
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 text-sm"
                      />
                    </div>

                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Değerlendirme Modu
                      </label>
                      <select
                        value={editMode}
                        onChange={(e) => setEditMode(e.target.value as EvaluationMode)}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      >
                        <option value="rubric_full">Standart 5 Kazanım Rubiği (Mevcut)</option>
                        <option value="weekly_plus_final">
                          Haftalık Takip + Proje Sonu Final (Bitim + Rapor + 3 Soru)
                        </option>
                        <option value="practice_simple">Uygulama Ödevi / Pratik Not</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        3 Soru Puanı
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editQPoints}
                        onChange={(e) => setEditQPoints(Number(e.target.value))}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2 py-1.5 text-sm text-center"
                      />
                    </div>

                    {editMode === 'weekly_plus_final' && (
                      <>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Proje Bitimi (p)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editCompletionPts}
                            onChange={(e) => setEditCompletionPts(Number(e.target.value))}
                            className="w-full border border-indigo-300 bg-white rounded-lg px-2 py-1.5 text-sm text-center"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Rapor (p)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editReportPts}
                            onChange={(e) => setEditReportPts(Number(e.target.value))}
                            className="w-full border border-indigo-300 bg-white rounded-lg px-2 py-1.5 text-sm text-center"
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Sıra
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={editOrder}
                        onChange={(e) => setEditOrder(Number(e.target.value))}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2 py-1.5 text-sm text-center"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCourseId(null)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 text-xs font-medium cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> İptal
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Değişikliği Kaydet
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div key={c.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm hover:bg-slate-50">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {c.short_code}
                    </span>
                    <span className="font-semibold text-slate-900">{c.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        c.evaluation_mode === 'weekly_plus_final'
                          ? 'bg-violet-100 text-violet-800'
                          : c.evaluation_mode === 'practice_simple'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {MODE_LABELS[c.evaluation_mode || 'rubric_full']}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Ders: <strong>{subj?.name ?? 'Seçmeli Yazılım Dersi'}</strong> · Soru: {c.question_points}p
                    {c.evaluation_mode === 'weekly_plus_final' && (
                      <>
                        {' '}· Final Bitim: {c.final_completion_points}p · Rapor: {c.final_report_points}p
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditCourse(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 text-xs font-medium cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Düzenle / Mod Seç
                  </button>
                  {user.role === 'admin' && courses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Yeni Proje Notu / Uygulama Ödevi Ekle */}
        <form onSubmit={handleAddCourse} className="grid sm:grid-cols-12 gap-3 items-end pt-3 border-t border-slate-100">
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Ana Ders</label>
            <select
              value={newCourseSubjectId}
              onChange={(e) => {
                const sid = Number(e.target.value);
                setNewCourseSubjectId(sid);
                const found = subjects.find((s) => s.id === sid);
                if (found?.model_type === 'practice_assignment') {
                  setNewCourseMode('practice_simple');
                  setNewCourseQPoints(0);
                } else {
                  setNewCourseMode('rubric_full');
                  setNewCourseQPoints(20);
                }
              }}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Uygulama / Ödev Adı *</label>
            <input
              type="text"
              required
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="Örn: Uygulama 1: Flexbox Sayfa"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Kısa Kod *</label>
            <input
              type="text"
              required
              maxLength={20}
              value={newCourseCode}
              onChange={(e) => setNewCourseCode(e.target.value)}
              placeholder="UYG-1"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Mod</label>
            <select
              value={newCourseMode}
              onChange={(e) => {
                const m = e.target.value as EvaluationMode;
                setNewCourseMode(m);
                setNewCourseQPoints(m === 'practice_simple' ? 0 : 20);
              }}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs bg-white"
            >
              <option value="practice_simple">Uygulama Ödevi</option>
              <option value="rubric_full">Standart Rubik</option>
              <option value="weekly_plus_final">Haftalık + Final</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Ekle
            </button>
          </div>
        </form>
      </div>

      {/* 3. Admin: Kurum Ayarları */}
      {user.role === 'admin' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2 font-semibold text-base text-slate-900">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Okul &amp; Çıktı Başlık Ayarları
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Okul / Kurum Adı</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Eğitim-Öğretim Yılı</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">A4 Form Başlığı</label>
                <input
                  type="text"
                  value={evalTitle}
                  onChange={(e) => setEvalTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
            >
              <Save className="w-4 h-4" /> Ayarları Kaydet
            </button>
          </div>
        </form>
      )}

      {/* 4. Şifre Değiştir */}
      <form
        onSubmit={handleChangePassword}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 font-semibold text-base text-slate-900">
          <KeyRound className="w-5 h-5 text-indigo-600" />
          Şifremi Değiştir ({user.username})
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mevcut Şifre</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Şifre (en az 6 krk)</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium cursor-pointer"
          >
            Şifreyi Güncelle
          </button>
        </div>
      </form>
    </div>
  );
};
