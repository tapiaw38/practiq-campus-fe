// Shape of auth-api-be's own API — the identity microservice shared with
// practiq-fe. Campus never issues or stores credentials itself.
export interface AuthRole {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  auth_method: "password" | "google" | "hybrid";
  roles: AuthRole[];
}

export interface LoginParams {
  email?: string;
  password?: string;
  ssoType?: "google";
  ssoCode?: string;
}

export interface RegisterParams {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  data: AuthUser;
}

export interface RegisterResponse {
  data: AuthUser;
}
