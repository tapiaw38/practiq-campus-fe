<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import StudentLayout from "@/layouts/StudentLayout.vue";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useAuthStore } from "@/stores/authStore";
import { useNotifications } from "@/composables/useNotifications";

const auth = useAuthStore();
const isTeacher = computed(() => auth.profile?.profile_type === "teacher");
const role = computed(() => isTeacher.value ? "teacher" : "student");
const { items, loading, load, markAllRead, markRead } = useNotifications(role.value);
onMounted(load);
const unreadCount = computed(() => items.value.filter((item) => !item.read).length);
function icon(kind: string) { return kind === "message" ? "pi-envelope" : kind === "assignment" ? "pi-file-edit" : kind === "grade" ? "pi-star-fill" : "pi-calendar"; }
</script>

<template>
  <component :is="isTeacher ? TeacherLayout : StudentLayout">
    <section class="notifications-page">
      <PageHeader
        eyebrow="Centro de actividad"
        title="Notificaciones"
        subtitle="Mensajes, calificaciones, eventos y entregas de los próximos siete días."
      >
        <template #actions>
          <Button
            label="Marcar todo leído"
            icon="pi pi-check"
            outlined
            :disabled="!unreadCount"
            @click="markAllRead"
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
        <p class="unread-summary" role="status">
          {{ unreadCount ? `${unreadCount} sin leer de ${items.length}` : `${items.length} notificaciones, todas leídas` }}
        </p>
        <ul class="notification-list">
          <li v-for="item in items" :key="item.id" :class="{ unread: !item.read }">
            <RouterLink :to="item.to" @click="markRead(item.id)">
              <span class="notice-icon"><i :class="`pi ${icon(item.kind)}`" aria-hidden="true"></i></span>
              <span class="notice-main">
                <strong>{{ item.title }}</strong>
                <span>{{ item.detail }}</span>
              </span>
              <span v-if="!item.read" class="sr-only">Sin leer</span>
              <i class="pi pi-angle-right" aria-hidden="true"></i>
            </RouterLink>
          </li>
        </ul>
      </template>
    </section>
  </component>
</template>

<style scoped>
.notifications-page{max-width:900px}.unread-summary{margin:0 0 var(--space-3);color:var(--text-secondary);font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.06em}.notification-list{display:flex;flex-direction:column;gap:var(--space-2);list-style:none;padding:0}.notification-list li{border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.notification-list li.unread{border-left:3px solid var(--practiq-violet-dark)}.notification-list li.unread .notice-main strong{color:var(--practiq-violet-dark)}.notification-list a{display:flex;align-items:center;gap:var(--space-3);min-height:44px;padding:var(--space-4);border-radius:var(--radius-md);color:inherit;transition:var(--transition-fast)}.notification-list a:hover{background:var(--surface-hover)}.notice-icon{display:grid;width:38px;height:38px;border-radius:var(--radius-md);place-items:center;background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.notice-main{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.notice-main strong{color:var(--text-heading);font-size:var(--text-sm)}.notice-main span{overflow:hidden;color:var(--text-secondary);font-size:var(--text-xs);text-overflow:ellipsis;white-space:nowrap}.notification-list>li>a>.pi{color:var(--text-muted)}
</style>
