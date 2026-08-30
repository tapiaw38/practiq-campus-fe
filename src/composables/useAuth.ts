import { useToast } from "primevue/usetoast";
import { authApi, campusApi } from "@/api/request/server";
import { AuthService } from "@/services/auth/authService";
import { ProfileService } from "@/services/profile/profileService";
import { useAuthStore } from "@/stores/authStore";
import type { LoginParams, RegisterParams } from "@/types";

const authService = new AuthService(authApi);
const profileService = new ProfileService(campusApi);

export function useAuth() {
  const toast = useToast();
  const store = useAuthStore();

  async function login(params: LoginParams) {
    try {
      const { token, data } = await authService.login(params);
      store.storeToken(token);
      store.setAuthUser(data);

      const fullName = `${data.first_name} ${data.last_name}`.trim();
      const { data: profile } = await profileService.sync(fullName, data.email);
      store.setProfile(profile);

      return profile;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo iniciar sesión. Revisá tu email y contraseña.",
        life: 3500,
      });
      throw error;
    }
  }

  async function register(params: RegisterParams) {
    try {
      await authService.register(params);
      return login({ email: params.email, password: params.password });
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear la cuenta.",
        life: 3500,
      });
      throw error;
    }
  }

  async function loadProfile() {
    const { data } = await profileService.getMe();
    store.setProfile(data);
    return data;
  }

  function logout() {
    store.clearAuth();
  }

  return { login, register, loadProfile, logout };
}
