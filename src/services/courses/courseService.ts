import type { AxiosInstance } from "axios";
import type { Course, CourseStatus } from "@/types";

export interface CreateCourseParams {
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  practiq_subject_id?: string;
  labels?: string[];
}

export interface UpdateCourseParams {
  title?: string;
  description?: string;
  status?: CourseStatus;
  start_date?: string;
  end_date?: string;
  practiq_subject_id?: string;
  labels?: string[];
}

export interface ICourseService {
  create(params: CreateCourseParams): Promise<{ data: Course }>;
  list(params?: { publishedOnly?: boolean }): Promise<{ data: Course[] }>;
  get(id: string): Promise<{ data: Course }>;
  update(id: string, params: UpdateCourseParams): Promise<{ data: Course }>;
	delete(id: string): Promise<void>;
  syncFromPractiq(): Promise<{ data: Course[] }>;
  duplicate(id: string): Promise<{ data: Course }>;
}

export class CourseService implements ICourseService {
  constructor(private readonly api: AxiosInstance) {}

  async create(params: CreateCourseParams): Promise<{ data: Course }> {
    const { data } = await this.api.post("/courses", params);
    return data;
  }

  async list(params?: { publishedOnly?: boolean }): Promise<{ data: Course[] }> {
    const { data } = await this.api.get("/courses", { params: params?.publishedOnly ? { published_only: true } : undefined });
    return data;
  }

  async get(id: string): Promise<{ data: Course }> {
    const { data } = await this.api.get(`/courses/${id}`);
    return data;
  }

  async update(id: string, params: UpdateCourseParams): Promise<{ data: Course }> {
    const { data } = await this.api.put(`/courses/${id}`, params);
    return data;
  }

  async delete(id: string): Promise<void> { await this.api.delete(`/courses/${id}`); }

  async syncFromPractiq(): Promise<{ data: Course[] }> {
    const { data } = await this.api.post("/courses/sync-from-practiq");
    return data;
  }

  async duplicate(id: string): Promise<{ data: Course }> {
    const { data } = await this.api.post(`/courses/${id}/duplicate`);
    return data;
  }
}
