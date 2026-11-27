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
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import type { ClassInfo, Course, Difficulty, Question, QuestionType } from '../types';

interface QuestionsPageProps {
  courses: Course[];
}

export const QUESTION_TYPE_META: Record<
  QuestionType,
  { label: string; short: string; badgeClass: string }
> = {
  technical_easy: {
    label: 'S1 · Teknik (Kolay)',
    short: 'Teknik · Kolay',
    badgeClass: 'bg-sky-50 text-sky-800 border border-sky-200',
  },
  technical_hard: {
    label: 'S2 · Teknik (Orta/Zor)',
    short: 'Teknik · Orta/Zor',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
  },
  vision_comment: {
    label: 'S3 · Yorum & Hayal Gücü',
    short: 'Yorum & Hayal',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200',
  },
};

export const QuestionsPage: React.FC<QuestionsPageProps> = ({ courses }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<number>(courses[0]?.id ?? 1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [targetClassId, setTargetClassId] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Tekil soru formu
  const [editingId, setEditingId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('kolay');
  const [questionType, setQuestionType] = useState<QuestionType>('technical_easy');
  const [expectedHint, setExpectedHint] = useState('');

  // Toplu soru ekleme
  const [showBulk, setShowBulk] = useState(false);
  const [bulkType, setBulkType] = useState<QuestionType>('vision_comment');
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
          question_type: questionType,
          expected_hint: expectedHint.trim(),
        });
        setMessage({ type: 'ok', text: 'Soru güncellendi.' });
      } else {
        await api.createQuestion({
          course_id: selectedCourseId,
          question_text: questionText.trim(),
          difficulty,
          question_type: questionType,
          expected_hint: expectedHint.trim(),
        });
        setMessage({ type: 'ok', text: 'Soru havuza eklendi.' });
      }
      setEditingId(null);
      setQuestionText('');
      setDifficulty('kolay');
      setQuestionType('technical_easy');
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
      bulkType,
      lines.map((question_text) => ({
        question_text,
        difficulty: bulkType === 'technical_hard' ? 'orta' : 'kolay',
        question_type: bulkType,
      }))
    );
    setBulkText('');
    setShowBulk(false);
    setMessage({ type: 'ok', text: `${res.inserted} yeni soru (${QUESTION_TYPE_META[bulkType].short}) havuza eklendi.` });
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
        'Bu sınıftaki TÜM öğrencilerin seçili derse ait mevcut 3 sorusu yeniden dengeli (1 Teknik Kolay + 1 Teknik Orta/Zor + 1 Yorum & Hayal) olarak çekilecek ve soru puanları sıfırlanacak. Onaylıyor musunuz?'
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
        text: `${res.assigned_students} öğrenciye 1 Teknik (Kolay) + 1 Teknik (Orta/Zor) + 1 Yorum & Hayal sorusu olmak üzere 3'er benzersiz soru atandı.`,
      });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Dağıtım başarısız.' });
    } finally {
      setAssigning(false);
    }
  };

  const counts = {
    technical_easy: questions.filter((q) => (q.question_type || 'technical_easy') === 'technical_easy').length,
    technical_hard: questions.filter((q) => q.question_type === 'technical_hard').length,
    vision_comment: questions.filter((q) => q.question_type === 'vision_comment').length,
  };

  const filtered = questions.filter((q) => {
    const qType = q.question_type || 'technical_easy';
    const matchesType = typeFilter === 'all' || qType === typeFilter;
    const matchesSearch =
      q.question_text.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
      (q.expected_hint ?? '').toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'));
    return matchesType && matchesSearch;
  });

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Akıllı 3 Kategorili Teknik &amp; Yorum Soru Havuzu
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Her öğrenciye otomatik olarak <strong>1 Teknik (Kolay) + 1 Teknik (Orta/Zor) + 1 Proje Yorum &amp; Hayal Gücü</strong> sorusu dağıtılır.
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
            {c.name}
          </button>
        ))}
      </div>

      {/* 3 Kategori Özet Sayaçları */}
      <div className="grid sm:grid-cols-3 gap-3">
        {(['technical_easy', 'technical_hard', 'vision_comment'] as QuestionType[]).map((qt) => (
          <button
            key={qt}
            type="button"
            onClick={() => setTypeFilter(typeFilter === qt ? 'all' : qt)}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
              typeFilter === qt
                ? 'ring-2 ring-indigo-500 bg-white border-indigo-300'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${QUESTION_TYPE_META[qt].badgeClass}`}>
                {QUESTION_TYPE_META[qt].label}
              </span>
              <span className="text-xl font-extrabold text-slate-900">{counts[qt]}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {qt === 'technical_easy' && 'Temel kod, tasarım ve veritabanı uygulama soruları'}
              {qt === 'technical_hard' && 'Veri akışı, bağlantılar, hata ve problem çözme soruları'}
              {qt === 'vision_comment' && 'Düşündüren, hayal kurduran ve başlangıç hedefini sorgulayan sorular'}
            </p>
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

      {/* Dengeli Rastgele 3 Soru Dağıtım Kartı */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-base">
            <Shuffle className="w-5 h-5" />
            Akıllı 3 Soru Dağıt ({activeCourse?.name})
          </div>
          <p className="text-xs text-indigo-100 flex items-center gap-1.5 flex-wrap">
            <Sparkles className="w-3.5 h-3.5" />
            Her öğrenciye: <strong>S1 Teknik (Kolay)</strong> + <strong>S2 Teknik (Orta/Zor)</strong> + <strong>S3 Yorum &amp; Hayal</strong> (Toplam {questions.length} soru havuzundan)
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
            Tüm Sınıfı Yeniden Dağıt
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {activeCourse?.name} — Toplu Soru Ekle (Her satıra 1 soru)
            </h2>
            <select
              value={bulkType}
              onChange={(e) => setBulkType(e.target.value as QuestionType)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
            >
              <option value="technical_easy">Kategori: Teknik (Kolay)</option>
              <option value="technical_hard">Kategori: Teknik (Orta/Zor)</option>
              <option value="vision_comment">Kategori: Yorum &amp; Hayal Gücü</option>
            </select>
          </div>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Her satıra bir soru yazıp ekleyin..."
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
          <div className="sm:col-span-5">
            <input
              type="text"
              required
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Soru metnini yazın..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <select
              value={questionType}
              onChange={(e) => {
                const qt = e.target.value as QuestionType;
                setQuestionType(qt);
                if (qt === 'technical_hard') setDifficulty('orta');
                else setDifficulty('kolay');
              }}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs bg-white font-medium"
            >
              <option value="technical_easy">Teknik (Kolay)</option>
              <option value="technical_hard">Teknik (Orta/Zor)</option>
              <option value="vision_comment">Yorum &amp; Hayal</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <input
              type="text"
              value={expectedHint}
              onChange={(e) => setExpectedHint(e.target.value)}
              placeholder="Öğretmen ipucu (opsiyonel)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="all">Tüm Kategoriler</option>
              <option value="technical_easy">S1 · Teknik (Kolay)</option>
              <option value="technical_hard">S2 · Teknik (Orta/Zor)</option>
              <option value="vision_comment">S3 · Yorum &amp; Hayal</option>
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
          {filtered.map((q, index) => {
            const qt = q.question_type || 'technical_easy';
            const meta = QUESTION_TYPE_META[qt] ?? QUESTION_TYPE_META.technical_easy;
            return (
              <div key={q.id} className="px-4 py-3 flex items-start justify-between gap-4 hover:bg-slate-50">
                <div className="space-y-1">
                  <div className="text-sm text-slate-900">
                    <span className="font-mono text-xs text-slate-400 mr-2">#{index + 1}</span>
                    {q.question_text}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.badgeClass}`}>
                      {meta.short}
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
                      setQuestionType(qt);
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
            );
          })}
        </div>
      </div>
    </div>
  );
};
