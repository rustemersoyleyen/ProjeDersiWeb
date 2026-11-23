import type {
  AuthBootstrap,
  ClassInfo,
  Course,
  Criterion,
  EvaluationData,
  MatrixResponse,
  Outcome,
  PrintDataResponse,
  Project,
  Question,
  RubricLevel,
  SettingsMap,
  Student,
  StudentQuestion,
  User,
} from '../types';

const STORAGE_API_KEY = 'pd_api_base';
const STORAGE_TOKEN_KEY = 'pd_auth_token';

export function getDefaultApiBase(): string {
  const envBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (envBase) return envBase;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return 'https://kiracbilisim.net/proje-api/index.php';
  }
  return './api/index.php';
}

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = window.localStorage.getItem(STORAGE_API_KEY)?.trim();
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
  const qs = new URLSearchParams();
  qs.set('route', route);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v));
      }
    });
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAuthToken();
  if (token) {
    headers['X-Auth-Token'] = token;
  }

  const base = getApiBase();
  const sep = base.includes('?') ? '&' : '?';

  let res: Response;
  try {
    res = await fetch(`${base}${sep}${qs.toString()}`, {
      method,
      credentials: 'include',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `API sunucusuna ulaşılamadı (${base}). Lütfen kiracbilisim.net üzerindeki API klasörünü ve adresi kontrol edin.`
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
  }) => request<{ ok: boolean; id: number }>('/users', { method: 'POST', body: payload }),
  updateUser: (payload: {
    id: number;
    full_name: string;
    branch: string;
    title: string;
    role: 'admin' | 'teacher';
    is_active: number;
    password?: string;
  }) => request<{ ok: boolean }>('/users', { method: 'PUT', body: payload }),
  deleteUser: (id: number) =>
    request<{ ok: boolean }>('/users', { method: 'DELETE', params: { id } }),

  // Courses
  getCourses: () => request<Course[]>('/courses'),
  createCourse: (payload: {
    name: string;
    short_code: string;
    description?: string;
    question_points: number;
    sort_order: number;
  }) => request<{ ok: boolean; id: number }>('/courses', { method: 'POST', body: payload }),
  updateCourse: (payload: {
    id: number;
    name: string;
    short_code: string;
    description?: string;
    question_points: number;
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

  // Students
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

  // Questions
  getQuestions: (course_id: number) =>
    request<Question[]>('/questions', { params: { course_id } }),
  createQuestion: (payload: {
    course_id: number;
    question_text: string;
    difficulty: 'kolay' | 'orta' | 'zor';
    expected_hint?: string;
  }) => request<{ ok: boolean; id: number }>('/questions', { method: 'POST', body: payload }),
  bulkCreateQuestions: (
    course_id: number,
    items: Array<{ question_text: string; difficulty?: 'kolay' | 'orta' | 'zor'; expected_hint?: string }>
  ) =>
    request<{ ok: boolean; inserted: number }>('/questions', {
      method: 'POST',
      body: { course_id, items },
    }),
  updateQuestion: (payload: {
    id: number;
    question_text: string;
    difficulty: 'kolay' | 'orta' | 'zor';
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

  // Evaluations, Matrix & Print
  getEvaluation: (student_id: number, course_id: number) =>
    request<EvaluationData>('/evaluations', { params: { student_id, course_id } }),
  saveEvaluation: (payload: {
    student_id: number;
    course_id: number;
    notes: string;
    criteria_scores: Array<{ criterion_id: number; selected_level: number | null; score: number }>;
    question_scores: Array<{ id: number; score: number | null; note?: string }>;
  }) =>
    request<{
      ok: boolean;
      evaluation_id: number;
      rubric_total: number;
      question_total: number;
      total_score: number;
    }>('/evaluations', { method: 'POST', body: payload }),

  getMatrix: (class_id?: number) =>
    request<MatrixResponse>('/matrix', { params: { class_id } }),
  getPrintData: (class_id: number, course_id: number) =>
    request<PrintDataResponse>('/print-data', { params: { class_id, course_id } }),
};
