import React, { useState } from 'react';
import { ClipboardCheck, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

interface LoginPageProps {
  onSuccess: () => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(username.trim(), password);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-indigo-700 px-8 py-7 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/15 rounded-xl">
              <ClipboardCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Proje Değerlendirme Sistemi</h1>
              <p className="text-indigo-200 text-xs">Rubik, Teknik Soru Havuzu &amp; A4 Çıktı Paneli</p>
            </div>
          </div>
          <p className="text-xs text-indigo-100/90 mt-3 bg-indigo-800/50 rounded-lg px-3 py-2">
            Bu sistem yalnızca <strong>Yönetici (Admin)</strong> ve <strong>Ders Öğretmenleri</strong> kullanımı içindir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Örn: admin"
                autoComplete="username"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Şifre
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl text-sm shadow-sm transition cursor-pointer"
          >
            {loading ? 'Giriş yapılıyor...' : 'Öğretmen / Admin Girişi'}
          </button>

          <p className="text-center text-xs text-slate-400 pt-1">
            İlk kurulum varsayılan yönetici: <code className="text-slate-600 font-semibold">admin</code> / <code className="text-slate-600 font-semibold">admin123</code>
          </p>
        </form>
      </div>
    </div>
  );
};
