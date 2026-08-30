import type { AxiosInstance } from "axios";
import type { Enrollment, EnrollmentRole } from "@/types";

export interface IEnrollmentService {
  create(courseId: string, email: string, role?: EnrollmentRole): Promise<{ data: Enrollment }>;
  listByCourse(courseId: string): Promise<{ data: Enrollment[] }>;
  listMine(): Promise<{ data: Enrollment[] }>;
  enrollSelf(courseId: string): Promise<{ data: Enrollment }>;
  remove(id: string): Promise<void>;
}

export class EnrollmentService implements IEnrollmentService {
  constructor(private readonly api: AxiosInstance) {}

  async create(
    courseId: string,
    email: string,
    role?: EnrollmentRole,
  ): Promise<{ data: Enrollment }> {
    const { data } = await this.api.post(`/courses/${courseId}/enrollments`, {
      email,
      enrollment_role: role,
    });
    return data;
  }

  async listByCourse(courseId: string): Promise<{ data: Enrollment[] }> {
    const { data } = await this.api.get(`/courses/${courseId}/enrollments`);
    return data;
  }

  async listMine(): Promise<{ data: Enrollment[] }> {
    const { data } = await this.api.get("/me/enrollments");
    return data;
  }

  async enrollSelf(courseId: string): Promise<{ data: Enrollment }> {
    const { data } = await this.api.post(`/courses/${courseId}/enrollments/self`);
    return data;
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/enrollments/${id}`);
  }
}
