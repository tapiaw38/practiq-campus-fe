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
  /** Answers already stored server-side for the attempt being resumed. */
  const savedAnswers = ref<Record<string, string>>({});
  /** Whether the student's latest edits have reached the server. */
  const draftStatus = ref<"idle" | "saving" | "saved" | "error">("idle");

  // Time is anchored once against the server and then advanced with a
  // monotonic clock. Recomputing from Date.now() each tick meant the student
  // could still move the countdown by changing the device clock mid-exam;
  // performance.now() cannot be set.
  let serverAnchorMs = 0;
  let perfAnchorMs = 0;

  function anchorClock(serverNow: string) {
    if (!serverNow) return;
    serverAnchorMs = new Date(serverNow).getTime();
    perfAnchorMs = performance.now();
  }

  /** The server's clock, as best this client can tell. */
  function serverNowMs() {
    if (!serverAnchorMs) return Date.now();
    return serverAnchorMs + (performance.now() - perfAnchorMs);
  }

  function draftKey(attemptId: string) {
    return `campus:quiz-draft:${attemptId}`;
  }

  /**
   * The last answers known for an attempt, kept locally.
   *
   * Written synchronously on every keystroke-batch so that work survives even
   * the gap before the debounced request goes out — closing the tab inside
   * that window used to lose whatever had just been typed.
   */
  function rememberLocally(attemptId: string, answers: { question_id: string; answer_text: string }[]) {
    try {
      localStorage.setItem(draftKey(attemptId), JSON.stringify(answers));
    } catch {
      // A full or disabled store is not worth breaking the exam over; the
      // server copy is still the primary one.
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
    } catch { /* nothing to clean up */ }
  }

  // One save in flight per attempt, with the newest answers queued behind it.
  // Firing every debounce independently let a slow earlier request land after
  // a later one and overwrite newer answers with older ones.
  let inFlight: Promise<void> | null = null;
  let queued: { attemptId: string; answers: { question_id: string; answer_text: string }[] } | null = null;

  async function flushQueue(): Promise<void> {
    while (queued) {
      const next = queued;
      queued = null;
      draftStatus.value = "saving";
      try {
        await quizService.saveDraft(next.attemptId, next.answers);
        // Only clear the local copy once the server has it, and only if
        // nothing newer arrived while this was in flight.
        if (!queued) {
          forgetLocally(next.attemptId);
          draftStatus.value = "saved";
        }
      } catch {
        // Kept locally and reported, rather than swallowed: the student can
        // see their work is not safe yet, and the next edit retries.
        draftStatus.value = "error";
      }
    }
    inFlight = null;
  }

  /**
   * Stores work in progress without closing the attempt.
   *
   * Saves are serialised per attempt so the server always ends up with the
   * latest answers, and the local copy is kept until the server confirms.
   */
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
    savedAnswers.value = {};
    draftStatus.value = "idle";
    try {
      const { attempt, questions, time_limit_secs, resumed, saved_answers, server_now } = await quizService.startAttempt(quizId);
      activeAttempt.value = attempt;
      activeQuestions.value = questions;
      timeLimitSecs.value = time_limit_secs;
      savedAnswers.value = Object.fromEntries((saved_answers ?? []).map((a) => [a.question_id, a.answer_text]));
      // Anything typed but never confirmed by the server outranks the server
      // copy: it is strictly newer, and it is exactly the work that used to
      // disappear when a tab closed inside the save window.
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
      // The submission carried these answers, so the local safety copy has
      // done its job. Dropped only now — never before knowing the hand-in
      // succeeded.
      forgetLocally(attemptId);
      queued = null;
      draftStatus.value = "idle";
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

  return { myAttempts, attemptsByQuiz, activeAttempt, activeQuestions, timeLimitSecs, lastResults, savedAnswers, draftStatus, serverNowMs, loadMyAttempts, loadAttemptsByQuiz, start, saveDraft, submit };
}
