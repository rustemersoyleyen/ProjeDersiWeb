import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  ClassInfo,
  Course,
  WeeklyScoresResponse,
  WeeklyStatus,
  WeeklyTask,
} from '../types';

interface WeeklyTrackingPageProps {
  courses: Course[];
  onCoursesChanged: () => Promise<void>;
}

const DEFAULT_4_WEEK_PLAN = [
  { week_no: 1, title: 'Proje Analizi ve İş Planı', description: 'Kapsam, gereksinimler ve akış hazırlığı', max_score: 10 },
  { week_no: 2, title: 'Tasarım Kontrolü (Arayüz / Veritabanı)', description: 'Ekran taslakları, veritabanı veya sınıf tasarımı', max_score: 15 },
  { week_no: 3, title: 'Temel Kodlama ve Ana Modüller', description: 'Çekirdek işlevlerin kodlanması', max_score: 15 },
  { week_no: 4, title: 'Geliştirme, Hata Ayıklama ve Test', description: 'Eksiklerin giderilmesi ve son testler', max_score: 10 },
];

export const WeeklyTrackingPage: React.FC<WeeklyTrackingPageProps> = ({
  courses,
  onCoursesChanged,
}) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(courses[0]?.id ?? 1);

  const [data, setData] = useState<WeeklyScoresResponse | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Yeni haftalık görev formu
  const [weekNo, setWeekNo] = useState<number>(1);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskScore, setTaskScore] = useState<number>(10);
  const [taskDate, setTaskDate] = useState('');

  // Düzenlenebilir öğrenci haftalık puan taslağı (aktif görev için)
  const [draftScores, setDraftScores] = useState<
    Record<number, { status: WeeklyStatus; score: number; note: string }>
  >({});

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  useEffect(() => {
    api.getClasses().then((list) => {
      setClasses(list);
      if (list.length > 0) setSelectedClassId(list[0].id);
    });
  }, []);

  const loadWeekly = async (cid: number, courseId: number) => {
    if (!cid || !courseId) return;
    setLoading(true);
    try {
      const res = await api.getWeeklyScores(cid, courseId);
      setData(res);
      setWeekNo(res.tasks.length + 1);
      if (res.tasks.length > 0) {
        const stillExists = res.tasks.some((t) => t.id === activeTaskId);
        if (!stillExists) {
          setActiveTaskId(res.tasks[0].id);
        }
      } else {
        setActiveTaskId(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId && selectedCourseId) {
      loadWeekly(selectedClassId, selectedCourseId);
    }
  }, [selectedClassId, selectedCourseId]);

  // Aktif hafta değiştiğinde öğrenci taslaklarını doldur
  useEffect(() => {
    if (!data || !activeTaskId) {
      setDraftScores({});
      return;
    }
    const map: Record<number, { status: WeeklyStatus; score: number; note: string }> = {};
    for (const st of data.students) {
      const existing = st.weekly_scores[String(activeTaskId)];
      map[st.id] = existing
        ? { status: existing.status, score: existing.score, note: existing.note ?? '' }
        : { status: 'missing', score: 0, note: '' };
    }
    setDraftScores(map);
  }, [data, activeTaskId]);

  const activeTask: WeeklyTask | undefined = useMemo(
    () => data?.tasks.find((t) => t.id === activeTaskId),
    [data, activeTaskId]
  );

  const weeklyMaxSum = useMemo(
    () => (data?.tasks ?? []).reduce((s, t) => s + t.max_score, 0),
    [data]
  );

  const finalBudgetTotal = useMemo(() => {
    if (!activeCourse) return weeklyMaxSum;
    return (
      weeklyMaxSum +
      (activeCourse.final_completion_points ?? 20) +
      (activeCourse.final_report_points ?? 10) +
      activeCourse.question_points
    );
  }, [weeklyMaxSum, activeCourse]);

  const handleEnableWeeklyMode = async () => {
    if (!activeCourse) return;
    setMessage(null);
    await api.updateCourse({
      id: activeCourse.id,
      subject_id: activeCourse.subject_id,
      name: activeCourse.name,
      short_code: activeCourse.short_code,
      description: activeCourse.description ?? '',
      question_points: activeCourse.question_points,
      evaluation_mode: 'weekly_plus_final',
      final_completion_points: activeCourse.final_completion_points ?? 20,
      final_report_points: activeCourse.final_report_points ?? 10,
      sort_order: activeCourse.sort_order,
    });
    await onCoursesChanged();
    setMessage({
      type: 'ok',
      text: `${activeCourse.name} için "Haftalık Takip + Proje Sonu Final" modu aktifleştirildi!`,
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setMessage(null);
    try {
      const res = await api.createWeeklyTask({
        course_id: selectedCourseId,
        week_no: weekNo,
        title: taskTitle.trim(),
        max_score: taskScore,
        due_date: taskDate.trim() || undefined,
      });
      setTaskTitle('');
      setTaskDate('');
      await loadWeekly(selectedClassId, selectedCourseId);
      setActiveTaskId(res.id);
      setMessage({ type: 'ok', text: `${weekNo}. Hafta kontrol görevi eklendi.` });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Görev eklenemedi.' });
    }
  };

  const handleLoadDefaultPlan = async () => {
    if (!selectedCourseId) return;
    setMessage(null);
    try {
      await api.bulkCreateWeeklyTasks(selectedCourseId, DEFAULT_4_WEEK_PLAN);
      await loadWeekly(selectedClassId, selectedCourseId);
      setMessage({
        type: 'ok',
        text: 'Hazır 4 haftalık kontrol planı (Toplam 50 puan) yüklendi.',
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Yüklenemedi.' });
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!confirm('Bu haftalık görevi ve girilmiş kontrol puanlarını silmek istiyor musunuz?')) return;
    await api.deleteWeeklyTask(id);
    await loadWeekly(selectedClassId, selectedCourseId);
  };

  const setStudentQuickStatus = (studentId: number, status: WeeklyStatus) => {
    if (!activeTask) return;
    const score =
      status === 'done'
        ? activeTask.max_score
        : status === 'partial'
        ? Number((activeTask.max_score / 2).toFixed(1))
        : 0;
    setDraftScores((prev) => ({
      ...prev,
      [studentId]: {
        status,
        score,
        note: prev[studentId]?.note ?? '',
      },
    }));
  };

  const handleSaveWeekScores = async () => {
    if (!data || !activeTaskId) return;
    setSaving(true);
    setMessage(null);
    try {
      const items = data.students.map((st) => {
        const d = draftScores[st.id] ?? { status: 'missing' as WeeklyStatus, score: 0, note: '' };
        return {
          student_id: st.id,
          weekly_task_id: activeTaskId,
          status: d.status,
          score: d.score,
          note: d.note,
        };
      });
      await api.saveWeeklyScores(selectedCourseId, items);
      await loadWeekly(selectedClassId, selectedCourseId);
      setMessage({
        type: 'ok',
        text: `${activeTask?.week_no}. Hafta (${activeTask?.title}) tüm sınıf puanları kaydedildi.`,
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Kaydedilemedi.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Haftalık Çalışma Planı &amp; Süreç Kontrolü</h1>
          <p className="text-sm text-slate-500 mt-1">
            Proje çalışmalarını haftalara bölüp (ör. 1. Hafta Planlama, 2. Hafta Tasarım...) her hafta tüm sınıfı tek ekrandan hızlıca puanlayın; proje sonunda yalnızca <strong>Proje Bitimi, Rapor ve 3 Soru</strong> değerlendirilir.
          </p>
        </div>

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(Number(e.target.value))}
          className="border border-slate-300 rounded-xl px-3.5 py-2 text-sm bg-white font-medium"
        >
          {classes.length === 0 && <option value={0}>Önce sınıf ekleyin</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              Sınıf: {c.name} ({c.student_count} öğrenci)
            </option>
          ))}
        </select>
      </div>

      {/* Proje / Uygulama Sekmeleri */}
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCourseId(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition cursor-pointer ${
              selectedCourseId === c.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.name}
            {c.evaluation_mode === 'weekly_plus_final' && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white/20">Haftalık</span>
            )}
          </button>
        ))}
      </div>

      {/* Mod Bilgilendirme / Tek Tıkla Aktivasyon */}
      {activeCourse && activeCourse.evaluation_mode !== 'weekly_plus_final' ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
          <div>
            <strong>{activeCourse.name}</strong> şu an <em>Standart Rubik / Uygulama</em> modunda. Haftalık puanların final nota yansıması ve proje sonunda sadece Bitim + Rapor + 3 Soru sorulması için Haftalık Takip modunu açabilirsiniz.
          </div>
          <button
            type="button"
            onClick={handleEnableWeeklyMode}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Bu Projede Haftalık Takip Modunu Aç
          </button>
        </div>
      ) : (
        activeCourse && (
          <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-950 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong>Puan Dağılımı ({activeCourse.name}):</strong> Haftalık Kontroller (<strong>{weeklyMaxSum}p</strong>) + Proje Bitimi (<strong>{activeCourse.final_completion_points}p</strong>) + Rapor (<strong>{activeCourse.final_report_points}p</strong>) + 3 Soru (<strong>{activeCourse.question_points}p</strong>) ={' '}
              <strong className={Math.abs(finalBudgetTotal - 100) < 0.01 ? 'text-emerald-700' : 'text-amber-700'}>
                {finalBudgetTotal} / 100 Puan
              </strong>
            </div>
            <span className="text-xs text-violet-700">
              Final puan ağırlıklarını Ayarlar ekranından değiştirebilirsiniz.
            </span>
          </div>
        )
      )}

      {message && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-xl text-sm border ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Haftalık Plan Yönetimi */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            Haftalık Kontrol Planı ({data?.tasks.length ?? 0} Hafta · Toplam {weeklyMaxSum} Puan)
          </div>
          {(data?.tasks.length ?? 0) === 0 && (
            <button
              type="button"
              onClick={handleLoadDefaultPlan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" /> Hazır 4 Haftalık Şablon Yükle (50 Puan)
            </button>
          )}
        </div>

        <form onSubmit={handleAddTask} className="grid sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Hafta No</label>
            <input
              type="number"
              min={1}
              max={20}
              required
              value={weekNo}
              onChange={(e) => setWeekNo(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-center"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-slate-600 mb-1">Haftalık Görev / Kontrol Konusu *</label>
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Örn: Ekran Tasarımı ve Veritabanı Kontrolü"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Maks. Puan</label>
            <input
              type="number"
              min={1}
              max={100}
              step={0.5}
              required
              value={taskScore}
              onChange={(e) => setTaskScore(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-center font-semibold"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Tarih</label>
            <input
              type="text"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              placeholder="12.12"
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs text-center"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Hafta Ekle
            </button>
          </div>
        </form>

        {/* Hafta Sekmeleri */}
        {data && data.tasks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {data.tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveTaskId(t.id)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                  activeTaskId === t.id
                    ? 'bg-indigo-600 border-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>
                  <strong>H{t.week_no}:</strong> {t.title} ({t.max_score}p)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(t.id);
                  }}
                  className={`p-0.5 rounded cursor-pointer ${
                    activeTaskId === t.id ? 'hover:bg-white/20 text-white' : 'text-slate-400 hover:text-red-600'
                  }`}
                  title="Haftayı Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sınıf Haftalık Kontrol Tablosu */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Haftalık kontrol tablosu yükleniyor...
        </div>
      ) : !data || data.tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Kontrol yapmak için yukarıdan en az 1 haftalık görev ekleyin veya <strong>&quot;Hazır 4 Haftalık Şablon Yükle&quot;</strong> butonuna tıklayın.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sm text-slate-900">
                {activeTask?.week_no}. Hafta Kontrolü: {activeTask?.title}
              </span>
              <span className="ml-2 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                Maks. {activeTask?.max_score} Puan
              </span>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveWeekScores}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Bu Haftanın Puanlarını Kaydet'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 w-16">No</th>
                  <th className="px-4 py-2.5">Öğrenci &amp; Proje</th>
                  <th className="px-4 py-2.5 text-center">Hızlı Kontrol</th>
                  <th className="px-4 py-2.5 w-24 text-center">Puan</th>
                  <th className="px-4 py-2.5">Kısa Not</th>
                  <th className="px-4 py-2.5 w-24 text-center">Haftalık Top.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.students.map((st) => {
                  const d = draftScores[st.id] ?? { status: 'missing' as WeeklyStatus, score: 0, note: '' };
                  return (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-slate-600">{st.student_no}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{st.full_name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">
                          {st.project_title || 'Proje atanmadı'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setStudentQuickStatus(st.id, 'done')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                              d.status === 'done'
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'
                            }`}
                          >
                            Yapıldı
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentQuickStatus(st.id, 'partial')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                              d.status === 'partial'
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400'
                            }`}
                          >
                            Kısmen
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentQuickStatus(st.id, 'missing')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                              d.status === 'missing'
                                ? 'bg-rose-600 border-rose-600 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-rose-400'
                            }`}
                          >
                            Yok
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={activeTask?.max_score ?? 100}
                          step={0.5}
                          value={d.score}
                          onChange={(e) =>
                            setDraftScores((prev) => ({
                              ...prev,
                              [st.id]: { ...d, score: Number(e.target.value) },
                            }))
                          }
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-center text-indigo-700"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={d.note}
                          onChange={(e) =>
                            setDraftScores((prev) => ({
                              ...prev,
                              [st.id]: { ...d, note: e.target.value },
                            }))
                          }
                          placeholder="Eksik / görüş..."
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                        {st.weekly_total} / {weeklyMaxSum}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
