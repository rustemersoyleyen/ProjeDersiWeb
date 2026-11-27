import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Edit2, Shield, Check, Users, Lock } from 'lucide-react';
import { api } from '../api/client';
import type { ClassInfo, Course, TeacherAssignment, User } from '../types';

interface TeachersPageProps {
  currentUser: User;
  courses: Course[];
  onRefreshBootstrap?: () => Promise<void>;
}

export const TeachersPage: React.FC<TeachersPageProps> = ({
  currentUser,
  courses,
  onRefreshBootstrap,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>(courses);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Öğretmen form state (Admin için — Sınıf & Ders atamaları dahil!)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('Bilişim Teknolojileri');
  const [title, setTitle] = useState('Ders Öğretmeni');
  const [role, setRole] = useState<'admin' | 'teacher'>('teacher');
  const [isActive, setIsActive] = useState(1);
  const [formAssignments, setFormAssignments] = useState<TeacherAssignment[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [uList, cList, coList] = await Promise.all([
        api.getUsers(),
        api.getClasses(),
        api.getCourses(),
      ]);
      setUsers(uList);
      setClasses(cList);
      setAllCourses(coList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setBranch('Bilişim Teknolojileri');
    setTitle('Ders Öğretmeni');
    setRole('teacher');
    setIsActive(1);
    setFormAssignments([]);
  };

  const hasPair = (classId: number, courseId: number) =>
    formAssignments.some((a) => a.class_id === classId && a.course_id === courseId);

  const togglePair = (classId: number, courseId: number) => {
    setFormAssignments((prev) => {
      const exists = prev.some((a) => a.class_id === classId && a.course_id === courseId);
      if (exists) {
        return prev.filter((a) => !(a.class_id === classId && a.course_id === courseId));
      }
      return [...prev, { class_id: classId, course_id: courseId }];
    });
  };

  const toggleAllForClass = (classId: number) => {
    const classCourses = allCourses.map((c) => c.id);
    const allChecked = classCourses.every((cid) => hasPair(classId, cid));
    setFormAssignments((prev) => {
      const others = prev.filter((a) => a.class_id !== classId);
      if (allChecked) return others;
      return [...others, ...classCourses.map((cid) => ({ class_id: classId, course_id: cid }))];
    });
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
          assignments: formAssignments,
        });
        setMessage({
          type: 'ok',
          text: 'Öğretmen bilgileri ile sınıf/ders yetkileri güncellendi.',
        });
      } else {
        await api.createUser({
          username,
          password,
          full_name: fullName,
          branch,
          title,
          role,
          assignments: formAssignments,
        });
        setMessage({
          type: 'ok',
          text: 'Yeni ders öğretmeni hesabı ve sınıf/ders atamaları oluşturuldu.',
        });
      }
      resetForm();
      await loadAll();
      if (onRefreshBootstrap) await onRefreshBootstrap();
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
    setFormAssignments(u.assignments ?? []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const isAdmin = currentUser.role === 'admin';

  const summarizeAssignments = (assignments: TeacherAssignment[] | undefined) => {
    if (!assignments || assignments.length === 0) return 'Atama yok';
    const byClass = new Map<number, number>();
    for (const a of assignments) {
      byClass.set(a.class_id, (byClass.get(a.class_id) ?? 0) + 1);
    }
    return Array.from(byClass.entries())
      .map(([cid, cnt]) => {
        const cls = classes.find((c) => c.id === cid);
        return `${cls?.name ?? `Sınıf #${cid}`} (${cnt} ders)`;
      })
      .join(' · ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ders Öğretmenleri &amp; Sınıf/Ders Yetkilendirme</h1>
        <p className="text-sm text-slate-500 mt-1">
          Öğretmen eklerken gireceği <strong>sınıfları ve dersleri</strong> doğrudan atayın. Her öğretmen giriş yaptığında yalnızca kendisine atanan sınıfları ve dersleri görür.
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

      {/* Admin: Öğretmen Ekle / Düzenle + Sınıf & Ders Atama Matrisi */}
      {isAdmin ? (
        <form
          onSubmit={handleSaveUser}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? `Öğretmeni Düzenle (${username})` : 'Yeni Ders Öğretmeni Ekle & Sınıf/Ders Ata'}
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
                <option value="teacher">Ders Öğretmeni (Sadece kendi sınıfları/dersleri)</option>
                <option value="admin">Yönetici (Admin — Tüm sistem)</option>
              </select>
            </div>
          </div>

          {/* Sınıf & Ders Yetkilendirme Matrisi */}
          <div className="border border-indigo-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-950">
                <Users className="w-4 h-4 text-indigo-600" />
                Öğretmenin Göreceği Sınıflar ve Dersler ({formAssignments.length} atama seçili)
              </div>
              <span className="text-[11px] text-indigo-700">
                Seçilen sınıf/dersler hem erişim yetkisi hem de A4 imza bloğu için geçerlidir.
              </span>
            </div>

            {classes.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">
                Henüz sınıf tanımlanmamış. Önce <strong>Sınıflar &amp; Öğrenciler</strong> ekranından sınıf ekleyin.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {classes.map((cls) => {
                  const allSelected =
                    allCourses.length > 0 && allCourses.every((co) => hasPair(cls.id, co.id));
                  return (
                    <div key={cls.id} className="p-3.5 space-y-2 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">
                          {cls.name}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            ({cls.academic_year} · {cls.student_count} öğrenci)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleAllForClass(cls.id)}
                          className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
                        >
                          {allSelected ? 'Bu Sınıfı Temizle' : 'Bu Sınıfın Tüm Derslerini Seç'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {allCourses.map((co) => {
                          const checked = hasPair(cls.id, co.id);
                          return (
                            <button
                              type="button"
                              key={co.id}
                              onClick={() => togglePair(cls.id, co.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer ${
                                checked
                                  ? 'bg-indigo-600 border-indigo-600 text-white font-medium'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3" />}
                              <span>{co.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition cursor-pointer"
            >
              {editingId ? 'Öğretmen & Yetkileri Güncelle' : 'Öğretmeni ve Atamaları Kaydet'}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-600 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          Öğretmen ekleme ve sınıf/ders yetkilendirmesi yalnızca <strong>Yönetici (Admin)</strong> tarafından yapılabilir.
        </div>
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
                  <th className="px-4 py-3">Yetkili Olduğu Sınıflar &amp; Dersler</th>
                  <th className="px-4 py-3">Rol</th>
                  {isAdmin && <th className="px-4 py-3 text-right">İşlem</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{u.full_name}</div>
                      <div className="text-xs text-slate-500">
                        {u.branch} · {u.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{u.username}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {u.role === 'admin' ? (
                        <span className="text-indigo-700 font-medium">Tüm Sınıflar ve Dersler (Admin)</span>
                      ) : (
                        summarizeAssignments(u.assignments)
                      )}
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
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => handleEdit(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                          title="Düzenle & Sınıf/Ders Ata"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Düzenle
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
