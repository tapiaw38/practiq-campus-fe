import type { AxiosInstance } from "axios";

export type SchoolMember = {
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  active: boolean;
};

export class SchoolService {
  constructor(private readonly api: AxiosInstance) {}

  async members(): Promise<SchoolMember[]> {
    return (await this.api.get<{ data: SchoolMember[] }>("/school/members")).data.data;
  }

  async addMember(userID: string, role: SchoolMember["role"]): Promise<void> {
    await this.api.post("/school/members", { user_id: userID, role });
  }

  async removeMember(userID: string): Promise<void> {
    await this.api.delete(`/school/members/${encodeURIComponent(userID)}`);
  }
}
