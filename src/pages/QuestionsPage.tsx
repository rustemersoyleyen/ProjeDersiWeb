import React, { useEffect, useState } from 'react';
import {
  Shuffle,
  Plus,
  Trash2,
  Edit2,
  Search,
  ListPlus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';
import type { ClassInfo, Course, Difficulty, Question } from '../types';

interface QuestionsPageProps {
  courses: Course[];
}

export const QuestionsPage: React.FC<QuestionsPageProps> = ({ courses }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<number>(courses[0]?.id ?? 1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [targetClassId, setTargetClassId] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Tekil soru formu
  const [editingId, setEditingId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('kolay');
  const [expectedHint, setExpectedHint] = useState('');

  // Toplu soru ekleme
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadQuestions = async (cid: number) => {
    const list = await api.getQuestions(cid);
    setQuestions(list);
  };

  useEffect(() => {
    api.getClasses().then((list) => {
      setClasses(list);
      if (list.length > 0) setTargetClassId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedCourseId) loadQuestions(selectedCourseId);
  }, [selectedCourseId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      if (editingId) {
        await api.updateQuestion({
          id: editingId,
          question_text: questionText.trim(),
          difficulty,
          expected_hint: expectedHint.trim(),
        });
        setMessage({ type: 'ok', text: 'Soru güncellendi.' });
      } else {
        await api.createQuestion({
          course_id: selectedCourseId,
          question_text: questionText.trim(),
          difficulty,
          expected_hint: expectedHint.trim(),
        });
        setMessage({ type: 'ok', text: 'Soru havuza eklendi.' });
      }
      setEditingId(null);
      setQuestionText('');
      setDifficulty('kolay');
      setExpectedHint('');
      await loadQuestions(selectedCourseId);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Soru kaydedilemedi.' });
    }
  };

  const handleBulkAdd = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const res = await api.bulkCreateQuestions(
      selectedCourseId,
      lines.map((question_text) => ({ question_text, difficulty: 'kolay' }))
    );
    setBulkText('');
    setShowBulk(false);
    setMessage({ type: 'ok', text: `${res.inserted} yeni teknik soru havuza eklendi.` });
    await loadQuestions(selectedCourseId);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu soruyu havuzdan silmek istediğinize emin misiniz?')) return;
    await api.deleteQuestion(id);
    await loadQuestions(selectedCourseId);
  };

  const handleAssignClassRandom = async (force: boolean) => {
    if (!targetClassId || !selectedCourseId) return;
    if (
      force &&
      !confirm(
        'Bu sınıftaki TÜM öğrencilerin seçili derse ait mevcut 3 sorusu yeniden rastgele çekilecek ve soru puanları sıfırlanacak. Onaylıyor musunuz?'
      )
    ) {
      return;
    }
    setAssigning(true);
    setMessage(null);
    try {
      const res = await api.assignRandomQuestions({
        class_id: targetClassId,
        course_id: selectedCourseId,
        force,
      });
      setMessage({
        type: 'ok',
        text: `${res.assigned_students} öğrenciye bu dersin havuzundan rastgele 3'er benzersiz teknik soru atandı ve veritabanına sabitlendi.`,
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Dağıtım başarısız.' });
    } finally {
      setAssigning(false);
    }
  };

  const filtered = questions.filter((q) => {
    const matchesDiff = diffFilter === 'all' || q.difficulty === diffFilter;
    const matchesSearch =
      q.question_text.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
      (q.expected_hint ?? '').toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'));
    return matchesDiff && matchesSearch;
  });

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teknik Soru Havuzu &amp; Rastgele 3 Soru Dağıtımı</h1>
          <p className="text-sm text-slate-500 mt-1">
            Her proje alanı için hazır 50+ basit ve projeye dönük soruyu yönetin; sınıftaki her öğrenciye tek tıkla 3 benzersiz soru dağıtın.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBulk(!showBulk)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-medium cursor-pointer"
        >
          <ListPlus className="w-4 h-4" /> Toplu Soru Ekle
        </button>
      </div>

      {/* Ders Sekmeleri */}
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
            {c.short_code} · {c.name}
          </button>
        ))}
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

      {/* Rastgele 3 Soru Dağıtım Kartı */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-base">
            <Shuffle className="w-5 h-5" />
            Rastgele 3 Soru Dağıt ({activeCourse?.name})
          </div>
          <p className="text-xs text-indigo-100">
            Havuzda şu an <strong>{questions.length} soru</strong> var. Seçilen sınıftaki her öğrenciye bu dersten birbirinden farklı 3 soru atanır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={targetClassId}
            onChange={(e) => setTargetClassId(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm text-slate-900 bg-white font-medium"
          >
            {classes.length === 0 && <option value={0}>Önce sınıf ekleyin</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.student_count} öğrenci)
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={assigning || !targetClassId}
            onClick={() => handleAssignClassRandom(false)}
            className="px-4 py-2 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 text-sm font-semibold cursor-pointer"
          >
            Eksiklere 3&apos;er Soru Ata
          </button>

          <button
            type="button"
            disabled={assigning || !targetClassId}
            onClick={() => handleAssignClassRandom(true)}
            className="px-3.5 py-2 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/60 border border-white/25 text-white text-xs font-medium cursor-pointer"
          >
            Tüm Sınıfı Yeniden Kura Çek
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {activeCourse?.name} — Toplu Soru Ekle (Her satıra 1 soru)
          </h2>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Her satıra bir teknik soru yazıp ekleyin..."
            className="w-full border border-slate-300 rounded-lg p-3 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBulk(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-600 cursor-pointer"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleBulkAdd}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium cursor-pointer"
            >
              Soruları Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Tekil Soru Formu */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {editingId ? 'Soruyu Düzenle' : `${activeCourse?.name} Havuzuna Yeni Soru Ekle`}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setQuestionText('');
                setExpectedHint('');
              }}
              className="text-xs text-slate-500 underline cursor-pointer"
            >
              İptal
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <input
              type="text"
              required
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Teknik soru metnini yazın..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-3">
            <input
              type="text"
              value={expectedHint}
              onChange={(e) => setExpectedHint(e.target.value)}
              placeholder="Öğretmen ipucu / beklenen cevap (ops.)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-1">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
            >
              <option value="kolay">Kolay</option>
              <option value="orta">Orta</option>
              <option value="zor">Zor</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {editingId ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      </form>

      {/* Soru Havuzu Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-sm text-slate-800">
            {activeCourse?.name} Soru Havuzu ({filtered.length} / {questions.length})
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={diffFilter}
              onChange={(e) => setDiffFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="all">Tüm Zorluklar</option>
              <option value="kolay">Kolay</option>
              <option value="orta">Orta</option>
              <option value="zor">Zor</option>
            </select>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Soru ara..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-56"
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
          {filtered.map((q, index) => (
            <div key={q.id} className="px-4 py-3 flex items-start justify-between gap-4 hover:bg-slate-50">
              <div className="space-y-1">
                <div className="text-sm text-slate-900">
                  <span className="font-mono text-xs text-slate-400 mr-2">#{index + 1}</span>
                  {q.question_text}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      q.difficulty === 'kolay'
                        ? 'bg-emerald-50 text-emerald-700'
                        : q.difficulty === 'orta'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {q.difficulty}
                  </span>
                  {q.expected_hint && (
                    <span className="text-xs text-slate-500">İpucu: {q.expected_hint}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setEditingId(q.id);
                    setQuestionText(q.question_text);
                    setDifficulty(q.difficulty);
                    setExpectedHint(q.expected_hint ?? '');
                  }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
