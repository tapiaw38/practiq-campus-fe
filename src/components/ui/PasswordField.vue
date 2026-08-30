<script setup lang="ts">
  import { ref } from "vue";

  /**
   * A password input you can read back. Both auth forms used a bare
   * `type="password"`, so a typo was only discoverable by failing to log in —
   * the single most common reason a sign-in attempt fails.
   */
  withDefaults(
    defineProps<{
      label: string;
      autocomplete: string;
      inputId: string;
      hint?: string;
      minlength?: number;
    }>(),
    {},
  );

  const model = defineModel<string>({ required: true });
  const visible = ref(false);
</script>

<template>
  <div class="field">
    <label class="field-label" :for="inputId">{{ label }}</label>
    <div class="password-input">
      <InputText
        :id="inputId"
        v-model="model"
        :type="visible ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :minlength="minlength"
        :aria-describedby="hint ? `${inputId}-hint` : undefined"
        required
      />
      <button
        type="button"
        class="password-toggle"
        :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <i :class="visible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i>
      </button>
    </div>
    <small v-if="hint" :id="`${inputId}-hint`" class="field-hint">{{ hint }}</small>
  </div>
</template>

<style scoped>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .password-input {
    position: relative;
    display: flex;
  }

  .password-input :deep(.p-inputtext) {
    width: 100%;
    /* Room for the toggle, so a long password never runs under the icon. */
    padding-right: 40px;
  }

  .password-toggle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    display: grid;
    width: 40px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    place-items: center;
  }

  .password-toggle:hover {
    color: var(--text-primary);
  }

  .field-hint {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }
</style>
