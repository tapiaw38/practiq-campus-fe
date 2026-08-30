<script setup lang="ts">
  /**
   * Loading / empty / error states were written by hand in a dozen views: some
   * a bare sentence, some a card with an icon, none of them announced to a
   * screen reader. This is the one shape for all three.
   *
   * `loading` renders skeleton rows rather than the word "Cargando", because a
   * placeholder in the shape of the list tells you what is coming; a sentence
   * only tells you that nothing is here yet.
   */
  withDefaults(
    defineProps<{
      variant?: "loading" | "empty" | "error";
      /** Announced to assistive tech while `variant` is `loading`. */
      loadingLabel?: string;
      icon?: string;
      title?: string;
      description?: string;
      /** Skeleton rows drawn while loading; match the list being replaced. */
      rows?: number;
      /** Compact form for states nested inside a card or a dashboard panel. */
      dense?: boolean;
    }>(),
    {
      variant: "empty",
      loadingLabel: "Cargando contenido",
      rows: 3,
      dense: false,
    },
  );
</script>

<template>
  <div
    v-if="variant === 'loading'"
    class="state-skeleton"
    :class="{ 'state-skeleton--dense': dense }"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <span class="sr-only">{{ loadingLabel }}</span>
    <div v-for="row in rows" :key="row" class="state-skeleton__row" aria-hidden="true">
      <span class="skeleton state-skeleton__avatar"></span>
      <span class="state-skeleton__lines">
        <span class="skeleton state-skeleton__line state-skeleton__line--title"></span>
        <span class="skeleton state-skeleton__line"></span>
      </span>
    </div>
  </div>

  <div
    v-else
    class="state-message"
    :class="[`state-message--${variant}`, { 'state-message--dense': dense }]"
    :role="variant === 'error' ? 'alert' : 'status'"
  >
    <i v-if="icon" class="state-message__icon" :class="`pi ${icon}`" aria-hidden="true"></i>
    <p v-if="title" class="state-message__title">{{ title }}</p>
    <p v-if="description" class="state-message__description">{{ description }}</p>
    <slot />
    <div v-if="$slots.action" class="state-message__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
  .state-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .state-skeleton__row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
  }

  .state-skeleton--dense .state-skeleton__row {
    padding: var(--space-3);
    border: none;
    background: transparent;
  }

  .state-skeleton__avatar {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: var(--radius-md);
  }

  .state-skeleton__lines {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: var(--space-2);
  }

  .state-skeleton__line {
    display: block;
    height: 9px;
    width: 100%;
  }

  .state-skeleton__line--title {
    width: 42%;
    height: 11px;
  }

  .state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-8) var(--space-6);
    border: 1px dashed var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    text-align: center;
  }

  .state-message--dense {
    padding: var(--space-5) var(--space-4);
  }

  .state-message--error {
    border-style: solid;
    border-color: rgba(var(--color-error-rgb), 0.35);
    background: var(--color-error-bg);
  }

  .state-message__icon {
    margin-bottom: var(--space-2);
    color: var(--practiq-violet-dark);
    font-size: 26px;
  }

  .state-message--error .state-message__icon {
    color: var(--color-error-dark);
  }

  .state-message__title {
    margin: 0;
    color: var(--text-heading);
    font-size: var(--text-lg);
    font-weight: 700;
  }

  .state-message--error .state-message__title {
    color: var(--color-error-dark);
  }

  .state-message__description {
    max-width: 44ch;
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .state-message__action {
    margin-top: var(--space-3);
  }
</style>
