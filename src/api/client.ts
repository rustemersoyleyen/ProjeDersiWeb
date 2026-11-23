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

const API_BASE = './api/index.php';

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

  const res = await fetch(`${API_BASE}?${qs.toString()}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      res.ok
        ? 'Sunucudan geçersiz JSON yanıtı alındı.'
        : `Sunucu hatası (${res.status}): API bağlantısını kontrol edin.`
    );
  }

  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `İstek başarısız oldu (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  me: () => request<AuthBootstrap>('/auth/me'),
  login: (username: string, password: string) =>
    request<{ ok: boolean; user: User }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
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
