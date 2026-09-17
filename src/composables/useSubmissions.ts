import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { SubmissionService, type GradeRubricScore } from "@/services/submissions/submissionService";
import type { Submission } from "@/types";

const submissionService = new SubmissionService(campusApi);

export function useSubmissions() {
  const toast = useToast();
  const submissionsByAssignment = ref<Record<string, Submission[]>>({});
  const mySubmissions = ref<Record<string, Submission | null>>({});
  /**
   * How the lookup for each assignment went.
   *
   * A null submission used to mean three different things — not fetched yet,
   * fetch failed, and genuinely nothing handed in — and the screen read all
   * three as the third, offering a blank submission form to someone who had
   * already handed in. Only "loaded" licenses that conclusion.
   */
  const mineStatus = ref<Record<string, "loading" | "loaded" | "error">>({});
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
    mineStatus.value = { ...mineStatus.value, [assignmentId]: "loading" };
    try {
      const { data } = await submissionService.getMine(assignmentId);
      mySubmissions.value = { ...mySubmissions.value, [assignmentId]: data };
      mineStatus.value = { ...mineStatus.value, [assignmentId]: "loaded" };
      return data;
    } catch (error) {
      mineStatus.value = { ...mineStatus.value, [assignmentId]: "error" };
      throw error;
    }
  }

  async function submit(assignmentId: string, content: string) {
    try {
      const { data } = await submissionService.create(assignmentId, content);
      mySubmissions.value = { ...mySubmissions.value, [assignmentId]: data };
      mineStatus.value = { ...mineStatus.value, [assignmentId]: "loaded" };
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

  async function grade(assignmentId: string, submissionId: string, score: number, feedback: string, rubricScores?: GradeRubricScore[], version?: number) {
    try {
      const { data } = await submissionService.grade(submissionId, score, feedback, rubricScores, version);
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
    mineStatus,
    loading,
    loadByAssignment,
    loadMine,
    submit,
    grade,
  };
}
