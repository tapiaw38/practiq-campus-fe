import type { AxiosInstance } from "axios";
import { setRefreshToken } from "@/api/request/server";
import type {
    AuthUser,
    LoginParams,
    LoginResponse,
    RegisterParams,
    RegisterResponse,
} from "@/types";

export interface IAuthService {
    login(params: LoginParams): Promise<LoginResponse>;
    register(params: RegisterParams): Promise<RegisterResponse>;
    searchUsers(query: string, limit?: number): Promise<AuthUser[]>;
}

export class AuthService implements IAuthService {
    constructor(private readonly api: AxiosInstance) {}

    async searchUsers(query: string, limit = 8): Promise<AuthUser[]> {
        const { data } = await this.api.get<{ data: AuthUser[] }>("/user/list", {
            params: { search: query, limit },
        });
        return data.data;
    }

    async login(params: LoginParams): Promise<LoginResponse> {
        const payload = params.ssoType
            ? { sso_type: params.ssoType, code: params.ssoCode }
            : { email: params.email, password: params.password };
        const { data } = await this.api.post("/auth/login", payload);
        if (data?.refresh_token) setRefreshToken(data.refresh_token);
        return data;
    }

    async register(params: RegisterParams): Promise<RegisterResponse> {
        const { data } = await this.api.post("/auth/register", {
            first_name: params.first_name,
            last_name: params.last_name,
            email: params.email,
            password: params.password,
        });
        return data;
    }
}
