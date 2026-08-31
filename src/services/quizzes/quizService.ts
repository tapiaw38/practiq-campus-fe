import type { AxiosInstance } from "axios";
import type { Quiz, QuizQuestion, QuizAttempt, QuizAnswerResult, StudentQuizQuestion } from "@/types/quiz";

export interface CreateQuizParams {
  section_id?: string | null;
  title: string;
  description?: string;
  time_limit_secs?: number | null;
  max_attempts?: number;
  scheduled_at?: string | null;
  available_until?: string | null;
  weight?: number;
  visible_group_id?: string | null;
  unlock_after_type?: "assignment" | "quiz" | null;
  unlock_after_id?: string | null;
}

export interface QuestionParams {
  type: string;
  statement: string;
  options: string[];
  correct_answer: string;
  points: number;
}

export interface StartAttemptResult {
  attempt: QuizAttempt;
  questions: StudentQuizQuestion[];
  time_limit_secs: number | null;
}

export interface SubmitAttemptResult {
  attempt: QuizAttempt;
  results: QuizAnswerResult[];
}

export class QuizService {
  constructor(private readonly api: AxiosInstance) {}

  async listByCourse(courseId: string) { return (await this.api.get<{ data: Quiz[] }>(`/courses/${courseId}/quizzes`)).data.data; }
  async create(courseId: string, params: CreateQuizParams) { return (await this.api.post<{ data: Quiz }>(`/courses/${courseId}/quizzes`, params)).data.data; }
  async get(id: string) { return (await this.api.get<{ data: Quiz }>(`/quizzes/${id}`)).data.data; }
  async update(id: string, params: CreateQuizParams) { return (await this.api.put<{ data: Quiz }>(`/quizzes/${id}`, params)).data.data; }
  async remove(id: string) { await this.api.delete(`/quizzes/${id}`); }

  async listQuestions(quizId: string) { return (await this.api.get<{ data: QuizQuestion[] }>(`/quizzes/${quizId}/questions`)).data.data; }
  async replaceQuestions(quizId: string, questions: QuestionParams[]) { await this.api.put(`/quizzes/${quizId}/questions`, { questions }); }

  async startAttempt(quizId: string) { return (await this.api.post<StartAttemptResult>(`/quizzes/${quizId}/attempts`)).data; }
  async listMyAttempts(quizId: string) { return (await this.api.get<{ data: QuizAttempt[] }>(`/quizzes/${quizId}/attempts/mine`)).data.data; }
  async listAttemptsByQuiz(quizId: string) { return (await this.api.get<{ data: QuizAttempt[] }>(`/quizzes/${quizId}/attempts`)).data.data; }
  async submitAttempt(attemptId: string, answers: { question_id: string; answer_text: string }[]) { return (await this.api.post<SubmitAttemptResult>(`/attempts/${attemptId}/submit`, { answers })).data; }
  async getAttempt(attemptId: string) { return (await this.api.get<{ attempt: QuizAttempt; results: QuizAnswerResult[] }>(`/attempts/${attemptId}`)).data; }
}
