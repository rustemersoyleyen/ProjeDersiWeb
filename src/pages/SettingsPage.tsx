import React, { useState } from 'react';
import { Save, KeyRound, Building2, BookOpen, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import type { Course, SettingsMap, User } from '../types';

interface SettingsPageProps {
  user: User;
  settings: SettingsMap;
  courses: Course[];
  onRefresh: () => Promise<void>;
}

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

  // Yeni proje alanı / ders ekleme (Admin)
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseQPoints, setCourseQPoints] = useState(20);

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

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await api.createCourse({
        name: courseName.trim(),
        short_code: courseCode.trim().toUpperCase(),
        question_points: courseQPoints,
        sort_order: courses.length + 1,
      });
      setCourseName('');
      setCourseCode('');
      await onRefresh();
      setMessage({ type: 'ok', text: 'Yeni proje alanı / ders eklendi.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Eklenemedi.' });
    }
  };

  const handleDeleteCourse = async (id: number) => {
    if (!confirm('Bu dersi ve bağlı kriter/soru/değerlendirmeleri silmek istiyor musunuz?')) return;
    await api.deleteCourse(id);
    await onRefresh();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sistem Ayarları &amp; Hesap Güvenliği</h1>
        <p className="text-sm text-slate-500 mt-1">
          Çıktı başlık bilgilerini, proje alanlarını ve kendi giriş şifrenizi yönetin.
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

      {/* Admin: Kurum Ayarları */}
      {user.role === 'admin' && (
        <>
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

          {/* Proje Alanları / Dersler */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 font-semibold text-base text-slate-900">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Proje Alanları / Dersler ({courses.length})
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {courses.map((c) => (
                <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 mr-2">
                      {c.short_code}
                    </span>
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      (Soru puanı: {c.question_points}p)
                    </span>
                  </div>
                  {courses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCourse} className="grid sm:grid-cols-12 gap-3 items-end pt-2">
              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Alan / Ders Adı</label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Örn: Yapay Zeka Uygulamaları"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Kısa Kod</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="YZA"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Soru Puanı</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={courseQPoints}
                  onChange={(e) => setCourseQPoints(Number(e.target.value))}
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
          </div>
        </>
      )}
    </div>
  );
};
