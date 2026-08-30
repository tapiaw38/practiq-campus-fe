import type { AxiosInstance } from "axios";
import type { Profile, CreateOrSyncUserParams, PractiqStudent } from "@/types";

export interface UsersPage { page: number; per_page: number; total: number; total_pages: number; }
export interface UsersResponse { data: Profile[]; meta: UsersPage; }

export interface IProfileService {
  sync(fullName: string, email: string): Promise<{ data: Profile }>;
  getMe(): Promise<{ data: Profile }>;
  createOrSyncUser(params: CreateOrSyncUserParams): Promise<{ data: Profile }>;
  listUsers(params?: { search?: string; page?: number }): Promise<UsersResponse>;
  setBlocked(id: string, blocked: boolean): Promise<{ data: Profile }>;
  listMyPractiqStudents(): Promise<{ data: PractiqStudent[] }>;
}

export class ProfileService implements IProfileService {
  constructor(private readonly api: AxiosInstance) {}

  async sync(fullName: string, email: string): Promise<{ data: Profile }> {
    const { data } = await this.api.post("/profile", { full_name: fullName, email });
    return data;
  }

  async getMe(): Promise<{ data: Profile }> {
    const { data } = await this.api.get("/profile/me");
    return data;
  }

  async createOrSyncUser(params: CreateOrSyncUserParams): Promise<{ data: Profile }> {
    const { data } = await this.api.post("/users", params);
    return data;
  }

  async listUsers(params?: { search?: string; page?: number }): Promise<UsersResponse> {
    const { data } = await this.api.get("/users", { params });
    return data;
  }

  async setBlocked(id: string, blocked: boolean): Promise<{ data: Profile }> {
    const { data } = await this.api.patch(`/users/${id}/block`, { blocked });
    return data;
  }

  async listMyPractiqStudents(): Promise<{ data: PractiqStudent[] }> {
    const { data } = await this.api.get("/me/practiq-students");
    return data;
  }
}
