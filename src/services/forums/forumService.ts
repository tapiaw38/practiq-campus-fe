import type { AxiosInstance } from "axios";
import type { ForumThread, ForumPost } from "@/types";

export interface IForumService {
  createThread(courseId: string, title: string): Promise<{ data: ForumThread }>;
  updateThread(id: string, params: { title: string; description: string }): Promise<{ data: ForumThread }>;
  listThreads(courseId: string): Promise<{ data: ForumThread[] }>;
  createPost(threadId: string, body: string, parentPostId?: string | null): Promise<{ data: ForumPost }>;
  listPosts(threadId: string, params?: { limit?: number; offset?: number }): Promise<{ data: ForumPost[]; has_more: boolean }>;
}

export class ForumService implements IForumService {
  constructor(private readonly api: AxiosInstance) {}

  async createThread(courseId: string, title: string): Promise<{ data: ForumThread }> {
    const { data } = await this.api.post(`/courses/${courseId}/forum-threads`, { title });
    return data;
  }

  async listThreads(courseId: string): Promise<{ data: ForumThread[] }> {
    const { data } = await this.api.get(`/courses/${courseId}/forum-threads`);
    return data;
  }

  async updateThread(id: string, params: { title: string; description: string }): Promise<{ data: ForumThread }> {
    const { data } = await this.api.put(`/forum-threads/${id}`, params);
    return data;
  }

  async createPost(threadId: string, body: string, parentPostId?: string | null): Promise<{ data: ForumPost }> {
    const { data } = await this.api.post(`/forum-threads/${threadId}/posts`, { body, parent_post_id: parentPostId || undefined });
    return data;
  }

  async listPosts(threadId: string, params?: { limit?: number; offset?: number }): Promise<{ data: ForumPost[]; has_more: boolean }> {
    const { data } = await this.api.get(`/forum-threads/${threadId}/posts`, { params });
    return data;
  }
}
