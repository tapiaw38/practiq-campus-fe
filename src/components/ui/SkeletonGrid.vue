<script setup lang="ts">
  /**
   * Card-grid counterpart to StateMessage's loading rows: the dashboards show
   * courses as cards, so their placeholder has to be card-shaped or the layout
   * jumps the moment the data lands.
   */
  withDefaults(
    defineProps<{
      cards?: number;
      loadingLabel?: string;
    }>(),
    { cards: 3, loadingLabel: "Cargando cursos" },
  );
</script>

<template>
  <div class="skeleton-grid" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">{{ loadingLabel }}</span>
    <div v-for="card in cards" :key="card" class="skeleton-grid__card" aria-hidden="true">
      <span class="skeleton skeleton-grid__icon"></span>
      <span class="skeleton skeleton-grid__line skeleton-grid__line--title"></span>
      <span class="skeleton skeleton-grid__line"></span>
      <span class="skeleton skeleton-grid__line skeleton-grid__line--short"></span>
    </div>
  </div>
</template>

<style scoped>
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-4);
  }

  .skeleton-grid__card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
  }

  .skeleton-grid__icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
  }

  .skeleton-grid__line {
    display: block;
    height: 9px;
    width: 100%;
  }

  .skeleton-grid__line--title {
    width: 65%;
    height: 12px;
  }

  .skeleton-grid__line--short {
    width: 40%;
  }
</style>
