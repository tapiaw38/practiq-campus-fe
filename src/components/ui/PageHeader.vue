<script setup lang="ts">
  /**
   * The eyebrow + title + subtitle + action block that every campus page
   * opened with, re-declared with its own copy of the same CSS in each view.
   * One component keeps the type scale, spacing and the mobile stacking
   * identical everywhere, and gives every page exactly one `h1`.
   */
  defineProps<{
    eyebrow?: string;
    title: string;
    subtitle?: string;
  }>();
</script>

<template>
  <header class="page-header">
    <div class="page-header__text">
      <p v-if="eyebrow" class="page-header__eyebrow">{{ eyebrow }}</p>
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__right">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }

  .page-header__text {
    min-width: 0;
  }

  .page-header__eyebrow {
    margin: 0;
    color: var(--practiq-violet-dark);
    font-size: var(--text-xs);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .page-header__title {
    margin: 3px 0 0;
    color: var(--text-heading);
    font-size: clamp(20px, 3vw, 24px);
    font-weight: 700;
    line-height: 1.2;
  }

  .page-header__subtitle {
    margin: var(--space-1) 0 0;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .page-header__right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  @media (max-width: 600px) {
    .page-header {
      align-items: stretch;
      flex-direction: column;
    }

    .page-header__right {
      width: 100%;
      flex-wrap: wrap;
    }

    .page-header__right > * {
      flex: 1 1 150px;
      min-height: 42px;
    }

    .page-header__right :deep(.p-button) {
      justify-content: center;
      width: 100%;
    }
  }
</style>
