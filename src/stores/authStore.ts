import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { AuthUser, Profile } from "@/types";
import { getToken, setToken, removeToken } from "@/api/request/server";

const PROFILE_KEY = "campus_profile";
const AUTH_USER_KEY = "campus_auth_user";

function getStoredProfile(): Profile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    localStorage.removeItem(PROFILE_KEY);
    return null;
  }
}

function getStoredAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export const useAuthStore = defineStore("campus-auth", () => {
  const token = ref<string | null>(getToken());
  const profile = ref<Profile | null>(getStoredProfile());
  const authUser = ref<AuthUser | null>(getStoredAuthUser());

  const isAuthenticated = computed(() => !!token.value);
  const isTeacher = computed(() => profile.value?.profile_type === "teacher");
  const isStudent = computed(() => profile.value?.profile_type === "student");
  const isSuperAdmin = computed(
    () => authUser.value?.roles?.some((role) => role.name === "superadmin") ?? false,
  );

  function storeToken(value: string) {
    token.value = value;
    setToken(value);
  }

  function setProfile(value: Profile) {
    profile.value = value;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(value));
  }

  function setAuthUser(value: AuthUser) {
    authUser.value = value;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(value));
  }

  function clearAuth() {
    token.value = null;
    profile.value = null;
    authUser.value = null;
    removeToken();
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  return {
    token,
    profile,
    authUser,
    isAuthenticated,
    isTeacher,
    isStudent,
    isSuperAdmin,
    storeToken,
    setProfile,
    setAuthUser,
    clearAuth,
  };
});
