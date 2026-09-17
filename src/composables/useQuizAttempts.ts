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

  /**
   * Starts a quiz, or rejoins the attempt already in progress.
   *
   * On failure it clears the active attempt rather than leaving the previous
   * one in place: keeping it meant a failed start could show the questions
   * and attempt id of whatever quiz was opened before, under the new quiz's
   * title, with Entregar wired to the wrong attempt.
   */
  async function start(quizId: string) {
    activeAttempt.value = null;
    activeQuestions.value = [];
    timeLimitSecs.value = null;
    lastResults.value = [];
    try {
      const { attempt, questions, time_limit_secs, resumed } = await quizService.startAttempt(quizId);
      activeAttempt.value = attempt;
      activeQuestions.value = questions;
      timeLimitSecs.value = time_limit_secs;
      if (resumed) {
        toast.add({ severity: "info", summary: "Continuás tu intento en curso", life: 3000 });
      }
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
      // Show what the server said — "se acabó el tiempo" and "ya entregaste
      // este intento" are different problems and the student can act on the
      // difference; a blanket message hid both.
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "No se pudo enviar la evaluación";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 4000 });
      throw error;
    }
  }

  return { myAttempts, attemptsByQuiz, activeAttempt, activeQuestions, timeLimitSecs, lastResults, loadMyAttempts, loadAttemptsByQuiz, start, submit };
}
