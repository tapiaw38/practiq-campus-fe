import type { AxiosInstance } from "axios";
import type { CourseGroup } from "@/types/courseGroup";

export class CourseGroupService {
  constructor(private readonly api: AxiosInstance) {}
  async listByCourse(courseId: string) { return (await this.api.get<{ data: CourseGroup[] }>(`/courses/${courseId}/groups`)).data.data; }
  async create(courseId: string, name: string) { return (await this.api.post<{ data: CourseGroup }>(`/courses/${courseId}/groups`, { name })).data.data; }
  async remove(id: string) { await this.api.delete(`/groups/${id}`); }
  async addMember(groupId: string, userId: string) { await this.api.post(`/groups/${groupId}/members`, { user_id: userId }); }
  async removeMember(groupId: string, userId: string) { await this.api.delete(`/groups/${groupId}/members/${userId}`); }
}
