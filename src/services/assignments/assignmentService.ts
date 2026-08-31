import type { AxiosInstance } from "axios";
import type { Assignment } from "@/types";

export interface CreateAssignmentParams {
  title: string;
  description?: string;
  due_at?: string;
  max_score?: number;
  section_id?: string | null;
  weight?: number;
  visible_group_id?: string | null;
  unlock_after_type?: "assignment" | "quiz" | null;
  unlock_after_id?: string | null;
}

export interface IAssignmentService {
  create(courseId: string, params: CreateAssignmentParams): Promise<{ data: Assignment }>;
  listByCourse(courseId: string): Promise<{ data: Assignment[] }>;
  update(courseId: string, id: string, params: CreateAssignmentParams): Promise<{ data: Assignment }>;
  remove(courseId: string, id: string): Promise<void>;
}

export class AssignmentService implements IAssignmentService {
  constructor(private readonly api: AxiosInstance) {}

  async create(courseId: string, params: CreateAssignmentParams): Promise<{ data: Assignment }> {
    const { data } = await this.api.post(`/courses/${courseId}/assignments`, params);
    return data;
  }

  async listByCourse(courseId: string): Promise<{ data: Assignment[] }> {
    const { data } = await this.api.get(`/courses/${courseId}/assignments`);
    return data;
  }

  async update(courseId: string, id: string, params: CreateAssignmentParams) {
    const { data } = await this.api.put(`/assignments/${id}`, params);
    return data;
  }

  async remove(courseId: string, id: string) {
    await this.api.delete(`/assignments/${id}`);
  }
}
