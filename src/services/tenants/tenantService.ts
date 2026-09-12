import type { AxiosInstance } from "axios";

export type CampusTenant = { id: string; school_id: string; name: string; role: "admin" | "teacher" | "student" };

export class TenantService {
  constructor(private readonly api: AxiosInstance) {}
  async mine(): Promise<CampusTenant[]> { return (await this.api.get<{ data: CampusTenant[] }>("/tenants/mine")).data.data; }
}

/** What the platform superadmin sees: every Campus institution, with what
 *  practiq-be currently says about its school. */
export type CampusTenantAdmin = {
  id: string;
  school_id: string;
  name: string;
  status: "active" | "suspended" | "closed";
  /** False when the school no longer qualifies — closed, or moved off contract
   *  billing. The record stays; what it may do does not. */
  eligible: boolean;
};

export type PractiqSchool = {
  id: string;
  name: string;
  kind: string;
  billing: string;
  status: string;
};

export class TenantAdminService {
  constructor(private readonly api: AxiosInstance) {}

  async list(): Promise<CampusTenantAdmin[]> {
    return (await this.api.get<{ data: CampusTenantAdmin[] }>("/tenants")).data.data;
  }

  /** Campus verifies the school against practiq-be before enabling it, so a
   *  school id that does not qualify is refused there rather than here. */
  async activate(schoolID: string): Promise<CampusTenantAdmin> {
    return (await this.api.post<{ data: CampusTenantAdmin }>("/tenants", { school_id: schoolID })).data.data;
  }

  async setStatus(id: string, status: CampusTenantAdmin["status"]): Promise<CampusTenantAdmin> {
    return (await this.api.patch<{ data: CampusTenantAdmin }>(`/tenants/${id}/status`, { status })).data.data;
  }
}
