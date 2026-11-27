import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Shuffle,
  Save,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  FolderKanban,
  HelpCircle,
  Sparkles,
  CalendarCheck,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  ClassInfo,
  Course,
  EvaluationData,
  Outcome,
  Question,
  Student,
  Subject,
} from '../types';
import { QUESTION_TYPE_META } from './QuestionsPage';

interface EvaluatePageProps {
  subjects: Subject[];
  courses: Course[];
  outcomes: Outcome[];
  initialSelection?: { classId?: number; courseId?: number; studentId?: number } | null;
}

export const EvaluatePage: React.FC<EvaluatePageProps> = ({
  subjects,
  courses,
  outcomes,
  initialSelection,
}) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<number>(initialSelection?.classId ?? 0);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(
    initialSelection?.courseId ?? courses[0]?.id ?? 1
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number>(
    initialSelection?.studentId ?? 0
  );

  const [evalData, setEvalData] = useState<EvaluationData | null>(null);
  const [coursePool, setCoursePool] = useState<Question[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Düzenlenebilir form state
  const [critScores, setCritScores] = useState<
    Record<number, { selected_level: number | null; score: number }>
  >({});
  const [finalCompletionScore, setFinalCompletionScore] = useState<string>('');
  const [finalReportScore, setFinalReportScore] = useState<string>('');
  const [visionNote, setVisionNote] = useState<string>('');
  const [qScores, setQScores] = useState<Record<number, { score: string; note: string }>>({});
  const [notes, setNotes] = useState('');
  const [swappingSqId, setSwappingSqId] = useState<number | null>(null);

  const visibleCourses = useMemo(
    () =>
      selectedSubjectId > 0
        ? courses.filter((c) => c.subject_id === selectedSubjectId)
        : courses,
    [courses, selectedSubjectId]
  );

  useEffect(() => {
    if (visibleCourses.length > 0 && !visibleCourses.some((c) => c.id === selectedCourseId)) {
      setSelectedCourseId(visibleCourses[0].id);
    }
  }, [visibleCourses, selectedCourseId]);

  useEffect(() => {
    api.getClasses().then((list) => {
      setClasses(list);
      if (initialSelection?.classId) {
        setSelectedClassId(initialSelection.classId);
      } else if (list.length > 0 && selectedClassId === 0) {
        setSelectedClassId(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    api.getStudents(selectedClassId).then((list) => {
      setStudents(list);
      if (list.length > 0) {
        const hasSelected = list.some((s) => s.id === selectedStudentId);
        if (!hasSelected) {
          setSelectedStudentId(list[0].id);
        }
      } else {
        setSelectedStudentId(0);
        setEvalData(null);
      }
    });
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedCourseId) {
      api.getQuestions(selectedCourseId).then(setCoursePool);
    }
  }, [selectedCourseId]);

  const loadEvaluation = async (sid: number, cid: number) => {
    if (!sid || !cid) {
      setEvalData(null);
      return;
    }
    setLoadingEval(true);
    setMessage(null);
    try {
      const data = await api.getEvaluation(sid, cid);
      setEvalData(data);

      const cMap: Record<number, { selected_level: number | null; score: number }> = {};
      for (const cr of data.criteria) {
        const existing = data.scores[String(cr.id)];
        cMap[cr.id] = existing
          ? { selected_level: existing.selected_level, score: existing.score }
          : { selected_level: null, score: 0 };
      }
      setCritScores(cMap);

      setFinalCompletionScore(
        data.evaluation?.final_completion_score !== null &&
          data.evaluation?.final_completion_score !== undefined
          ? String(data.evaluation.final_completion_score)
          : ''
      );
      setFinalReportScore(
        data.evaluation?.final_report_score !== null &&
          data.evaluation?.final_report_score !== undefined
          ? String(data.evaluation.final_report_score)
          : ''
      );
      setVisionNote(data.student.initial_vision_note ?? '');

      const qMap: Record<number, { score: string; note: string }> = {};
      for (const q of data.questions) {
        qMap[q.id] = {
          score: q.score !== null ? String(q.score) : '',
          note: q.note ?? '',
        };
      }
      setQScores(qMap);
      setNotes(data.evaluation?.notes ?? '');
    } finally {
      setLoadingEval(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId && selectedCourseId) {
      loadEvaluation(selectedStudentId, selectedCourseId);
    }
  }, [selectedStudentId, selectedCourseId]);

  const isWeeklyMode = evalData?.course.evaluation_mode === 'weekly_plus_final';
  const showQuestionsBlock = (evalData?.course.question_points ?? 20) > 0;

  const rubricTotal = useMemo(() => {
    if (isWeeklyMode) {
      const c = parseFloat(finalCompletionScore) || 0;
      const r = parseFloat(finalReportScore) || 0;
      return Number((c + r).toFixed(2));
    }
    return Object.values(critScores).reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  }, [critScores, isWeeklyMode, finalCompletionScore, finalReportScore]);

  const weeklyEarned = evalData?.weekly_summary.earned ?? 0;

  const questionTotal = useMemo(() => {
    return Object.values(qScores).reduce((sum, item) => {
      const n = parseFloat(item.score);
      return sum + (Number.isFinite(n) && n >= 0 ? n : 0);
    }, 0);
  }, [qScores]);

  const grandTotal = Number(
    ((isWeeklyMode ? weeklyEarned : 0) + rubricTotal + questionTotal).toFixed(2)
  );

  const handleAssignRandomForStudent = async (force: boolean) => {
    if (!selectedStudentId || !selectedCourseId) return;
    setMessage(null);
    try {
      await api.assignRandomQuestions({
        student_id: selectedStudentId,
        course_id: selectedCourseId,
        force,
      });
      await loadEvaluation(selectedStudentId, selectedCourseId);
      const updatedStudents = await api.getStudents(selectedClassId);
      setStudents(updatedStudents);
      setMessage({
        type: 'ok',
        text: 'Öğrenci için 1 Teknik (Kolay) + 1 Teknik (Orta/Zor) + 1 Yorum & Hayal sorusu getirildi.',
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Soru atanamadı.' });
    }
  };

  const handleSwapQuestion = async (sqId: number, newQuestionId: number) => {
    try {
      await api.replaceStudentQuestion(sqId, newQuestionId);
      setSwappingSqId(null);
      await loadEvaluation(selectedStudentId, selectedCourseId);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Soru değiştirilemedi.' });
    }
  };

  const handleSave = async (goNext: boolean) => {
    if (!evalData) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.saveEvaluation({
        student_id: evalData.student.id,
        course_id: evalData.course.id,
        notes,
        initial_vision_note: visionNote,
        final_completion_score: isWeeklyMode
          ? finalCompletionScore === ''
            ? 0
            : Number(finalCompletionScore)
          : null,
        final_report_score: isWeeklyMode
          ? finalReportScore === ''
            ? 0
            : Number(finalReportScore)
          : null,
        criteria_scores: evalData.criteria.map((cr) => ({
          criterion_id: cr.id,
          selected_level: critScores[cr.id]?.selected_level ?? null,
          score: Number(critScores[cr.id]?.score) || 0,
        })),
        question_scores: evalData.questions.map((q) => {
          const val = qScores[q.id]?.score ?? '';
          return {
            id: q.id,
            score: val === '' ? null : Number(val),
            note: qScores[q.id]?.note ?? '',
          };
        }),
      });

      const updatedStudents = await api.getStudents(selectedClassId);
      setStudents(updatedStudents);

      if (goNext) {
        const idx = updatedStudents.findIndex((s) => s.id === evalData.student.id);
        if (idx >= 0 && idx < updatedStudents.length - 1) {
          setSelectedStudentId(updatedStudents[idx + 1].id);
          return;
        }
      }
      setMessage({
        type: 'ok',
        text: `${evalData.student.full_name} — ${evalData.course.name} notu kaydedildi (${grandTotal} puan).`,
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Kaydedilemedi.' });
    } finally {
      setSaving(false);
    }
  };

  const rubricOutcomes = outcomes.filter((o) => !o.is_question_outcome);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proje &amp; Uygulama Değerlendirme Ekranı</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Standart rubik, <strong>Haftalık Takip + Proje Sonu Final (Bitim + Rapor + 3 Soru)</strong> veya <strong>Uygulama Ödevi</strong> puanlamasını buradan yapın.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {subjects.length > 1 && (
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium"
            >
              <option value={0}>Tüm Ana Dersler</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

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
      </div>

      {/* Uygulama / Proje Sekmeleri */}
      <div className="flex flex-wrap gap-2">
        {visibleCourses.map((c) => (
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
          </button>
        ))}
      </div>

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

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* Sol: Öğrenci Listesi */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-xs uppercase text-slate-600">
            Öğrenciler ({students.length})
          </div>
          <div className="divide-y divide-slate-100 max-h-[72vh] overflow-y-auto">
            {students.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                Bu sınıfta öğrenci bulunmuyor.
              </div>
            )}
            {students.map((st) => {
              const ev = st.evaluations[String(selectedCourseId)];
              const qCnt = st.question_counts[String(selectedCourseId)] ?? 0;
              const cp = st.course_projects?.[String(selectedCourseId)];
              const effectiveTitle = cp?.custom_title || cp?.project_title || st.project_title;
              const isSelected = st.id === selectedStudentId;
              return (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setSelectedStudentId(st.id)}
                  className={`w-full text-left px-3.5 py-3 transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 border-l-4 border-indigo-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      <span className="font-mono text-xs text-slate-400 mr-1.5">{st.student_no}</span>
                      {st.full_name}
                    </div>
                    {ev ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                        {ev.total_score}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] shrink-0">
                        Bekliyor
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 gap-2">
                    <span className="truncate">{effectiveTitle || 'Proje atanmadı'}</span>
                    <span className={qCnt >= 3 ? 'text-indigo-600 font-medium shrink-0' : 'text-amber-600 shrink-0'}>
                      {qCnt}/3 soru
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sağ: Seçili Öğrencinin Değerlendirme Formu */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {loadingEval ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
              Değerlendirme formu yükleniyor...
            </div>
          ) : !evalData ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
              Değerlendirmek için soldan bir öğrenci seçin.
            </div>
          ) : (
            <>
              {/* Öğrenci & Proje Başlık Kartı */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold">
                      {evalData.course.name}
                    </span>
                    {isWeeklyMode && (
                      <span className="px-2 py-0.5 rounded-lg bg-violet-100 text-violet-800 text-[11px] font-semibold">
                        Haftalık Süreç + Proje Sonu Final
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {evalData.student.class_name} · No: {evalData.student.student_no}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    {evalData.student.full_name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-sm text-amber-800 mt-1">
                    <FolderKanban className="w-4 h-4 text-amber-600" />
                    <span className="font-medium">
                      Proje / Ödev: {evalData.student.project_title || 'Henüz proje atanmamış'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-wrap">
                  {isWeeklyMode && (
                    <>
                      <div className="text-right">
                        <div className="text-[11px] uppercase text-violet-600 font-semibold">Haftalık</div>
                        <div className="text-base font-bold text-slate-800">{weeklyEarned.toFixed(1)}</div>
                      </div>
                      <div className="text-slate-300 font-bold">+</div>
                    </>
                  )}
                  <div className="text-right">
                    <div className="text-[11px] uppercase text-slate-500 font-semibold">
                      {isWeeklyMode ? 'Bitim+Rapor' : 'Rubik'}
                    </div>
                    <div className="text-base font-bold text-slate-800">{rubricTotal.toFixed(1)}</div>
                  </div>
                  {showQuestionsBlock && (
                    <>
                      <div className="text-slate-300 font-bold">+</div>
                      <div className="text-right">
                        <div className="text-[11px] uppercase text-slate-500 font-semibold">3 Soru</div>
                        <div className="text-base font-bold text-slate-800">{questionTotal.toFixed(1)}</div>
                      </div>
                    </>
                  )}
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="text-right">
                    <div className="text-[11px] uppercase text-indigo-600 font-bold">Toplam Not</div>
                    <div className="text-2xl font-extrabold text-indigo-700">{grandTotal}</div>
                  </div>
                </div>
              </div>

              {/* MOD B: HAFTALIK SÜREÇ ÖZETİ + PROJE SONU FİNAL (SADECE BİTİM + RAPOR + 3 SORU) */}
              {isWeeklyMode ? (
                <>
                  {/* Haftalık Kontroller Özeti */}
                  <div className="bg-white rounded-xl border border-violet-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-3 bg-violet-50 border-b border-violet-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-sm text-violet-950">
                        <CalendarCheck className="w-4 h-4 text-violet-600" />
                        Haftalık Süreç Kontrolleri Özeti
                      </div>
                      <span className="text-xs font-bold text-violet-800">
                        {evalData.weekly_summary.earned} / {evalData.weekly_summary.max} Puan
                      </span>
                    </div>
                    {evalData.weekly_items.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500">
                        Bu proje için henüz haftalık görev tanımlanmamış. Sol menüdeki <strong>Haftalık Takip</strong> ekranından ekleyebilirsiniz.
                      </div>
                    ) : (
                      <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {evalData.weekly_items.map((w) => (
                          <div
                            key={w.id}
                            className={`p-2.5 rounded-lg border text-xs ${
                              w.status === 'done'
                                ? 'bg-emerald-50 border-emerald-200'
                                : w.status === 'partial'
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex justify-between font-bold text-slate-800">
                              <span>H{w.week_no}</span>
                              <span>
                                {w.score} / {w.max_score}p
                              </span>
                            </div>
                            <div className="text-slate-600 truncate mt-0.5" title={w.title}>
                              {w.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Proje Sonu Final: Yalnızca Proje Bitimi ve Rapor */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-900">
                      Proje Sonu Final Kontrolü (Proje Bitimi &amp; Rapor)
                    </div>
                    <div className="p-4 grid sm:grid-cols-2 gap-4">
                      {/* 1. Proje Bitimi */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-slate-900">
                            1. Proje Bitimi / Çalışırlık
                          </span>
                          <span className="text-xs font-bold text-indigo-700">
                            Maks. {evalData.course.final_completion_points}p
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {[0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = Number(
                              (evalData.course.final_completion_points * ratio).toFixed(1)
                            );
                            return (
                              <button
                                key={ratio}
                                type="button"
                                onClick={() => setFinalCompletionScore(String(val))}
                                className="flex-1 py-1.5 rounded-lg border border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50 text-xs font-semibold cursor-pointer"
                              >
                                %{ratio * 100} ({val})
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={evalData.course.final_completion_points}
                          step={0.5}
                          placeholder="0"
                          value={finalCompletionScore}
                          onChange={(e) => setFinalCompletionScore(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700"
                        />
                      </div>

                      {/* 2. Proje Raporu */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-slate-900">
                            2. Proje Raporu &amp; Dokümantasyon
                          </span>
                          <span className="text-xs font-bold text-indigo-700">
                            Maks. {evalData.course.final_report_points}p
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {[0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = Number(
                              (evalData.course.final_report_points * ratio).toFixed(1)
                            );
                            return (
                              <button
                                key={ratio}
                                type="button"
                                onClick={() => setFinalReportScore(String(val))}
                                className="flex-1 py-1.5 rounded-lg border border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50 text-xs font-semibold cursor-pointer"
                              >
                                %{ratio * 100} ({val})
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={evalData.course.final_report_points}
                          step={0.5}
                          placeholder="0"
                          value={finalReportScore}
                          onChange={(e) => setFinalReportScore(e.target.value)}
                          className="w-full border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* MOD A & C: STANDART RUBİK veya UYGULAMA ÖDEVİ KRİTERLERİ */
                rubricOutcomes.map((outcome) => {
                  const list = evalData.criteria.filter((c) => c.outcome_id === outcome.id);
                  if (list.length === 0) return null;
                  const outcomeMax = list.reduce((s, c) => s + c.max_score, 0);
                  const outcomeEarned = list.reduce(
                    (s, c) => s + (Number(critScores[c.id]?.score) || 0),
                    0
                  );

                  return (
                    <div
                      key={outcome.id}
                      className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
                    >
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="font-semibold text-sm text-slate-900">
                          <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-bold mr-2">
                            {outcome.code}
                          </span>
                          {outcome.name}
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {outcomeEarned.toFixed(1)} / {outcomeMax} Puan
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {list.map((cr) => {
                          const state = critScores[cr.id] ?? { selected_level: null, score: 0 };
                          return (
                            <div key={cr.id} className="p-4 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-medium text-slate-900">{cr.name}</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">Puan:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={cr.max_score}
                                    step={0.5}
                                    value={state.score}
                                    onChange={(e) =>
                                      setCritScores((prev) => ({
                                        ...prev,
                                        [cr.id]: {
                                          selected_level: null,
                                          score: Math.min(
                                            cr.max_score,
                                            Math.max(0, Number(e.target.value))
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-center text-indigo-700"
                                  />
                                  <span className="text-xs text-slate-400">/ {cr.max_score}</span>
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                {cr.rubric_levels.map((lv) => {
                                  const active = state.selected_level === lv.level;
                                  return (
                                    <button
                                      type="button"
                                      key={lv.level}
                                      onClick={() =>
                                        setCritScores((prev) => ({
                                          ...prev,
                                          [cr.id]: { selected_level: lv.level, score: lv.points },
                                        }))
                                      }
                                      className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                                        active
                                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between text-xs font-bold">
                                        <span>{lv.label}</span>
                                        <span className={active ? 'text-indigo-100' : 'text-indigo-700'}>
                                          {lv.points}p
                                        </span>
                                      </div>
                                      <div
                                        className={`text-[11px] mt-1 leading-snug ${
                                          active ? 'text-indigo-100' : 'text-slate-500'
                                        }`}
                                      >
                                        {lv.description}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}

              {/* PROJE BAŞLANGIÇ HAYALİ / HEDEFİ VURGU KARTI (Teknik Sorular Öncesi) */}
              {showQuestionsBlock && (
                <div className="bg-fuchsia-50/70 border border-fuchsia-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-900">
                    <Sparkles className="w-4 h-4 text-fuchsia-600" />
                    Proje Başlangıç Hayali / Hedefi Notu (Soru sorarken referans alınır)
                  </div>
                  <input
                    type="text"
                    value={visionNote}
                    onChange={(e) => setVisionNote(e.target.value)}
                    placeholder="Proje başında öğrencinin hayal ettiği/hedeflediği özellik (örn: barkod okuyucu eklemek istiyordu)..."
                    className="w-full border border-fuchsia-200 bg-white rounded-lg px-3 py-2 text-sm text-slate-800"
                  />
                </div>
              )}

              {/* 5. Kazanım: Teknik Soru/Cevap (3 Akıllı Soru) */}
              {showQuestionsBlock && (
                <div className="bg-white rounded-xl border border-indigo-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-indigo-950">
                      <HelpCircle className="w-4 h-4 text-indigo-600" />
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-xs font-bold">
                        K5
                      </span>
                      Teknik Soru / Cevap (S1 Kolay · S2 Orta/Zor · S3 Yorum &amp; Hayal — Maks.{' '}
                      {evalData.course.question_points}p)
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-800 mr-1">
                        {questionTotal.toFixed(1)} / {evalData.course.question_points} Puan
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAssignRandomForStudent(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        {evalData.questions.length === 0 ? 'Akıllı 3 Soru Getir' : 'Soruları Yenile'}
                      </button>
                    </div>
                  </div>

                  {evalData.questions.length === 0 ? (
                    <div className="p-6 text-center space-y-3">
                      <p className="text-sm text-slate-500">
                        Bu öğrenciye <strong>{evalData.course.name}</strong> için henüz 3 soru atanmamış.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAssignRandomForStudent(false)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
                      >
                        <Shuffle className="w-4 h-4" /> Akıllı 3 Soru Ata
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {evalData.questions.map((q, idx) => {
                        const qs = qScores[q.id] ?? { score: '', note: '' };
                        const qt = q.question_type || 'technical_easy';
                        const meta = QUESTION_TYPE_META[qt] ?? QUESTION_TYPE_META.technical_easy;
                        return (
                          <div key={q.id} className="p-4 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex-1 min-w-[240px]">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badgeClass}`}>
                                    {meta.short}
                                  </span>
                                </div>
                                <div className="text-sm font-semibold text-slate-900">
                                  <span className="text-indigo-600 mr-1.5">Soru {idx + 1}:</span>
                                  {q.question_text}
                                </div>
                                {q.expected_hint && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    <strong>İpucu:</strong> {q.expected_hint}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setSwappingSqId(swappingSqId === q.id ? null : q.id)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                                  title="Bu soruyu havuzdan başka bir soruyla değiştir"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={q.max_score}
                                  step={0.5}
                                  placeholder="0"
                                  value={qs.score}
                                  onChange={(e) =>
                                    setQScores((prev) => ({
                                      ...prev,
                                      [q.id]: {
                                        ...qs,
                                        score: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-center text-indigo-700"
                                />
                                <span className="text-xs text-slate-500">/ {q.max_score}p</span>
                              </div>
                            </div>

                            {swappingSqId === q.id && (
                              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                <select
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) handleSwapQuestion(q.id, Number(e.target.value));
                                  }}
                                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                                >
                                  <option value="">-- Havuzdan yeni soru seçin --</option>
                                  {coursePool.map((pq) => (
                                    <option key={pq.id} value={pq.id}>
                                      [{QUESTION_TYPE_META[pq.question_type || 'technical_easy'].short}] {pq.question_text}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Öğretmen Notu & Kaydet Butonları */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Öğretmen Değerlendirme Notu (Opsiyonel)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Öğrencinin proje sunumu veya kod kalitesi hakkında kısa görüş..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-500">
                    Sorumlu Öğretmen(ler):{' '}
                    <strong>
                      {evalData.teachers.length > 0
                        ? evalData.teachers.map((t) => t.full_name).join(', ')
                        : 'Ders Öğretmenleri ekranından atanabilir'}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSave(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Kaydediliyor...' : 'Değerlendirmeyi Kaydet'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSave(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold cursor-pointer"
                    >
                      Kaydet &amp; Sonraki
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
