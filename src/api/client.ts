import type {
  AuthBootstrap,
  ClassInfo,
  Course,
  Criterion,
  EvaluationData,
  EvaluationMode,
  MatrixResponse,
  Outcome,
  PrintDataResponse,
  Project,
  Question,
  QuestionType,
  RubricLevel,
  SettingsMap,
  Student,
  StudentQuestion,
  Subject,
  SubjectModelType,
  TeacherAssignment,
  User,
  WeeklyScoresResponse,
  WeeklyStatus,
  WeeklyTask,
} from '../types';

const STORAGE_API_KEY = 'pd_api_base';
const STORAGE_TOKEN_KEY = 'pd_auth_token';

export function getDefaultApiBase(): string {
  const envBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (envBase) return envBase;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return 'https://okul360.kiracbilisim.net/proje-api/index.php';
  }
  return './api/index.php';
}

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = window.localStorage.getItem(STORAGE_API_KEY)?.trim();
    if (custom === 'https://kiracbilisim.net/proje-api/index.php') {
      window.localStorage.removeItem(STORAGE_API_KEY);
      return getDefaultApiBase();
    }
    if (custom) return custom;
  }
  return getDefaultApiBase();
}

export function setApiBase(url: string): void {
  const clean = url.trim();
  if (typeof window === 'undefined') return;
  if (!clean || clean === getDefaultApiBase()) {
    window.localStorage.removeItem(STORAGE_API_KEY);
  } else {
    window.localStorage.setItem(STORAGE_API_KEY, clean);
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(STORAGE_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(STORAGE_TOKEN_KEY);
  }
}

async function request<T>(
  route: string,
  options: {
    method?: string;
    params?: Record<string, string | number | undefined>;
    body?: unknown;
  } = {}
): Promise<T> {
  const { method = 'GET', params, body } = options;
  const upperMethod = method.toUpperCase();
  const qs = new URLSearchParams();
  qs.set('route', route);

  const fetchMethod = upperMethod === 'GET' ? 'GET' : 'POST';
  if (upperMethod === 'PUT' || upperMethod === 'DELETE') {
    qs.set('_method', upperMethod);
  }

  const token = getAuthToken();
  if (token) {
    qs.set('_token', token);
  }

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v));
      }
    });
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'text/plain;charset=UTF-8';
  }

  const base = getApiBase();
  const sep = base.includes('?') ? '&' : '?';
  const isCrossOrigin = base.startsWith('http://') || base.startsWith('https://');

  let res: Response;
  try {
    res = await fetch(`${base}${sep}${qs.toString()}`, {
      method: fetchMethod,
      credentials: isCrossOrigin ? 'omit' : 'include',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `API sunucusuna ulaşılamadı (${base}). Lütfen API adresini kontrol edin.`
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      res.ok
        ? 'Sunucudan geçersiz JSON yanıtı alındı.'
        : `Sunucu hatası (${res.status}): API adresini (${base}) ve PHP yapılandırmasını kontrol edin.`
    );
  }

  if (!res.ok) {
    if (res.status === 401 && route !== '/auth/login') {
      setAuthToken(null);
    }
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `İstek başarısız oldu (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export const api = {
  // Health Check
  health: () =>
    request<{ ok: boolean; db: string; courses: number; questions: number }>('/health'),

  // Auth
  me: () => request<AuthBootstrap>('/auth/me'),
  login: async (username: string, password: string) => {
    const res = await request<{ ok: boolean; token?: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  logout: async () => {
    try {
      await request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: { current_password, new_password },
    }),

  // Settings
  getSettings: () => request<SettingsMap>('/settings'),
  saveSettings: (payload: SettingsMap) =>
    request<{ ok: boolean }>('/settings', { method: 'POST', body: payload }),

  // Users / Ders Öğretmenleri
  getUsers: () => request<User[]>('/users'),
  createUser: (payload: {
    username: string;
    password: string;
    full_name: string;
    branch: string;
    title: string;
    role: 'admin' | 'teacher';
    assignments?: TeacherAssignment[];
  }) => request<{ ok: boolean; id: number }>('/users', { method: 'POST', body: payload }),
  updateUser: (payload: {
    id: number;
    full_name: string;
    branch: string;
    title: string;
    role: 'admin' | 'teacher';
    is_active: number;
    password?: string;
    assignments?: TeacherAssignment[];
  }) => request<{ ok: boolean }>('/users', { method: 'PUT', body: payload }),
  deleteUser: (id: number) =>
    request<{ ok: boolean }>('/users', { method: 'DELETE', params: { id } }),

  // Subjects (Ana Dersler)
  getSubjects: () => request<Subject[]>('/subjects'),
  createSubject: (payload: {
    name: string;
    code: string;
    model_type: SubjectModelType;
    description?: string;
    sort_order?: number;
    class_ids?: number[];
  }) => request<{ ok: boolean; id: number; first_course_id?: number }>('/subjects', { method: 'POST', body: payload }),
  updateSubject: (payload: {
    id: number;
    name: string;
    code: string;
    model_type: SubjectModelType;
    description?: string;
    sort_order?: number;
  }) => request<{ ok: boolean }>('/subjects', { method: 'PUT', body: payload }),
  deleteSubject: (id: number) =>
    request<{ ok: boolean }>('/subjects', { method: 'DELETE', params: { id } }),

  // Courses (Uygulamalar / Projeler / Ödevler)
  getCourses: (subject_id?: number) =>
    request<Course[]>('/courses', { params: { subject_id } }),
  createCourse: (payload: {
    subject_id: number;
    name: string;
    short_code: string;
    description?: string;
    question_points: number;
    evaluation_mode: EvaluationMode;
    final_completion_points?: number;
    final_report_points?: number;
    sort_order: number;
  }) => request<{ ok: boolean; id: number }>('/courses', { method: 'POST', body: payload }),
  updateCourse: (payload: {
    id: number;
    subject_id?: number;
    name: string;
    short_code: string;
    description?: string;
    question_points: number;
    evaluation_mode?: EvaluationMode;
    final_completion_points?: number;
    final_report_points?: number;
    sort_order: number;
  }) => request<{ ok: boolean }>('/courses', { method: 'PUT', body: payload }),
  deleteCourse: (id: number) =>
    request<{ ok: boolean }>('/courses', { method: 'DELETE', params: { id } }),

  // Classes & Class-Course Teachers
  getClasses: () => request<ClassInfo[]>('/classes'),
  createClass: (payload: { name: string; academic_year: string; school_name: string }) =>
    request<{ ok: boolean; id: number }>('/classes', { method: 'POST', body: payload }),
  updateClass: (payload: { id: number; name: string; academic_year: string; school_name: string }) =>
    request<{ ok: boolean }>('/classes', { method: 'PUT', body: payload }),
  deleteClass: (id: number) =>
    request<{ ok: boolean }>('/classes', { method: 'DELETE', params: { id } }),
  saveClassTeachers: (class_id: number, course_id: number, teacher_ids: number[]) =>
    request<{ ok: boolean }>('/class-teachers', {
      method: 'POST',
      body: { class_id, course_id, teacher_ids },
    }),

  // Projects
  getProjects: () => request<Project[]>('/projects'),
  createProject: (payload: { title: string; description?: string }) =>
    request<{ ok: boolean; id: number }>('/projects', { method: 'POST', body: payload }),
  bulkCreateProjects: (items: Array<{ title: string; description?: string }>) =>
    request<{ ok: boolean; inserted: number }>('/projects', { method: 'POST', body: { items } }),
  updateProject: (payload: { id: number; title: string; description?: string }) =>
    request<{ ok: boolean }>('/projects', { method: 'PUT', body: payload }),
  deleteProject: (id: number) =>
    request<{ ok: boolean }>('/projects', { method: 'DELETE', params: { id } }),

  // Students & Per-Course Project Overrides + Vision Note
  getStudents: (class_id?: number) =>
    request<Student[]>('/students', { params: { class_id } }),
  createStudent: (payload: {
    class_id: number;
    student_no: string;
    full_name: string;
    project_id?: number | null;
  }) => request<{ ok: boolean; id: number }>('/students', { method: 'POST', body: payload }),
  importStudents: (
    class_id: number,
    students: Array<{ student_no: string; full_name: string; project_title?: string }>
  ) =>
    request<{ ok: boolean; imported: number }>('/students', {
      method: 'POST',
      body: { class_id, students },
    }),
  updateStudent: (payload: {
    id: number;
    student_no?: string;
    full_name?: string;
    project_id?: number | null;
  }) => request<{ ok: boolean }>('/students', { method: 'PUT', body: payload }),
  deleteStudent: (id: number) =>
    request<{ ok: boolean }>('/students', { method: 'DELETE', params: { id } }),

  saveStudentCourseProject: (payload: {
    course_id: number;
    student_id?: number;
    class_id?: number;
    project_id?: number | null;
    custom_title?: string | null;
    initial_vision_note?: string | null;
  }) =>
    request<{ ok: boolean; updated?: number }>('/student-course-projects', {
      method: 'POST',
      body: payload,
    }),

  // Criteria & Outcomes
  getCriteria: (course_id: number) =>
    request<{ outcomes: Outcome[]; criteria: Criterion[] }>('/criteria', {
      params: { course_id },
    }),
  createCriterion: (payload: {
    course_id: number;
    outcome_id: number;
    name: string;
    max_score: number;
    rubric_levels?: RubricLevel[];
    sort_order?: number;
  }) => request<{ ok: boolean; id: number }>('/criteria', { method: 'POST', body: payload }),
  updateCriterion: (payload: {
    id: number;
    outcome_id: number;
    name: string;
    max_score: number;
    rubric_levels?: RubricLevel[];
    sort_order?: number;
  }) => request<{ ok: boolean }>('/criteria', { method: 'PUT', body: payload }),
  deleteCriterion: (id: number) =>
    request<{ ok: boolean }>('/criteria', { method: 'DELETE', params: { id } }),

  // Questions (3 Kategorili)
  getQuestions: (course_id: number) =>
    request<Question[]>('/questions', { params: { course_id } }),
  createQuestion: (payload: {
    course_id: number;
    question_text: string;
    difficulty: 'kolay' | 'orta' | 'zor';
    question_type: QuestionType;
    expected_hint?: string;
  }) => request<{ ok: boolean; id: number }>('/questions', { method: 'POST', body: payload }),
  bulkCreateQuestions: (
    course_id: number,
    question_type: QuestionType,
    items: Array<{
      question_text: string;
      difficulty?: 'kolay' | 'orta' | 'zor';
      question_type?: QuestionType;
      expected_hint?: string;
    }>
  ) =>
    request<{ ok: boolean; inserted: number }>('/questions', {
      method: 'POST',
      body: { course_id, question_type, items },
    }),
  updateQuestion: (payload: {
    id: number;
    question_text: string;
    difficulty: 'kolay' | 'orta' | 'zor';
    question_type: QuestionType;
    expected_hint?: string;
  }) => request<{ ok: boolean }>('/questions', { method: 'PUT', body: payload }),
  deleteQuestion: (id: number) =>
    request<{ ok: boolean }>('/questions', { method: 'DELETE', params: { id } }),

  // Student Random Questions
  getStudentQuestions: (student_id: number, course_id: number) =>
    request<StudentQuestion[]>('/student-questions', { params: { student_id, course_id } }),
  assignRandomQuestions: (payload: {
    course_id: number;
    class_id?: number;
    student_id?: number;
    force?: boolean;
  }) =>
    request<{ ok: boolean; assigned_students: number }>('/student-questions/assign-random', {
      method: 'POST',
      body: payload,
    }),
  replaceStudentQuestion: (student_question_id: number, new_question_id: number) =>
    request<{ ok: boolean }>('/student-questions/replace', {
      method: 'POST',
      body: { student_question_id, new_question_id },
    }),

  // Weekly Tasks & Scores
  getWeeklyTasks: (course_id: number) =>
    request<WeeklyTask[]>('/weekly-tasks', { params: { course_id } }),
  createWeeklyTask: (payload: {
    course_id: number;
    outcome_id?: number | null;
    week_no: number;
    title: string;
    description?: string;
    max_score: number;
    due_date?: string;
  }) => request<{ ok: boolean; id: number }>('/weekly-tasks', { method: 'POST', body: payload }),
  bulkCreateWeeklyTasks: (
    course_id: number,
    items: Array<{
      outcome_id?: number | null;
      week_no: number;
      title: string;
      max_score: number;
      description?: string;
      due_date?: string;
    }>
  ) =>
    request<{ ok: boolean; inserted: number }>('/weekly-tasks', {
      method: 'POST',
      body: { course_id, items },
    }),
  updateWeeklyTask: (payload: {
    id: number;
    outcome_id?: number | null;
    week_no: number;
    title: string;
    description?: string;
    max_score: number;
    due_date?: string;
  }) => request<{ ok: boolean }>('/weekly-tasks', { method: 'PUT', body: payload }),
  deleteWeeklyTask: (id: number) =>
    request<{ ok: boolean }>('/weekly-tasks', { method: 'DELETE', params: { id } }),

  getWeeklyScores: (class_id: number, course_id: number) =>
    request<WeeklyScoresResponse>('/weekly-scores', { params: { class_id, course_id } }),
  saveWeeklyScores: (
    course_id: number,
    items: Array<{
      student_id: number;
      weekly_task_id: number;
      status: WeeklyStatus;
      score: number;
      note?: string;
    }>
  ) =>
    request<{ ok: boolean; saved: number }>('/weekly-scores', {
      method: 'POST',
      body: { course_id, items },
    }),

  // Evaluations, Matrix & Print
  getEvaluation: (student_id: number, course_id: number) =>
    request<EvaluationData>('/evaluations', { params: { student_id, course_id } }),
  saveEvaluation: (payload: {
    student_id: number;
    course_id: number;
    notes: string;
    initial_vision_note?: string;
    final_completion_score?: number | null;
    final_report_score?: number | null;
    criteria_scores: Array<{ criterion_id: number; selected_level: number | null; score: number }>;
    question_scores: Array<{ id: number; score: number | null; note?: string }>;
  }) =>
    request<{
      ok: boolean;
      evaluation_id: number;
      rubric_total: number;
      weekly_total: number;
      question_total: number;
      total_score: number;
    }>('/evaluations', { method: 'POST', body: payload }),

  getMatrix: (class_id?: number, subject_id?: number) =>
    request<MatrixResponse>('/matrix', { params: { class_id, subject_id } }),
  getPrintData: (class_id: number, course_id: number) =>
    request<PrintDataResponse>('/print-data', { params: { class_id, course_id } }),
};
