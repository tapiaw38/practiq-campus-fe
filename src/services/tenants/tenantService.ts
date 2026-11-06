import type { AxiosInstance } from "axios";

export type CampusTenant = {
    id: string;
    school_id: string;
    name: string;
    role: "admin" | "teacher" | "student";
};

export class TenantService {
    constructor(private readonly api: AxiosInstance) {}
    async mine(): Promise<CampusTenant[]> {
        return (await this.api.get<{ data: CampusTenant[] }>("/tenants/mine")).data.data;
    }
}

export type CampusTenantAdmin = {
    id: string;
    school_id: string;
    name: string;
    status: "active" | "suspended" | "closed";
    eligible: boolean;
};

export type CampusTenantAdminPatch = Omit<CampusTenantAdmin, "name" | "eligible"> &
    Partial<Pick<CampusTenantAdmin, "name" | "eligible">>;

export type PractiqSchool = {
    id: string;
    name: string;
    kind: string;
    billing: string;
    status: string;
};

export type EligibleSchool = { id: string; name: string };

export class TenantAdminService {
    constructor(private readonly api: AxiosInstance) {}

    async eligibleSchools(): Promise<EligibleSchool[]> {
        return (await this.api.get<{ data: EligibleSchool[] }>("/tenants/eligible-schools")).data
            .data;
    }

    async list(): Promise<CampusTenantAdmin[]> {
        return (await this.api.get<{ data: CampusTenantAdmin[] }>("/tenants")).data.data;
    }

    async activate(schoolID: string): Promise<CampusTenantAdmin> {
        return (
            await this.api.post<{ data: CampusTenantAdmin }>("/tenants", { school_id: schoolID })
        ).data.data;
    }

    async setStatus(
        id: string,
        status: CampusTenantAdmin["status"],
    ): Promise<CampusTenantAdminPatch> {
        return (
            await this.api.patch<{ data: CampusTenantAdminPatch }>(`/tenants/${id}/status`, {
                status,
            })
        ).data.data;
    }
}
