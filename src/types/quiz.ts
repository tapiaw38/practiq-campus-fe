export type QuizQuestionType = "multiple_choice" | "true_false" | "fill_blanks";

export interface Quiz {
  id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  description: string;
  time_limit_secs: number | null;
  max_attempts: number;
  scheduled_at: string | null;
  available_until: string | null;
  created_at: string;
}

/** Teacher-facing question shape — carries correct_answer. */
export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  statement: string;
  options: string[];
  correct_answer: string;
  points: number;
}

/** Student-facing question shape while an attempt is in progress. */
export interface StudentQuizQuestion {
  id: string;
  type: QuizQuestionType;
  statement: string;
  options: string[];
  points: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  user_name?: string;
  attempt_number: number;
  started_at: string;
  submitted_at: string | null;
  score: number;
  max_score: number;
}

export interface QuizAnswerResult {
  question_id: string;
  statement: string;
  answer_text: string;
  correct_answer: string;
  is_correct: boolean;
  points: number;
}
