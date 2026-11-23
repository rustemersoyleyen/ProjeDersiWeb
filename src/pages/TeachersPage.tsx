import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Edit2, Shield, Check, Users } from 'lucide-react';
import { api } from '../api/client';
import type { ClassInfo, Course, User } from '../types';

interface TeachersPageProps {
  currentUser: User;
  courses: Course[];
}

export const TeachersPage: React.FC<TeachersPageProps> = ({ currentUser, courses }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Öğretmen form state (Admin için)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('Bilişim Teknolojileri');
  const [title, setTitle] = useState('Ders Öğretmeni');
  const [role, setRole] = useState<'admin' | 'teacher'>('teacher');
  const [isActive, setIsActive] = useState(1);

  // Sınıf + Ders Öğretmeni Atama
  const [assignClassId, setAssignClassId] = useState<number>(0);
  const [assignCourseId, setAssignCourseId] = useState<number>(courses[0]?.id ?? 1);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [uList, cList] = await Promise.all([api.getUsers(), api.getClasses()]);
      setUsers(uList);
      setClasses(cList);
      if (cList.length > 0 && assignClassId === 0) {
        setAssignClassId(cList[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const cls = classes.find((c) => c.id === assignClassId);
    if (!cls) {
      setSelectedTeacherIds([]);
      return;
    }
    const assigned = cls.course_teachers[String(assignCourseId)] ?? [];
    setSelectedTeacherIds(assigned.map((t) => t.teacher_id));
  }, [assignClassId, assignCourseId, classes]);

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setBranch('Bilişim Teknolojileri');
    setTitle('Ders Öğretmeni');
    setRole('teacher');
    setIsActive(1);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      if (editingId) {
        await api.updateUser({
          id: editingId,
          full_name: fullName,
          branch,
          title,
          role,
          is_active: isActive,
          password: password || undefined,
        });
        setMessage({ type: 'ok', text: 'Öğretmen bilgileri güncellendi.' });
      } else {
        await api.createUser({
          username,
          password,
          full_name: fullName,
          branch,
          title,
          role,
        });
        setMessage({ type: 'ok', text: 'Yeni ders öğretmeni hesabı oluşturuldu.' });
      }
      resetForm();
      await loadAll();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'İşlem başarısız.' });
    }
  };

  const handleEdit = (u: User) => {
    setEditingId(u.id);
    setUsername(u.username);
    setPassword('');
    setFullName(u.full_name);
    setBranch(u.branch);
    setTitle(u.title);
    setRole(u.role);
    setIsActive(u.is_active);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu öğretmen hesabını silmek istediğinize emin misiniz?')) return;
    setMessage(null);
    try {
      await api.deleteUser(id);
      setMessage({ type: 'ok', text: 'Öğretmen hesabı silindi.' });
      await loadAll();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Silinemedi.' });
    }
  };

  const toggleTeacherSelection = (tid: number) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid]
    );
  };

  const handleSaveAssignment = async () => {
    if (!assignClassId || !assignCourseId) return;
    setMessage(null);
    try {
      await api.saveClassTeachers(assignClassId, assignCourseId, selectedTeacherIds);
      setMessage({ type: 'ok', text: 'Sınıf ve ders için sorumlu ders öğretmenleri kaydedildi (A4 çıktılarda görünecek).' });
      await loadAll();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Atama kaydedilemedi.' });
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ders Öğretmenleri &amp; İmza Komisyonu</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sisteme giriş yapacak öğretmen hesaplarını yönetin ve her sınıfın her proje alanına (dersine) sorumlu ders öğretmenlerini atayın.
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

      {/* Sınıf + Ders Öğretmeni Atama Paneli */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Sınıf &amp; Ders Bazlı Ders Öğretmeni Ataması (Çıktı İmza Bloğu)
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sınıf Seçin</label>
            <select
              value={assignClassId}
              onChange={(e) => setAssignClassId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {classes.length === 0 && <option value={0}>Önce sınıf oluşturun</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.academic_year})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Proje Alanı / Ders Seçin</label>
            <select
              value={assignCourseId}
              onChange={(e) => setAssignCourseId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.short_code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {users
            .filter((u) => u.is_active === 1)
            .map((u) => {
              const checked = selectedTeacherIds.includes(u.id);
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => toggleTeacherSelection(u.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                    checked
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border ${
                      checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    {checked && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{u.full_name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {u.branch} · {u.title}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!assignClassId}
            onClick={handleSaveAssignment}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium transition cursor-pointer"
          >
            Ders Öğretmenlerini Kaydet
          </button>
        </div>
      </div>

      {/* Admin: Öğretmen Ekle / Düzenle */}
      {isAdmin && (
        <form
          onSubmit={handleSaveUser}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Öğretmen Bilgilerini Düzenle' : 'Yeni Ders Öğretmeni / Admin Ekle'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
              >
                Vazgeç
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ad Soyad *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kullanıcı Adı *</label>
              <input
                type="text"
                required
                disabled={Boolean(editingId)}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Örn: ayilmaz"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {editingId ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre *'}
              </label>
              <input
                type="password"
                required={!editingId}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 4 karakter"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branş / Alan</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ünvan (İmza Altı)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ders Öğretmeni / Alan Şefi"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'teacher')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="teacher">Ders Öğretmeni</option>
                <option value="admin">Yönetici (Admin)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition cursor-pointer"
            >
              {editingId ? 'Değişiklikleri Kaydet' : 'Öğretmen Ekle'}
            </button>
          </div>
        </form>
      )}

      {/* Öğretmen Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-sm text-slate-800">
          Kayıtlı Ders Öğretmenleri ({users.length})
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Yükleniyor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ad Soyad</th>
                  <th className="px-4 py-3">Kullanıcı Adı</th>
                  <th className="px-4 py-3">Branş / Ünvan</th>
                  <th className="px-4 py-3">Rol</th>
                  {isAdmin && <th className="px-4 py-3 text-right">İşlem</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{u.username}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.branch} <span className="text-slate-400">·</span> {u.title}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                          Öğretmen
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(u)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
