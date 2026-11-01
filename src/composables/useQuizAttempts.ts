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
  const savedAnswers = ref<Record<string, string>>({});
  const draftStatus = ref<"idle" | "saving" | "saved" | "error">("idle");

  let serverAnchorMs = 0;
  let perfAnchorMs = 0;

  function anchorClock(serverNow: string) {
    if (!serverNow) return;
    serverAnchorMs = new Date(serverNow).getTime();
    perfAnchorMs = performance.now();
  }

  function serverNowMs() {
    if (!serverAnchorMs) return Date.now();
    return serverAnchorMs + (performance.now() - perfAnchorMs);
  }

  function draftKey(attemptId: string) {
    return `campus:quiz-draft:${attemptId}`;
  }

  function rememberLocally(attemptId: string, answers: { question_id: string; answer_text: string }[]) {
    try {
      localStorage.setItem(draftKey(attemptId), JSON.stringify(answers));
    } catch {
    }
  }

  function recallLocally(attemptId: string): { question_id: string; answer_text: string }[] | null {
    try {
      const raw = localStorage.getItem(draftKey(attemptId));
      return raw ? (JSON.parse(raw) as { question_id: string; answer_text: string }[]) : null;
    } catch {
      return null;
    }
  }

  function forgetLocally(attemptId: string) {
    try {
      localStorage.removeItem(draftKey(attemptId));
    } catch {  }
  }

  let inFlight: Promise<void> | null = null;
  let queued: { attemptId: string; answers: { question_id: string; answer_text: string }[] } | null = null;

  async function flushQueue(): Promise<void> {
    while (queued) {
      const next = queued;
      queued = null;
      draftStatus.value = "saving";
      try {
        await quizService.saveDraft(next.attemptId, next.answers);
        if (!queued && JSON.stringify(recallLocally(next.attemptId)) === JSON.stringify(next.answers)) {
          forgetLocally(next.attemptId);
          draftStatus.value = "saved";
        }
      } catch {
        draftStatus.value = "error";
      }
    }
    inFlight = null;
  }

  function saveDraft(attemptId: string, answers: { question_id: string; answer_text: string }[]) {
    rememberLocally(attemptId, answers);
    queued = { attemptId, answers };
    if (!inFlight) inFlight = flushQueue();
    return inFlight;
  }

  async function loadMyAttempts(quizId: string) {
    myAttempts.value = { ...myAttempts.value, [quizId]: await quizService.listMyAttempts(quizId) };
    return myAttempts.value[quizId];
  }

  async function loadAttemptsByQuiz(quizId: string) {
    attemptsByQuiz.value = { ...attemptsByQuiz.value, [quizId]: await quizService.listAttemptsByQuiz(quizId) };
    return attemptsByQuiz.value[quizId];
  }

  async function start(quizId: string) {
    activeAttempt.value = null;
    activeQuestions.value = [];
    timeLimitSecs.value = null;
    lastResults.value = [];
    savedAnswers.value = {};
    draftStatus.value = "idle";
    try {
      const { attempt, questions, time_limit_secs, resumed, saved_answers, server_now } = await quizService.startAttempt(quizId);
      activeAttempt.value = attempt;
      activeQuestions.value = questions;
      timeLimitSecs.value = time_limit_secs;
      savedAnswers.value = Object.fromEntries((saved_answers ?? []).map((a) => [a.question_id, a.answer_text]));
      const unsaved = recallLocally(attempt.id);
      if (unsaved) {
        for (const a of unsaved) savedAnswers.value[a.question_id] = a.answer_text;
        draftStatus.value = "error";
      }
      anchorClock(server_now);
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
      forgetLocally(attemptId);
      queued = null;
      draftStatus.value = "idle";
      toast.add({ severity: "success", summary: `Nota: ${attempt.score}/${attempt.max_score}`, life: 3000 });
      return { attempt, results };
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "No se pudo enviar la evaluación";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 4000 });
      throw error;
    }
  }

  async function getAttempt(attemptId: string) {
    return quizService.getAttempt(attemptId);
  }

  return { myAttempts, attemptsByQuiz, activeAttempt, activeQuestions, timeLimitSecs, lastResults, savedAnswers, draftStatus, serverNowMs, rememberLocally, loadMyAttempts, loadAttemptsByQuiz, start, saveDraft, submit, getAttempt };
}
