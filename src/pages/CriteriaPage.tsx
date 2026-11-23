import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import { api } from '../api/client';
import type { Course, Criterion, Outcome, RubricLevel } from '../types';

interface CriteriaPageProps {
  courses: Course[];
  onCoursesChanged: () => Promise<void>;
}

function makeDefaultLevels(maxScore: number): RubricLevel[] {
  return [
    { level: 1, label: 'Geliştirilmeli', description: 'Temel beklentiler karşılanmamış', points: Number((maxScore * 0.25).toFixed(1)) },
    { level: 2, label: 'Orta', description: 'Kısmen karşılanmış, eksikler mevcut', points: Number((maxScore * 0.5).toFixed(1)) },
    { level: 3, label: 'İyi', description: 'Beklentiler büyük ölçüde karşılanmış', points: Number((maxScore * 0.75).toFixed(1)) },
    { level: 4, label: 'Çok İyi', description: 'Eksiksiz ve örnek düzeyde', points: Number(maxScore.toFixed(1)) },
  ];
}

export const CriteriaPage: React.FC<CriteriaPageProps> = ({ courses, onCoursesChanged }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<number>(courses[0]?.id ?? 1);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [questionPoints, setQuestionPoints] = useState<number>(20);
  const [message, setMessage] = useState<string>('');

  // Kriter Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [outcomeId, setOutcomeId] = useState<number>(1);
  const [name, setName] = useState('');
  const [maxScore, setMaxScore] = useState<number>(10);
  const [levels, setLevels] = useState<RubricLevel[]>(makeDefaultLevels(10));

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  const load = async (cid: number) => {
    const res = await api.getCriteria(cid);
    setOutcomes(res.outcomes);
    setCriteria(res.criteria);
  };

  useEffect(() => {
    if (selectedCourseId) {
      load(selectedCourseId);
      const found = courses.find((c) => c.id === selectedCourseId);
      if (found) setQuestionPoints(found.question_points);
    }
  }, [selectedCourseId, courses]);

  const rubricSum = criteria.reduce((acc, c) => acc + c.max_score, 0);
  const grandTotal = rubricSum + questionPoints;

  const resetForm = () => {
    setEditingId(null);
    setOutcomeId(outcomes.find((o) => !o.is_question_outcome)?.id ?? 1);
    setName('');
    setMaxScore(10);
    setLevels(makeDefaultLevels(10));
  };

  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (editingId) {
      await api.updateCriterion({
        id: editingId,
        outcome_id: outcomeId,
        name: name.trim(),
        max_score: maxScore,
        rubric_levels: levels,
      });
      setMessage('Değerlendirme kriteri güncellendi.');
    } else {
      await api.createCriterion({
        course_id: selectedCourseId,
        outcome_id: outcomeId,
        name: name.trim(),
        max_score: maxScore,
        rubric_levels: levels,
      });
      setMessage('Yeni rubik kriteri eklendi.');
    }
    resetForm();
    await load(selectedCourseId);
  };

  const handleSaveQuestionPoints = async () => {
    if (!activeCourse) return;
    await api.updateCourse({
      id: activeCourse.id,
      name: activeCourse.name,
      short_code: activeCourse.short_code,
      description: activeCourse.description ?? '',
      question_points: questionPoints,
      sort_order: activeCourse.sort_order,
    });
    await onCoursesChanged();
    setMessage('5. Teknik Soru/Cevap kazanım puanı güncellendi.');
  };

  const handleEdit = (cr: Criterion) => {
    setEditingId(cr.id);
    setOutcomeId(cr.outcome_id);
    setName(cr.name);
    setMaxScore(cr.max_score);
    setLevels(cr.rubric_levels.length > 0 ? cr.rubric_levels : makeDefaultLevels(cr.max_score));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu değerlendirme kriterini silmek istediğinize emin misiniz?')) return;
    await api.deleteCriterion(id);
    await load(selectedCourseId);
  };

  const rubricOutcomes = outcomes.filter((o) => !o.is_question_outcome);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kazanımlar &amp; Rubik Değerlendirme Kriterleri</h1>
        <p className="text-sm text-slate-500 mt-1">
          Her proje alanı için <strong>5 temel kazanım (Planlama, Tasarım, Kodlama, Rapor, Teknik Soru/Cevap)</strong> altında kriterleri ve 4 kademeli rubik düzeylerini yönetin.
        </p>
      </div>

      {/* Ders Sekmeleri */}
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCourseId(c.id);
              resetForm();
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition cursor-pointer ${
              selectedCourseId === c.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.short_code} · {c.name}
          </button>
        ))}
      </div>

      {/* Toplam Puan Göstergesi */}
      <div
        className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
          Math.abs(grandTotal - 100) < 0.01
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2.5 text-sm">
          {Math.abs(grandTotal - 100) < 0.01 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <span>
            <strong>{activeCourse?.name}</strong> Toplam Puanı:{' '}
            <strong>{rubricSum}</strong> (1-4. Kazanımlar) + <strong>{questionPoints}</strong> (5. Teknik Soru/Cevap) ={' '}
            <strong className="text-base">{grandTotal} / 100</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium">5. Teknik Soru/Cevap Puanı:</label>
          <input
            type="number"
            min={0}
            max={100}
            value={questionPoints}
            onChange={(e) => setQuestionPoints(Number(e.target.value))}
            className="w-20 border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-sm font-semibold text-center"
          />
          <button
            type="button"
            onClick={handleSaveQuestionPoints}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Kaydet
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}

      {/* Kriter Ekle / Düzenle Formu */}
      <form
        onSubmit={handleSaveCriterion}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {editingId ? 'Kriteri Düzenle' : 'Yeni Değerlendirme Kriteri Ekle'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-500 underline cursor-pointer"
            >
              İptal
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-12 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Kazanım</label>
            <select
              value={outcomeId}
              onChange={(e) => setOutcomeId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {rubricOutcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-7">
            <label className="block text-xs font-medium text-slate-600 mb-1">Kriter Açıklaması *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Temiz kod, isimlendirme ve hata yakalama"
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
              value={maxScore}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaxScore(v);
                setLevels(makeDefaultLevels(v));
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
            />
          </div>
        </div>

        {/* 4 Kademeli Rubik Düzey Editörü */}
        <div>
          <div className="text-xs font-medium text-slate-600 mb-2">Rubik Düzey Açıklamaları &amp; Puanları</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {levels.map((lv, idx) => (
              <div key={lv.level} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={lv.label}
                    onChange={(e) => {
                      const next = [...levels];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setLevels(next);
                    }}
                    className="font-semibold text-xs text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 w-full"
                  />
                  <input
                    type="number"
                    step={0.5}
                    value={lv.points}
                    onChange={(e) => {
                      const next = [...levels];
                      next[idx] = { ...next[idx], points: Number(e.target.value) };
                      setLevels(next);
                    }}
                    className="w-16 text-xs font-bold text-indigo-700 bg-white border border-slate-200 rounded px-2 py-1 text-center"
                  />
                </div>
                <textarea
                  rows={2}
                  value={lv.description}
                  onChange={(e) => {
                    const next = [...levels];
                    next[idx] = { ...next[idx], description: e.target.value };
                    setLevels(next);
                  }}
                  className="w-full text-xs bg-white border border-slate-200 rounded p-1.5 text-slate-600"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {editingId ? 'Kriteri Güncelle' : 'Kriteri Ekle'}
          </button>
        </div>
      </form>

      {/* Kazanımlara Göre Gruplanmış Kriterler */}
      <div className="space-y-4">
        {outcomes.map((outcome) => {
          const list = criteria.filter((c) => c.outcome_id === outcome.id);
          const subtotal = outcome.is_question_outcome
            ? questionPoints
            : list.reduce((s, c) => s + c.max_score, 0);

          return (
            <div key={outcome.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-bold mr-2">
                    {outcome.code}
                  </span>
                  <span className="font-semibold text-sm text-slate-900">{outcome.name}</span>
                  {outcome.description && (
                    <span className="text-xs text-slate-500 ml-2 hidden sm:inline">— {outcome.description}</span>
                  )}
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Toplam: {subtotal} Puan
                </span>
              </div>

              {outcome.is_question_outcome ? (
                <div className="p-4 text-sm text-slate-600">
                  Bu kazanım, <strong>Teknik Soru Havuzu</strong> ekranından her öğrenciye rastgele atanan{' '}
                  <strong>3 benzersiz teknik sorunun</strong> puanlanmasıyla otomatik hesaplanır (Toplam{' '}
                  <strong>{questionPoints} puan</strong>).
                </div>
              ) : list.length === 0 ? (
                <div className="p-4 text-xs text-slate-400">Bu kazanım altında henüz kriter yok.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {list.map((cr) => (
                    <div key={cr.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm text-slate-900">{cr.name}</div>
                          <div className="text-xs text-indigo-600 font-semibold mt-0.5">
                            Maksimum: {cr.max_score} Puan
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(cr)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cr.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-4 gap-2">
                        {cr.rubric_levels.map((lv) => (
                          <div key={lv.level} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                            <div className="flex justify-between font-semibold text-slate-700">
                              <span>{lv.label}</span>
                              <span className="text-indigo-700">{lv.points}p</span>
                            </div>
                            <div className="text-slate-500 mt-0.5 text-[11px]">{lv.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
