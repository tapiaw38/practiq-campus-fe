<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StudentLayout from "@/layouts/StudentLayout.vue";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useNotifications } from "@/composables/useNotifications";
import { useCampusRole } from "@/composables/useCampusRole";
import { useNotificationBadge } from "@/composables/useNotificationBadge";

// The role held in this institution, not the account-wide profile type: the
// same person can teach at one school and study at another.
const { role, isTeacher } = useCampusRole();
const { items, loading, load, markAllRead, markRead } = useNotifications(role.value);
const { refresh: refreshBadge } = useNotificationBadge();
onMounted(load);
const unreadCount = computed(() => items.value.filter((item) => !item.read).length);
const onlyUnread = ref(false);
const visibleItems = computed(() => (onlyUnread.value ? items.value.filter((item) => !item.read) : items.value));
function icon(kind: string) { return kind === "message" ? "pi-envelope" : kind === "assignment" ? "pi-file-edit" : kind === "grade" ? "pi-star-fill" : "pi-calendar"; }
async function handleMarkAllRead() { await markAllRead(); await refreshBadge(); }
async function handleMarkRead(id: string) { await markRead(id); await refreshBadge(); }

// Today's notifications are read as "when today", older ones as "which day":
// a bare time on a three-day-old row says nothing useful.
function when(createdAt: string) {
  const date = new Date(createdAt);
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("es-AR", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }).format(date);
}
</script>

<template>
  <component :is="isTeacher ? TeacherLayout : StudentLayout">
    <section class="notifications-page">
      <PageHeader
        eyebrow="Últimos 7 días"
        title="Notificaciones"
        subtitle="Mensajes, calificaciones, eventos y entregas."
      >
        <template #actions>
          <Button
            label="Marcar todo leído"
            icon="pi pi-check"
            outlined
            :disabled="!unreadCount"
            @click="handleMarkAllRead"
          />
        </template>
      </PageHeader>

      <StateMessage v-if="loading" variant="loading" loading-label="Cargando notificaciones" :rows="4" />
      <StateMessage
        v-else-if="!items.length"
        icon="pi-bell"
        title="Todo al día"
        description="No hay mensajes, calificaciones, eventos ni entregas próximas."
      />
      <template v-else>
        <div class="unread-bar">
          <span role="status">
            {{ unreadCount ? `Tenés ${unreadCount} ${unreadCount === 1 ? "notificación" : "notificaciones"} sin leer` : `${items.length} notificaciones, todas leídas` }}
          </span>
          <div class="unread-filters">
            <button type="button" :class="{ on: onlyUnread }" :aria-pressed="onlyUnread" @click="onlyUnread = true">Sin leer</button>
            <button type="button" :class="{ on: !onlyUnread }" :aria-pressed="!onlyUnread" @click="onlyUnread = false">Todas</button>
          </div>
        </div>
        <p v-if="!visibleItems.length" class="list-state">No te queda ninguna sin leer.</p>
        <ul v-else class="notification-list">
          <li v-for="item in visibleItems" :key="item.id" :class="{ unread: !item.read }">
            <RouterLink :to="item.to" @click="handleMarkRead(item.id)">
              <span class="notice-icon" :class="`notice-icon--${item.kind}`"><i :class="`pi ${icon(item.kind)}`" aria-hidden="true"></i></span>
              <span class="notice-main">
                <strong>{{ item.title }}</strong>
                <span>{{ item.detail }}</span>
              </span>
              <span v-if="!item.read" class="notice-dot" aria-hidden="true"></span>
              <span v-if="!item.read" class="sr-only">Sin leer</span>
              <time>{{ when(item.createdAt) }}</time>
              <i class="pi pi-angle-right" aria-hidden="true"></i>
            </RouterLink>
          </li>
        </ul>
      </template>
    </section>
  </component>
</template>

<style scoped>
  .notifications-page { max-width: 900px; }

  .unread-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
    padding: var(--space-3) var(--space-5);
    border: 1px solid var(--practiq-violet-200);
    border-radius: var(--radius-lg);
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .unread-filters { display: flex; gap: var(--space-2); }

  .unread-filters button {
    min-height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--practiq-violet-200);
    border-radius: var(--radius-pill);
    background: var(--surface-card);
    color: var(--practiq-violet-dark);
    font-family: var(--font-body-family);
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }

  .unread-filters button.on {
    border-color: transparent;
    background: var(--practiq-violet);
    color: var(--color-on-primary);
  }

  .list-state { margin: 0; padding: var(--space-6) 0; color: var(--text-secondary); font-size: var(--text-sm); }

  .notification-list { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
  .notification-list li { border: 1px solid var(--surface-border); border-radius: var(--radius-lg); background: var(--surface-card); }
  .notification-list li.unread { border-color: var(--practiq-violet-200); background: var(--practiq-violet-50); }
  .notification-list a { display: flex; align-items: center; gap: var(--space-3); min-height: 44px; padding: var(--space-4) var(--space-5); border-radius: var(--radius-lg); color: inherit; transition: var(--transition-fast); }
  .notification-list a:hover { background: var(--surface-hover); }

  .notice-icon { display: grid; width: 38px; height: 38px; flex: 0 0 38px; place-items: center; border-radius: 11px; background: var(--practiq-violet-pale); color: var(--practiq-violet-dark); }
  .notice-icon--assignment { background: var(--color-warning-bg); color: var(--color-warning-dark); }
  .notice-icon--grade { background: var(--color-success-bg); color: var(--color-success-dark); }

  .notice-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
  .notice-main strong { color: var(--text-heading); font-size: var(--text-md); }
  .notice-main span { overflow: hidden; color: var(--text-secondary); font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }

  .notice-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: var(--color-error); }
  .notification-list time { flex-shrink: 0; color: var(--text-muted); font-size: var(--text-xs); }
  .notification-list > li > a > .pi { color: var(--text-muted); }
</style>
