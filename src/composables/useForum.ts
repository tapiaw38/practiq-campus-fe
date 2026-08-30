import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { ForumService } from "@/services/forums/forumService";
import type { ForumThread, ForumPost } from "@/types";

const forumService = new ForumService(campusApi);

export function useForum() {
  const toast = useToast();
  const threads = ref<ForumThread[]>([]);
  const postsByThread = ref<Record<string, ForumPost[]>>({});
  const loading = ref(false);

  async function loadThreads(courseId: string) {
    loading.value = true;
    try {
      const { data } = await forumService.listThreads(courseId);
      threads.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function createThread(courseId: string, title: string) {
    try {
      const { data } = await forumService.createThread(courseId, title);
      threads.value = [data, ...threads.value];
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear el tema",
        life: 3000,
      });
      throw error;
    }
  }

  async function updateThread(id: string, params: { title: string; description: string }) {
    try {
      const { data } = await forumService.updateThread(id, params);
      threads.value = threads.value.map((thread) => thread.id === id ? data : thread);
      toast.add({ severity: "success", summary: "Tema actualizado", life: 2000 });
      return data;
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo actualizar el tema", life: 3000 });
      throw error;
    }
  }

  async function loadPosts(threadId: string, options?: { limit?: number; offset?: number; append?: boolean; prepend?: boolean }) {
    const result = await forumService.listPosts(threadId, { limit: options?.limit, offset: options?.offset });
    const { data } = result;
    const current = postsByThread.value[threadId] || [];
    const next = options?.prepend ? [...data, ...current] : options?.append ? [...current, ...data] : data;
    postsByThread.value = { ...postsByThread.value, [threadId]: next };
    return result;
  }

  async function createPost(threadId: string, body: string, parentPostId?: string | null) {
    try {
      const { data } = await forumService.createPost(threadId, body, parentPostId);
      postsByThread.value = {
        ...postsByThread.value,
        [threadId]: [...(postsByThread.value[threadId] || []), data],
      };
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo publicar la respuesta",
        life: 3000,
      });
      throw error;
    }
  }

  return { threads, postsByThread, loading, loadThreads, createThread, updateThread, loadPosts, createPost };
}
