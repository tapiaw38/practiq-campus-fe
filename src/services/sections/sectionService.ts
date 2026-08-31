import type { AxiosInstance } from "axios";
import type { CourseSection } from "@/types";

export interface ISectionService {
  create(courseId: string, title: string, description?: string): Promise<{ data: CourseSection }>;
  listByCourse(courseId: string): Promise<{ data: CourseSection[] }>;
  update(courseId: string, id: string, title: string, description?: string): Promise<{ data: CourseSection }>;
  remove(courseId: string, id: string): Promise<void>;
}

export class SectionService implements ISectionService {
  constructor(private readonly api: AxiosInstance) {}

  async create(courseId: string, title: string, description = ""): Promise<{ data: CourseSection }> {
    const { data } = await this.api.post(`/courses/${courseId}/sections`, { title, description });
    return data;
  }

  async listByCourse(courseId: string): Promise<{ data: CourseSection[] }> {
    const { data } = await this.api.get(`/courses/${courseId}/sections`);
    return data;
  }

  async update(courseId: string, id: string, title: string, description = "") {
    const { data } = await this.api.put(`/sections/${id}`, { title, description });
    return data;
  }

  async remove(courseId: string, id: string) {
    await this.api.delete(`/sections/${id}`);
  }
}
