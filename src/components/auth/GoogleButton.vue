<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import type {
    GoogleButtonEmits,
    GoogleClient,
    GoogleResponse,
  } from "./GoogleButton.types";

  const emit = defineEmits<GoogleButtonEmits>();

  declare global {
    interface Window {
      google?: {
        accounts?: {
          oauth2?: {
            initCodeClient: (config: {
              client_id: string;
              scope: string;
              ux_mode: string;
              callback: (response: GoogleResponse) => void;
            }) => GoogleClient;
          };
        };
      };
    }
  }

  const googleClient = ref<GoogleClient | null>(null);
  const isLoading = ref(false);

  onMounted(() => {
    const google = window.google;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || !google?.accounts?.oauth2) return;

    googleClient.value = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: "openid email profile",
      ux_mode: "popup",
      callback: (response: GoogleResponse) => {
        isLoading.value = false;
        emit("code", response.code);
      },
    });
  });

  function loginWithGoogle() {
    if (!googleClient.value) return;
    isLoading.value = true;
    googleClient.value.requestCode();
  }
</script>

<template>
  <button
    type="button"
    class="google-button"
    :disabled="isLoading || !googleClient"
    @click="loginWithGoogle"
  >
    <svg
      class="google-icon"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
    <span>{{ isLoading ? "Conectando..." : "Continuar con Google" }}</span>
  </button>
</template>

<style scoped>
  .google-button {
    width: 100%;
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 0 16px;
    border-radius: var(--radius-xl);
    border: 1px solid rgba(var(--surface-border-rgb), 0.18);
    background: rgba(var(--surface-card-rgb), 0.82);
    color: var(--text-heading);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    box-shadow: var(--shadow-card);
  }

  .google-button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(var(--practiq-violet-rgb), 0.18);
    box-shadow: var(--shadow-card-lg);
  }

  .google-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .google-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
</style>
