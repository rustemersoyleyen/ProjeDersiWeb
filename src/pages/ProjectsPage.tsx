import React, { useEffect, useState } from 'react';
import { FolderPlus, Search, Trash2, Edit2, ListPlus } from 'lucide-react';
import { api } from '../api/client';
import type { Project } from '../types';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [message, setMessage] = useState<string>('');

  const load = async () => {
    const list = await api.getProjects();
    setProjects(list);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (editingId) {
      await api.updateProject({ id: editingId, title: title.trim(), description: description.trim() });
      setMessage('Proje güncellendi.');
    } else {
      await api.createProject({ title: title.trim(), description: description.trim() });
      setMessage('Yeni proje eklendi.');
    }
    setEditingId(null);
    setTitle('');
    setDescription('');
    await load();
  };

  const handleBulkSave = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const res = await api.bulkCreateProjects(lines.map((t) => ({ title: t })));
    setBulkText('');
    setShowBulk(false);
    setMessage(`${res.inserted} proje ismi toplu olarak eklendi.`);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu proje ismini silmek istediğinize emin misiniz?')) return;
    await api.deleteProject(id);
    await load();
  };

  const filtered = projects.filter(
    (p) =>
      p.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
      (p.description ?? '').toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proje İsimleri Listesi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Öğrencilerin çalışacağı proje konularını ekleyin; atanan proje adı tüm 4 derste ortak olarak görünür.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBulk(!showBulk)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-medium cursor-pointer"
        >
          <ListPlus className="w-4 h-4" />
          Toplu Proje Yapıştır
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}

      {showBulk && (
        <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Toplu Proje İsimleri Ekle (Her satıra 1 proje adı yazın)
          </h2>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'Kütüphane Otomasyonu\nOkul Kantin Sipariş Sistemi\nHastane Randevu Uygulaması\nE-Ticaret Ürün Yönetimi'}
            className="w-full border border-slate-300 rounded-lg p-3 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBulk(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleBulkSave}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
            >
              Satırları Proje Olarak Ekle
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid sm:grid-cols-12 gap-3 items-end"
      >
        <div className="sm:col-span-5">
          <label className="block text-xs font-medium text-slate-600 mb-1">Proje Adı *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Akıllı Kütüphane Takip Sistemi"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-5">
          <label className="block text-xs font-medium text-slate-600 mb-1">Kısa Açıklama (Opsiyonel)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Proje kapsamı veya kısa not..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" /> {editingId ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-sm text-slate-800">
            Kayıtlı Projeler ({filtered.length})
          </span>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Proje ara..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Proje Adı</th>
                <th className="px-4 py-3">Açıklama</th>
                <th className="px-4 py-3 text-center w-32">Atanan Öğrenci</th>
                <th className="px-4 py-3 text-right w-24">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    Kayıtlı proje bulunamadı.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.description || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                      {p.student_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setTitle(p.title);
                        setDescription(p.description ?? '');
                      }}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
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
    </div>
  );
};
