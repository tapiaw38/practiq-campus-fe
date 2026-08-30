import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { QuizService, type CreateQuizParams, type QuestionParams } from "@/services/quizzes/quizService";
import type { Quiz, QuizQuestion, QuizQuestionType } from "@/types/quiz";

const quizService = new QuizService(campusApi);

export function useQuizzes() {
  const toast = useToast();
  const quizzes = ref<Quiz[]>([]);
  const loading = ref(false);
  const questions = ref<Record<string, QuizQuestion[]>>({});

  async function loadQuizzes(courseId: string) {
    loading.value = true;
    try {
      quizzes.value = await quizService.listByCourse(courseId);
      return quizzes.value;
    } finally {
      loading.value = false;
    }
  }

  async function createQuiz(courseId: string, params: CreateQuizParams) {
    try {
      const created = await quizService.create(courseId, params);
      quizzes.value = [...quizzes.value, created];
      toast.add({ severity: "success", summary: "Evaluación creada", life: 2000 });
      return created;
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo crear la evaluación", life: 3000 });
      throw error;
    }
  }

  async function updateQuiz(id: string, params: CreateQuizParams) {
    try {
      const updated = await quizService.update(id, params);
      quizzes.value = quizzes.value.map((q) => q.id === id ? updated : q);
      toast.add({ severity: "success", summary: "Evaluación actualizada", life: 2000 });
      return updated;
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo actualizar la evaluación", life: 3000 });
      throw error;
    }
  }

  async function deleteQuiz(id: string) {
    try {
      await quizService.remove(id);
      quizzes.value = quizzes.value.filter((q) => q.id !== id);
      toast.add({ severity: "success", summary: "Evaluación eliminada", life: 2000 });
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo eliminar la evaluación", life: 3000 });
      throw error;
    }
  }

  async function loadQuestions(quizId: string) {
    questions.value = { ...questions.value, [quizId]: await quizService.listQuestions(quizId) };
    return questions.value[quizId];
  }

  async function saveQuestions(quizId: string, list: QuestionParams[]) {
    try {
      await quizService.replaceQuestions(quizId, list);
      questions.value = { ...questions.value, [quizId]: list.map((q, i) => ({ id: String(i), ...q, type: q.type as QuizQuestionType })) };
      toast.add({ severity: "success", summary: "Preguntas guardadas", life: 2000 });
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "No se pudieron guardar las preguntas";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 3500 });
      throw error;
    }
  }

  return { quizzes, loading, questions, loadQuizzes, createQuiz, updateQuiz, deleteQuiz, loadQuestions, saveQuestions };
}
