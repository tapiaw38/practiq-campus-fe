<script setup lang="ts">
  import { ref } from "vue";
  import { useRouter } from "vue-router";
  import { useAuth } from "@/composables/useAuth";

  const router = useRouter();
  const { register } = useAuth();

  const firstName = ref("");
  const lastName = ref("");
  const email = ref("");
  const password = ref("");
  const submitting = ref(false);

  async function handleSubmit() {
    if (submitting.value) return;
    submitting.value = true;
    try {
      // auth-api-be assigns the default "user" role on registration; a
      // teacher account is promoted by a superadmin afterward, same as
      // practiq-fe. There is no profile_type choice at signup.
      const profile = await register({
        first_name: firstName.value,
        last_name: lastName.value,
        email: email.value,
        password: password.value,
      });
      router.push(
        profile.profile_type === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
      );
    } catch {
      // useAuth already surfaced the error via toast
    } finally {
      submitting.value = false;
    }
  }
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-brand">Practiq Campus</div>
      <h1 class="auth-title">Crear cuenta</h1>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Nombre</span>
            <InputText v-model="firstName" required />
          </label>
          <label class="field">
            <span class="field-label">Apellido</span>
            <InputText v-model="lastName" required />
          </label>
        </div>
        <label class="field">
          <span class="field-label">Email</span>
          <InputText v-model="email" type="email" required autocomplete="email" />
        </label>
        <label class="field">
          <span class="field-label">Contraseña</span>
          <InputText
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
          />
        </label>
        <Button
          type="submit"
          label="Crear cuenta"
          :loading="submitting"
          class="submit-btn"
        />
      </form>

      <p class="auth-switch">
        ¿Ya tenés cuenta?
        <RouterLink to="/login">Iniciá sesión</RouterLink>
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
    max-width: 420px;
    background: var(--surface-card);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-auth-card);
    padding: var(--space-8) var(--space-6);
  }

  .auth-brand {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--practiq-violet);
    margin-bottom: var(--space-2);
  }

  .auth-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-6);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
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
</style>
