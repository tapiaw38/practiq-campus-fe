<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import StudentLayout from "@/layouts/StudentLayout.vue";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import { useAuthStore } from "@/stores/authStore";
import { useNotifications } from "@/composables/useNotifications";

const auth = useAuthStore();
const isTeacher = computed(() => auth.profile?.profile_type === "teacher");
const role = computed(() => isTeacher.value ? "teacher" : "student");
const { items, loading, load, markAllRead, markRead } = useNotifications(role.value);
onMounted(load);
function icon(kind: string) { return kind === "message" ? "pi-envelope" : kind === "assignment" ? "pi-file-edit" : kind === "grade" ? "pi-star-fill" : "pi-calendar"; }
</script>

<template>
  <component :is="isTeacher ? TeacherLayout : StudentLayout">
    <section class="notifications-page">
      <header>
        <div><p class="eyebrow">Centro de actividad</p><h1>Notificaciones</h1><p>Mensajes, calificaciones, eventos y entregas de los próximos siete días.</p></div>
        <Button label="Marcar todo leído" icon="pi pi-check" outlined :disabled="!items.some((item) => !item.read)" @click="markAllRead" />
      </header>
      <div v-if="loading" class="state">Cargando notificaciones…</div>
      <div v-else-if="!items.length" class="state state--empty"><i class="pi pi-bell"></i><h2>Todo al día</h2><p>No hay mensajes, calificaciones, eventos ni entregas próximas.</p></div>
      <ul v-else class="notification-list">
        <li v-for="item in items" :key="item.id" :class="{ unread: !item.read }">
          <RouterLink :to="item.to" @click="markRead(item.id)"><span class="notice-icon"><i :class="`pi ${icon(item.kind)}`"></i></span><span class="notice-main"><strong>{{ item.title }}</strong><span>{{ item.detail }}</span></span><i class="pi pi-angle-right"></i></RouterLink>
        </li>
      </ul>
    </section>
  </component>
</template>

<style scoped>
.notifications-page{max-width:900px}.notifications-page header{display:flex;justify-content:space-between;align-items:flex-end;gap:var(--space-4);margin-bottom:var(--space-5)}.eyebrow{margin:0;color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800;letter-spacing:.06em;text-transform:uppercase}h1{margin:3px 0 0;color:var(--text-heading);font-size:24px}header p:not(.eyebrow){margin:var(--space-1) 0 0;color:var(--text-secondary);font-size:var(--text-sm)}.notification-list{display:flex;flex-direction:column;gap:var(--space-2);list-style:none;padding:0}.notification-list li{border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.notification-list li.unread{border-left:3px solid var(--practiq-violet-dark)}.notification-list a{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-4);color:inherit}.notice-icon{display:grid;width:38px;height:38px;border-radius:var(--radius-md);place-items:center;background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.notice-main{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.notice-main strong{color:var(--text-heading);font-size:var(--text-sm)}.notice-main span{overflow:hidden;color:var(--text-secondary);font-size:var(--text-xs);text-overflow:ellipsis;white-space:nowrap}.notification-list>li>a>.pi{color:var(--text-muted)}.state{padding:var(--space-6);border-radius:var(--radius-md);background:var(--surface-card);color:var(--text-secondary);text-align:center}.state--empty i{font-size:28px;color:var(--practiq-violet-dark)}.state--empty h2{margin:var(--space-3) 0 var(--space-1);color:var(--text-heading);font-size:var(--text-lg)}.state--empty p{margin:0;font-size:var(--text-sm)}@media(max-width:600px){.notifications-page header{align-items:stretch;flex-direction:column}.notifications-page header :deep(.p-button){justify-content:center}}
</style>
