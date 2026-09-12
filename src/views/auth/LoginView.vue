<script setup lang="ts">
  import { ref } from "vue";
  import { useRouter } from "vue-router";
  import { useAuth } from "@/composables/useAuth";
  import { useAuthStore } from "@/stores/authStore";
  import { useTenantStore, type CampusTenant } from "@/stores/tenantStore";
  import GoogleButton from "@/components/auth/GoogleButton.vue";
  import PasswordField from "@/components/ui/PasswordField.vue";

  const router = useRouter();
  const { login } = useAuth();
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();

  const email = ref("");
  const password = ref("");
  const submitting = ref(false);

  function destination(profile: Awaited<ReturnType<typeof login>>, tenant?: CampusTenant) {
    if (authStore.isSuperAdmin) return "/admin/institutions";
    if (!tenant) return "/no-institution";
    if (tenant.role === "admin") return "/school/dashboard";
    // School membership is scoped truth for Campus. A shared Practiq account
    // may be a teacher in one institution and a student in another.
    if (tenant.role === "teacher") return "/teacher/dashboard";
    return "/student/dashboard";
  }

  async function goToDashboard(profile: Awaited<ReturnType<typeof login>>) {
    if (authStore.isSuperAdmin) {
      await router.push("/admin/institutions");
      return;
    }
    if (tenantStore.tenants.length > 1 && !tenantStore.selected) {
      await router.push("/choose-institution");
      return;
    }
    await router.push(destination(profile, tenantStore.selected || undefined));
  }

  async function handleSubmit() {
    if (submitting.value) return;
    submitting.value = true;
    try {
      const profile = await login({ email: email.value, password: password.value });
      await goToDashboard(profile);
    } catch {
      // useAuth already surfaced the error via toast
    } finally {
      submitting.value = false;
    }
  }

  async function handleGoogleCode(code: string) {
    try {
      const profile = await login({ ssoType: "google", ssoCode: code });
      await goToDashboard(profile);
    } catch {
      // useAuth already surfaced the error via toast
    }
  }
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-brand"><img src="/logo.png" alt="" class="auth-brand-logo" /> Practiq Campus</div>
      <h1 class="auth-title">Iniciar sesión</h1>
      <p class="auth-subtitle">
        Usá el mismo email y contraseña de tu cuenta Practiq.
      </p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="field">
          <label class="field-label" for="login-email">Email</label>
          <InputText
            id="login-email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            autofocus
          />
        </div>
        <PasswordField
          v-model="password"
          input-id="login-password"
          label="Contraseña"
          autocomplete="current-password"
        />
        <Button
          type="submit"
          label="Entrar"
          :loading="submitting"
          class="submit-btn"
        />
      </form>

      <div class="auth-divider"><span>o</span></div>

      <GoogleButton @code="handleGoogleCode" />

      <p class="auth-switch">
        ¿No tenés cuenta?
        <RouterLink to="/register">Registrate</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
  .auth-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: var(--gradient-auth-bg);
    padding: var(--space-6);
  }

  .auth-card {
    width: 100%;
    max-width: 380px;
    background: var(--surface-card);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-auth-card);
    padding: var(--space-8) var(--space-6);
  }

  .auth-brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--practiq-violet);
    margin-bottom: var(--space-2);
  }

  .auth-brand-logo {
    width: 20px;
    height: 20px;
  }

  .auth-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-1);
  }

  .auth-subtitle {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-6);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-secondary);
  }

  .submit-btn {
    margin-top: var(--space-2);
  }

  .auth-switch {
    margin-top: var(--space-5);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .auth-divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: var(--space-5) 0;
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .auth-divider::before,
  .auth-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(var(--surface-border-rgb), 0.4);
  }
</style>
