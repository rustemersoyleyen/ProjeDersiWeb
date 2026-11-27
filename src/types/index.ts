export type UserRole = 'admin' | 'teacher';
export type SubjectModelType = 'project_rubric' | 'practice_assignment';
export type EvaluationMode = 'rubric_full' | 'weekly_plus_final' | 'practice_simple';
export type QuestionType = 'technical_easy' | 'technical_hard' | 'vision_comment';
export type WeeklyStatus = 'done' | 'partial' | 'missing';

export interface TeacherAssignment {
  class_id: number;
  course_id: number;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  branch: string;
  title: string;
  role: UserRole;
  is_active: number;
  must_change_password?: number;
  assignments?: TeacherAssignment[];
  created_at?: string;
}

export interface SettingsMap {
  school_name?: string;
  academic_year?: string;
  evaluation_title?: string;
  [key: string]: string | undefined;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  model_type: SubjectModelType;
  description?: string | null;
  sort_order: number;
  is_active: number;
  course_count?: number;
}

export interface Course {
  id: number;
  subject_id: number;
  subject_name?: string;
  model_type?: SubjectModelType;
  name: string;
  short_code: string;
  description?: string | null;
  question_points: number;
  evaluation_mode: EvaluationMode;
  final_completion_points: number;
  final_report_points: number;
  sort_order: number;
  question_count?: number;
  rubric_points?: number;
  weekly_task_count?: number;
  weekly_points_sum?: number;
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
  weekly_total?: number;
  question_total: number;
}

export interface StudentCourseProject {
  project_id: number | null;
  project_title?: string | null;
  custom_title?: string | null;
  initial_vision_note?: string | null;
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
  course_projects?: Record<string, StudentCourseProject>;
}

export type Difficulty = 'kolay' | 'orta' | 'zor';

export interface Question {
  id: number;
  course_id: number;
  question_text: string;
  difficulty: Difficulty;
  question_type: QuestionType;
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
  question_type?: QuestionType;
  expected_hint?: string | null;
}

export interface WeeklyTask {
  id: number;
  course_id: number;
  week_no: number;
  title: string;
  description?: string | null;
  max_score: number;
  due_date?: string | null;
  sort_order: number;
}

export interface WeeklyScoreEntry {
  status: WeeklyStatus;
  score: number;
  note?: string | null;
}

export interface WeeklyScoresResponse {
  tasks: WeeklyTask[];
  students: Array<{
    id: number;
    student_no: string;
    full_name: string;
    project_title: string | null;
    weekly_scores: Record<string, WeeklyScoreEntry>;
    weekly_total: number;
  }>;
}

export interface EvaluationData {
  student: {
    id: number;
    class_id: number;
    student_no: string;
    full_name: string;
    project_id: number | null;
    project_title: string | null;
    base_project_title?: string | null;
    initial_vision_note?: string | null;
    class_name: string;
    academic_year: string;
    school_name: string;
  };
  course: {
    id: number;
    subject_id: number;
    subject_name?: string;
    model_type?: SubjectModelType;
    name: string;
    short_code: string;
    question_points: number;
    evaluation_mode: EvaluationMode;
    final_completion_points: number;
    final_report_points: number;
  };
  criteria: Criterion[];
  weekly_items: Array<{
    id: number;
    week_no: number;
    title: string;
    description?: string | null;
    max_score: number;
    due_date?: string | null;
    status: WeeklyStatus;
    score: number;
    note?: string | null;
  }>;
  weekly_summary: {
    earned: number;
    max: number;
  };
  questions: StudentQuestion[];
  evaluation: {
    id: number;
    rubric_total: number;
    weekly_total: number;
    final_completion_score: number | null;
    final_report_score: number | null;
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
  courses: Array<{
    id: number;
    subject_id: number;
    name: string;
    short_code: string;
    evaluation_mode?: EvaluationMode;
  }>;
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
    subject_id: number;
    subject_name?: string;
    model_type?: SubjectModelType;
    name: string;
    short_code: string;
    question_points: number;
    evaluation_mode: EvaluationMode;
    final_completion_points: number;
    final_report_points: number;
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
  weekly_tasks: Array<{
    id: number;
    week_no: number;
    title: string;
    max_score: number;
  }>;
  students: Array<{
    id: number;
    student_no: string;
    full_name: string;
    project_title: string | null;
    initial_vision_note?: string | null;
    questions: Array<{
      sort_order: number;
      question_text: string;
      question_type?: QuestionType;
      max_score: number;
      score: number | null;
    }>;
    weekly_scores: Record<string, { status: WeeklyStatus; score: number }>;
    weekly_total: number;
    evaluation: {
      rubric_total: number;
      weekly_total: number;
      final_completion_score: number | null;
      final_report_score: number | null;
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
  subjects?: Subject[];
  courses?: Course[];
  outcomes?: Outcome[];
  assignments?: TeacherAssignment[];
}
