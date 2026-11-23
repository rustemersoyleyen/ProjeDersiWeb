export type UserRole = 'admin' | 'teacher';

export interface User {
  id: number;
  username: string;
  full_name: string;
  branch: string;
  title: string;
  role: UserRole;
  is_active: number;
  must_change_password?: number;
  created_at?: string;
}

export interface SettingsMap {
  school_name?: string;
  academic_year?: string;
  evaluation_title?: string;
  [key: string]: string | undefined;
}

export interface Course {
  id: number;
  name: string;
  short_code: string;
  description?: string | null;
  question_points: number;
  sort_order: number;
  question_count?: number;
  rubric_points?: number;
}

export interface Outcome {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  default_weight: number;
  is_question_outcome: number;
  sort_order: number;
}

export interface RubricLevel {
  level: number;
  label: string;
  description: string;
  points: number;
}

export interface Criterion {
  id: number;
  course_id: number;
  outcome_id: number;
  name: string;
  max_score: number;
  rubric_levels: RubricLevel[];
  sort_order: number;
}

export interface AssignedTeacher {
  teacher_id: number;
  full_name: string;
  branch: string;
  title: string;
}

export interface ClassInfo {
  id: number;
  name: string;
  academic_year: string;
  school_name: string;
  student_count: number;
  course_teachers: Record<string, AssignedTeacher[]>;
  created_at?: string;
}

export interface Project {
  id: number;
  title: string;
  description?: string | null;
  student_count: number;
}

export interface StudentEvalSummary {
  total_score: number;
  rubric_total: number;
  question_total: number;
}

export interface Student {
  id: number;
  class_id: number;
  class_name?: string;
  student_no: string;
  full_name: string;
  project_id: number | null;
  project_title?: string | null;
  evaluations: Record<string, StudentEvalSummary>;
  question_counts: Record<string, number>;
}

export type Difficulty = 'kolay' | 'orta' | 'zor';

export interface Question {
  id: number;
  course_id: number;
  question_text: string;
  difficulty: Difficulty;
  expected_hint?: string | null;
}

export interface StudentQuestion {
  id: number;
  question_id: number;
  sort_order: number;
  max_score: number;
  score: number | null;
  note?: string | null;
  question_text: string;
  difficulty?: Difficulty;
  expected_hint?: string | null;
}

export interface EvaluationData {
  student: {
    id: number;
    class_id: number;
    student_no: string;
    full_name: string;
    project_id: number | null;
    project_title: string | null;
    class_name: string;
    academic_year: string;
    school_name: string;
  };
  course: {
    id: number;
    name: string;
    short_code: string;
    question_points: number;
  };
  criteria: Criterion[];
  questions: StudentQuestion[];
  evaluation: {
    id: number;
    rubric_total: number;
    question_total: number;
    total_score: number;
    notes: string | null;
    evaluated_at: string;
  } | null;
  scores: Record<string, { selected_level: number | null; score: number }>;
  teachers: Array<{ id: number; full_name: string; branch: string; title: string }>;
}

export interface MatrixResponse {
  stats: {
    classes: number;
    students: number;
    projects: number;
    questions: number;
    evaluations: number;
    teachers: number;
  };
  courses: Array<{ id: number; name: string; short_code: string }>;
  rows: Array<{
    id: number;
    student_no: string;
    full_name: string;
    project_title: string | null;
    scores: Record<string, number>;
    average: number | null;
  }>;
}

export interface PrintDataResponse {
  class_info: {
    id: number;
    name: string;
    academic_year: string;
    school_name: string;
  };
  course: {
    id: number;
    name: string;
    short_code: string;
    question_points: number;
  };
  settings: SettingsMap;
  teachers: Array<{ id: number; full_name: string; branch: string; title: string }>;
  outcomes: Outcome[];
  criteria: Array<{
    id: number;
    outcome_id: number;
    name: string;
    max_score: number;
    sort_order: number;
  }>;
  students: Array<{
    id: number;
    student_no: string;
    full_name: string;
    project_title: string | null;
    questions: Array<{
      sort_order: number;
      question_text: string;
      max_score: number;
      score: number | null;
    }>;
    evaluation: {
      rubric_total: number;
      question_total: number;
      total_score: number;
      notes: string | null;
    } | null;
    criterion_scores: Record<string, number>;
  }>;
}

export interface AuthBootstrap {
  authenticated: boolean;
  user: User | null;
  settings?: SettingsMap;
  courses?: Course[];
  outcomes?: Outcome[];
}
