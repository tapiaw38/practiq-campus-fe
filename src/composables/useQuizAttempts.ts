import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { QuizService } from "@/services/quizzes/quizService";
import type { QuizAttempt, StudentQuizQuestion, QuizAnswerResult } from "@/types/quiz";

const quizService = new QuizService(campusApi);

export function useQuizAttempts() {
  const toast = useToast();
  const myAttempts = ref<Record<string, QuizAttempt[]>>({});
  const attemptsByQuiz = ref<Record<string, QuizAttempt[]>>({});
  const activeAttempt = ref<QuizAttempt | null>(null);
  const activeQuestions = ref<StudentQuizQuestion[]>([]);
  const timeLimitSecs = ref<number | null>(null);
  const lastResults = ref<QuizAnswerResult[]>([]);

  async function loadMyAttempts(quizId: string) {
    myAttempts.value = { ...myAttempts.value, [quizId]: await quizService.listMyAttempts(quizId) };
    return myAttempts.value[quizId];
  }

  async function loadAttemptsByQuiz(quizId: string) {
    attemptsByQuiz.value = { ...attemptsByQuiz.value, [quizId]: await quizService.listAttemptsByQuiz(quizId) };
    return attemptsByQuiz.value[quizId];
  }

  async function start(quizId: string) {
    try {
      const { attempt, questions, time_limit_secs } = await quizService.startAttempt(quizId);
      activeAttempt.value = attempt;
      activeQuestions.value = questions;
      timeLimitSecs.value = time_limit_secs;
      lastResults.value = [];
      return attempt;
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "No se pudo iniciar la evaluación";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 3500 });
      throw error;
    }
  }

  async function submit(attemptId: string, answers: { question_id: string; answer_text: string }[]) {
    try {
      const { attempt, results } = await quizService.submitAttempt(attemptId, answers);
      activeAttempt.value = attempt;
      lastResults.value = results;
      toast.add({ severity: "success", summary: `Nota: ${attempt.score}/${attempt.max_score}`, life: 3000 });
      return { attempt, results };
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo enviar la evaluación", life: 3000 });
      throw error;
    }
  }

  return { myAttempts, attemptsByQuiz, activeAttempt, activeQuestions, timeLimitSecs, lastResults, loadMyAttempts, loadAttemptsByQuiz, start, submit };
}
