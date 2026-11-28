import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FolderKanban,
  ListChecks,
  HelpCircle,
  ClipboardCheck,
  CalendarCheck,
  Printer,
  Settings,
  LogOut,
  Menu,
  X,
  AlertTriangle,
} from 'lucide-react';
import { api } from './api/client';
import type { Course, Outcome, SettingsMap, Subject, User } from './types';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TeachersPage } from './pages/TeachersPage';
import { ClassesPage } from './pages/ClassesPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CriteriaPage } from './pages/CriteriaPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { WeeklyTrackingPage } from './pages/WeeklyTrackingPage';
import { EvaluatePage } from './pages/EvaluatePage';
import { PrintPage } from './pages/PrintPage';
import { SettingsPage } from './pages/SettingsPage';

type TabKey =
  | 'dashboard'
  | 'teachers'
  | 'classes'
  | 'projects'
  | 'criteria'
  | 'questions'
  | 'weekly'
  | 'evaluate'
  | 'print'
  | 'settings';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [evalTarget, setEvalTarget] = useState<{
    classId?: number;
    courseId?: number;
    studentId?: number;
  } | null>(null);

  const bootstrap = async () => {
    try {
      const res = await api.me();
      if (res.authenticated && res.user) {
        setUser(res.user);
        setSettings(res.settings ?? {});
        setSubjects(res.subjects ?? []);
        setCourses(res.courses ?? []);
        setOutcomes(res.outcomes ?? []);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Sistem yükleniyor...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSuccess={bootstrap} />;
  }

  const navItems: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'dashboard', label: 'Genel Bakış & Matris', icon: LayoutDashboard },
    { key: 'classes', label: 'Sınıflar & Öğrenciler', icon: GraduationCap },
    { key: 'projects', label: 'Proje İsimleri', icon: FolderKanban },
    { key: 'teachers', label: 'Ders Öğretmenleri', icon: Users },
    { key: 'criteria', label: 'Kazanım & Rubik', icon: ListChecks },
    { key: 'questions', label: 'Soru Havuzu (3 Tip)', icon: HelpCircle },
    { key: 'weekly', label: 'Haftalık Takip', icon: CalendarCheck },
    { key: 'evaluate', label: 'Değerlendirme', icon: ClipboardCheck },
    { key: 'print', label: 'A4 Çıktı (2 Öğrenci)', icon: Printer },
    { key: 'settings', label: 'Dersler & Ayarlar', icon: Settings },
  ];

  const handleNavigateEvaluate = (classId: number, courseId: number, studentId?: number) => {
    setEvalTarget({ classId, courseId, studentId });
    setActiveTab('evaluate');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col transform transition-transform lg:translate-x-0 lg:static ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-white leading-tight">Proje Değerlendirme</div>
              <div className="text-[11px] text-slate-400">Rubik · Haftalık · Soru v2</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-2">
            <div className="text-sm font-semibold text-white truncate">{user.full_name}</div>
            <div className="text-xs text-slate-400 truncate">
              {user.role === 'admin' ? 'Yönetici (Admin)' : user.title}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/90 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Güvenli Çıkış
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm text-slate-900">Proje Değerlendirme</span>
          <span className="text-xs text-slate-500">{user.username}</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {user.must_change_password === 1 && activeTab !== 'settings' && (
            <div className="no-print mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Varsayılan kurulum şifresini kullanıyorsunuz. Güvenliğiniz için şifrenizi değiştirmeniz önerilir.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer"
              >
                Şifreyi Değiştir
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardPage subjects={subjects} onNavigateEvaluate={handleNavigateEvaluate} />
          )}
          {activeTab === 'teachers' && (
            <TeachersPage
              currentUser={user}
              courses={courses}
              onRefreshBootstrap={bootstrap}
            />
          )}
          {activeTab === 'classes' && <ClassesPage settings={settings} courses={courses} />}
          {activeTab === 'projects' && <ProjectsPage />}
          {activeTab === 'criteria' && (
            <CriteriaPage courses={courses} onCoursesChanged={bootstrap} />
          )}
          {activeTab === 'questions' && <QuestionsPage courses={courses} />}
          {activeTab === 'weekly' && (
            <WeeklyTrackingPage
              courses={courses}
              outcomes={outcomes}
              onCoursesChanged={bootstrap}
            />
          )}
          {activeTab === 'evaluate' && (
            <EvaluatePage
              subjects={subjects}
              courses={courses}
              outcomes={outcomes}
              initialSelection={evalTarget}
            />
          )}
          {activeTab === 'print' && <PrintPage courses={courses} />}
          {activeTab === 'settings' && (
            <SettingsPage
              user={user}
              settings={settings}
              subjects={subjects}
              courses={courses}
              onRefresh={bootstrap}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
