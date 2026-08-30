import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { SubmissionService } from "@/services/submissions/submissionService";
import type { Submission } from "@/types";

const submissionService = new SubmissionService(campusApi);

export function useSubmissions() {
  const toast = useToast();
  const submissionsByAssignment = ref<Record<string, Submission[]>>({});
  const mySubmissions = ref<Record<string, Submission | null>>({});
  const loading = ref(false);

  async function loadByAssignment(assignmentId: string) {
    loading.value = true;
    try {
      const { data } = await submissionService.listByAssignment(assignmentId);
      submissionsByAssignment.value = { ...submissionsByAssignment.value, [assignmentId]: data };
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function loadMine(assignmentId: string) {
    const { data } = await submissionService.getMine(assignmentId);
    mySubmissions.value = { ...mySubmissions.value, [assignmentId]: data };
    return data;
  }

  async function submit(assignmentId: string, content: string) {
    try {
      const { data } = await submissionService.create(assignmentId, content);
      mySubmissions.value = { ...mySubmissions.value, [assignmentId]: data };
      toast.add({ severity: "success", summary: "Entrega enviada", life: 2000 });
      return data;
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo enviar la entrega";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 3000 });
      throw error;
    }
  }

  async function grade(assignmentId: string, submissionId: string, score: number, feedback: string) {
    try {
      const { data } = await submissionService.grade(submissionId, score, feedback);
      submissionsByAssignment.value = {
        ...submissionsByAssignment.value,
        [assignmentId]: (submissionsByAssignment.value[assignmentId] || []).map((s) =>
          s.id === submissionId ? data : s,
        ),
      };
      toast.add({ severity: "success", summary: "Calificado", life: 2000 });
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo calificar",
        life: 3000,
      });
      throw error;
    }
  }

  return {
    submissionsByAssignment,
    mySubmissions,
    loading,
    loadByAssignment,
    loadMine,
    submit,
    grade,
  };
}
