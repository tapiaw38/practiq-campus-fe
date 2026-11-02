<script setup lang="ts">
  import { computed } from "vue";
  import type { Props, Emits } from "./Pagination.types";

  const props = defineProps<Props>();

  const emit = defineEmits<Emits>();

  const range = computed(() => {
    if (props.total == null || props.perPage == null) return "";
    const first = (props.page - 1) * props.perPage + 1;
    const last = Math.min(props.page * props.perPage, props.total);
    return `${first}–${last} de ${props.total}${props.itemLabel ? ` ${props.itemLabel}` : ""}`;
  });

  function go(page: number) {
    if (page < 1 || page > props.totalPages || page === props.page) return;
    emit("update:page", page);
  }
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination" aria-label="Paginación">
    <span v-if="range" class="pagination__range">{{ range }}</span>
    <div class="pagination__controls">
      <Button
        icon="pi pi-chevron-left"
        text
        rounded
        size="small"
        aria-label="Página anterior"
        :disabled="page <= 1"
        @click="go(page - 1)"
      />
      <span class="pagination__page" role="status" aria-live="polite">
        Página {{ page }} de {{ totalPages }}
      </span>
      <Button
        icon="pi pi-chevron-right"
        text
        rounded
        size="small"
        aria-label="Página siguiente"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      />
    </div>
  </nav>
</template>

<style scoped>
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--surface-border);
  }

  .pagination__range {
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .pagination__controls {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-left: auto;
  }

  .pagination__page {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: 700;
    white-space: nowrap;
  }

  @media (max-width: 520px) {
    .pagination {
      flex-direction: column;
      align-items: stretch;
    }

    .pagination__controls {
      justify-content: space-between;
      margin-left: 0;
    }
  }
</style>
