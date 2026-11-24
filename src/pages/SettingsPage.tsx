import React, { useState } from 'react';
import { Save, KeyRound, Building2, BookOpen, Plus, Trash2, Edit2, Wand2, X } from 'lucide-react';
import { api } from '../api/client';
import type { Course, SettingsMap, User } from '../types';

interface SettingsPageProps {
  user: User;
  settings: SettingsMap;
  courses: Course[];
  onRefresh: () => Promise<void>;
}

const TERM_COURSE_PRESETS: Record<number, { name: string; short_code: string }> = {
  1: { name: '1.Dönem 1.Uygulama (Nesne Tabanlı Programlama)', short_code: '1D-1U' },
  2: { name: '1.Dönem 2.Uygulama (FrontEnd Web Tasarımı)', short_code: '1D-2U' },
  3: { name: '2.Dönem 1.Uygulama (Web Tabanlı Proje)', short_code: '2D-1U' },
  4: { name: '2.Dönem 2.Uygulama (Mobil Uygulama)', short_code: '2D-2U' },
};

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  settings,
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

  // Satır içi ders düzenleme
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editQPoints, setEditQPoints] = useState(20);
  const [editOrder, setEditOrder] = useState(1);

  // Yeni proje alanı / ders ekleme (Admin)
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseQPoints, setNewCourseQPoints] = useState(20);
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

  const startEditCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setEditName(c.name);
    setEditCode(c.short_code);
    setEditQPoints(c.question_points);
    setEditOrder(c.sort_order);
  };

  const handleSaveInlineCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId) return;
    setMessage(null);
    try {
      await api.updateCourse({
        id: editingCourseId,
        name: editName.trim(),
        short_code: editCode.trim(),
        question_points: editQPoints,
        sort_order: editOrder,
      });
      setEditingCourseId(null);
      await onRefresh();
      setMessage({ type: 'ok', text: 'Proje alanı / uygulama bilgisi güncellendi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Güncellenemedi.' });
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.createCourse({
        name: newCourseName.trim(),
        short_code: newCourseCode.trim(),
        question_points: newCourseQPoints,
        sort_order: courses.length + 1,
      });
      setNewCourseName('');
      setNewCourseCode('');
      setNewCourseQPoints(20);
      await onRefresh();
      setMessage({ type: 'ok', text: 'Yeni proje alanı / uygulama eklendi.' });
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
          name: preset.name,
          short_code: preset.short_code,
          description: c.description ?? '',
          question_points: c.question_points,
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
    if (!confirm('Bu alanı ve bağlı kriter/soru/değerlendirmeleri silmek istiyor musunuz?')) return;
    await api.deleteCourse(id);
    await onRefresh();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sistem Ayarları &amp; Hesap Güvenliği</h1>
        <p className="text-sm text-slate-500 mt-1">
          Çıktı başlık bilgilerini, proje alanlarını / uygulama dönemlerini ve giriş şifrenizi yönetin.
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

      {/* Proje Alanları / Uygulama Dönemleri (Satır İçi Düzenlenebilir) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 font-semibold text-base text-slate-900">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Proje Alanları / Uygulama Dönemleri ({courses.length})
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Herhangi bir alanın adını, kısa kodunu, sırasını veya teknik soru puanını <strong>Düzenle</strong> butonuna tıklayarak anında değiştirebilirsiniz.
            </p>
          </div>
          <button
            type="button"
            disabled={applyingPresets}
            onClick={handleApplyTermPresets}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {applyingPresets ? 'Güncelleniyor...' : '1./2. Dönem Uygulama Adlarını Uygula'}
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {courses.map((c) => {
            const isEditing = editingCourseId === c.id;
            if (isEditing) {
              return (
                <form
                  key={c.id}
                  onSubmit={handleSaveInlineCourse}
                  className="p-3.5 bg-indigo-50/50 space-y-3"
                >
                  <div className="grid sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Uygulama / Alan Adı
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
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
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Soru Puanı
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editQPoints}
                        onChange={(e) => setEditQPoints(Number(e.target.value))}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 text-sm text-center"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Sıra
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={editOrder}
                        onChange={(e) => setEditOrder(Number(e.target.value))}
                        className="w-full border border-indigo-300 bg-white rounded-lg px-2.5 py-1.5 text-sm text-center"
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
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 mr-2">
                    {c.short_code}
                  </span>
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    (Soru: {c.question_points}p · Sıra: {c.sort_order})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditCourse(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 text-xs font-medium cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Düzenle
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

        {/* Admin: Yeni Alan Ekle */}
        {user.role === 'admin' && (
          <form onSubmit={handleAddCourse} className="grid sm:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Uygulama / Alan Adı</label>
              <input
                type="text"
                required
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Örn: 2.Dönem 3.Uygulama (Yapay Zeka)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Kısa Kod</label>
              <input
                type="text"
                required
                maxLength={20}
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                placeholder="2D-3U"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Soru Puanı</label>
              <input
                type="number"
                min={0}
                max={100}
                value={newCourseQPoints}
                onChange={(e) => setNewCourseQPoints(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
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
        )}
      </div>

      {/* Admin: Kurum Ayarları */}
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

      {/* Şifre Değiştir */}
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
