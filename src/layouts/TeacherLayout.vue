<script setup lang="ts">
  import { computed, onMounted, ref, watch } from "vue";
  import { RouterLink, useRoute, useRouter } from "vue-router";
  import { useAuthStore } from "@/stores/authStore";
  import { useAuth } from "@/composables/useAuth";
  import { useMessageNotifications } from "@/composables/useMessageNotifications";
  import { useCalendarNotifications } from "@/composables/useCalendarNotifications";

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const { logout } = useAuth();
  const { unreadCount, start: startMessageNotifications } = useMessageNotifications();
  const { start: startCalendarNotifications } = useCalendarNotifications();

  onMounted(() => {
    startMessageNotifications();
    startCalendarNotifications();
  });

  const navOpen = ref(false);

  const profile = computed(() => authStore.profile);
  const userInitial = computed(
    () => profile.value?.full_name?.[0]?.toUpperCase() || "D",
  );

  watch(
    () => route.fullPath,
    () => {
      navOpen.value = false;
    },
  );

  function handleLogout() {
    logout();
    router.push("/login");
  }
</script>

<template>
  <div class="app-shell teacher-shell">
    <header class="mobile-topbar">
      <button
        class="topbar-btn"
        type="button"
        aria-label="Abrir menú de navegación"
        @click="navOpen = true"
      >
        <i class="pi pi-bars"></i>
      </button>
      <div class="topbar-brand">Practiq Campus</div>
      <div class="topbar-avatar">{{ userInitial }}</div>
    </header>

    <div v-if="navOpen" class="drawer-backdrop" @click="navOpen = false"></div>

    <aside class="sidebar" :class="{ 'sidebar--open': navOpen }">
      <div class="sidebar-brand">
        <span class="brand-text">Practiq Campus</span>
        <button class="close-btn" type="button" @click="navOpen = false">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-label">Docente</div>
        <RouterLink
          to="/teacher/dashboard"
          class="nav-item"
          active-class="nav-item-active"
        >
          <span class="nav-icon"><i class="pi pi-home"></i></span>
          <span>Mis cursos</span>
        </RouterLink>
        <RouterLink
          to="/teacher/calendar"
          class="nav-item"
          active-class="nav-item-active"
        >
          <span class="nav-icon"><i class="pi pi-calendar"></i></span>
          <span>Calendario</span>
        </RouterLink>
        <RouterLink
          to="/teacher/messages"
          class="nav-item"
          active-class="nav-item-active"
        >
          <span class="nav-icon"><i class="pi pi-envelope"></i></span>
          <span>Mensajes</span>
          <span v-if="unreadCount" class="nav-badge">{{ unreadCount }}</span>
        </RouterLink>
        <RouterLink to="/teacher/notifications" class="nav-item" active-class="nav-item-active">
          <span class="nav-icon"><i class="pi pi-bell"></i></span>
          <span>Notificaciones</span>
        </RouterLink>
        <RouterLink to="/teacher/grades" class="nav-item" active-class="nav-item-active">
          <span class="nav-icon"><i class="pi pi-chart-bar"></i></span>
          <span>Calificaciones</span>
        </RouterLink>
        <RouterLink to="/teacher/activity" class="nav-item" active-class="nav-item-active"><span class="nav-icon"><i class="pi pi-bolt"></i></span><span>Actividad</span></RouterLink>
        <template v-if="authStore.isSuperAdmin">
          <div class="nav-section-label">Administración</div>
          <RouterLink
            to="/admin/users"
            class="nav-item"
            active-class="nav-item-active"
          >
            <span class="nav-icon"><i class="pi pi-users"></i></span>
            <span>Usuarios</span>
          </RouterLink>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-details">
            <div class="user-name">{{ profile?.full_name || "Docente" }}</div>
            <div class="user-role">Docente</div>
          </div>
        </div>
        <button
          class="icon-btn icon-btn--logout"
          type="button"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          @click="handleLogout"
        >
          <i class="pi pi-sign-out"></i>
        </button>
      </div>
    </aside>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
  .app-shell {
    display: flex;
    min-height: 100vh;
    background: var(--gradient-app-bg);
  }

  .mobile-topbar {
    display: none;
  }

  .drawer-backdrop {
    display: none;
  }

  .sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface-card);
    border-right: 1px solid var(--surface-border);
    padding: var(--space-4);
    gap: var(--space-4);
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--surface-border);
  }

  .brand-text {
    font-weight: 700;
    font-size: var(--text-lg);
    color: var(--text-heading);
  }

  .close-btn {
    display: none;
  }

  .sidebar-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .nav-section-label {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    padding: var(--space-2) var(--space-2) var(--space-1);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: var(--text-sm);
    transition: var(--transition-fast);
  }

  .nav-badge {
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: var(--radius-pill);
    background: var(--color-error);
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: grid;
    place-items: center;
  }

  .nav-item:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .nav-item-active {
    background: var(--fill-primary-soft);
    color: var(--practiq-violet-dark);
  }

  .nav-icon {
    display: grid;
    place-items: center;
    width: 20px;
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--surface-border);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    background: var(--gradient-brand);
    color: var(--color-on-primary);
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: var(--text-sm);
    flex-shrink: 0;
  }

  .user-details {
    min-width: 0;
  }

  .user-name {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-role {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: var(--transition-fast);
  }

  .icon-btn--logout:hover {
    background: var(--color-error-bg);
    color: var(--color-error-dark);
  }

  .main-content {
    flex: 1;
    min-width: 0;
    padding: var(--space-6);
  }

  @media (max-width: 860px) {
    .app-shell {
      display: block;
      min-height: 100vh;
    }

    .mobile-topbar {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .topbar-btn {
      border: none;
      background: transparent;
      font-size: 18px;
      color: var(--text-primary);
    }

    .topbar-brand {
      font-weight: 700;
      color: var(--text-heading);
    }

    .topbar-avatar {
      width: 30px;
      height: 30px;
      border-radius: var(--radius-md);
      background: var(--gradient-brand);
      color: var(--color-on-primary);
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: var(--text-sm);
    }

    .drawer-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: var(--surface-scrim);
      z-index: 29;
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 30;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
      width: min(280px, calc(100vw - 40px));
    }

    .sidebar--open {
      transform: translateX(0);
    }

    .close-btn {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
    }

    .main-content {
      width: 100%;
      box-sizing: border-box;
      padding: var(--space-4);
    }
  }
</style>
