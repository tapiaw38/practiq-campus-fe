import type { AxiosInstance } from "axios";
import type { LoginParams, LoginResponse, RegisterParams, RegisterResponse } from "@/types";

export interface IAuthService {
  login(params: LoginParams): Promise<LoginResponse>;
  register(params: RegisterParams): Promise<RegisterResponse>;
}

// Hits auth-api-be directly — the identity microservice shared with
// practiq-fe. Campus never stores a password itself.
export class AuthService implements IAuthService {
  constructor(private readonly api: AxiosInstance) {}

  async login(params: LoginParams): Promise<LoginResponse> {
    const payload = params.ssoType
      ? { sso_type: params.ssoType, code: params.ssoCode }
      : { email: params.email, password: params.password };
    const { data } = await this.api.post("/auth/login", payload);
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
