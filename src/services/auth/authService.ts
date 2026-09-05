import type { AxiosInstance } from "axios";
import type { AuthUser, LoginParams, LoginResponse, RegisterParams, RegisterResponse } from "@/types";

/**
 * What campus calls "docente" is the `admin` role on auth-api-be — the campus
 * middleware treats `admin` and `superadmin` as teachers, and profile_type is
 * derived from that, never set directly.
 */
export const TEACHER_ROLE = "admin";

/**
 * The only roles auth-api-be lets the API assign. `superadmin` is deliberately
 * not one of them, so it has to be filtered out of a role set before sending
 * it back or the request is rejected — the server keeps it either way, since
 * it only reconciles the assignable ones.
 */
const ASSIGNABLE_ROLES = ["user", TEACHER_ROLE];

export interface IAuthService {
  login(params: LoginParams): Promise<LoginResponse>;
  register(params: RegisterParams): Promise<RegisterResponse>;
  getByEmail(email: string): Promise<AuthUser>;
  setTeacher(user: AuthUser, teacher: boolean): Promise<AuthUser>;
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

  /**
   * Campus profiles are keyed by the auth username, but the roles endpoint
   * resolves its target by the auth UUID, so a promotion has to look the
   * account up by email first.
   */
  async getByEmail(email: string): Promise<AuthUser> {
    const { data } = await this.api.get("/user/by-email", { params: { email } });
    return data.data;
  }

  /**
   * The endpoint takes the full role set and reconciles it, so this sends the
   * roles the account already has with the teacher one added or dropped.
   */
  async setTeacher(user: AuthUser, teacher: boolean): Promise<AuthUser> {
    const kept = user.roles
      .map((role) => role.name)
      .filter((name) => ASSIGNABLE_ROLES.includes(name) && name !== TEACHER_ROLE);
    const roles = teacher ? [...kept, TEACHER_ROLE] : kept;
    const { data } = await this.api.put(`/user/${user.id}/roles`, { roles });
    return data.data;
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
