<script setup lang="ts">
  import TenantSwitcher from "@/components/TenantSwitcher.vue";
  import { computed, onMounted, ref } from "vue";
  import { RouterLink, useRouter } from "vue-router";
  import { useAuthStore } from "@/stores/authStore";
  import { useAuth } from "@/composables/useAuth";
  import { useNavDrawer } from "@/composables/useNavDrawer";
  import { useMessageNotifications } from "@/composables/useMessageNotifications";
  import { useCalendarNotifications } from "@/composables/useCalendarNotifications";

  const router = useRouter();
  const authStore = useAuthStore();
  const { logout } = useAuth();
  const { unreadCount, start: startMessageNotifications } = useMessageNotifications();
  const { start: startCalendarNotifications } = useCalendarNotifications();

  onMounted(() => {
    startMessageNotifications();
    startCalendarNotifications();
  });

  const navToggle = ref<HTMLElement | null>(null);
  const navPanel = ref<HTMLElement | null>(null);
  const { open: navOpen, close: closeNav } = useNavDrawer({
    toggle: navToggle,
    panel: navPanel,
  });

  const profile = computed(() => authStore.profile);
  const userInitial = computed(
    () => profile.value?.full_name?.[0]?.toUpperCase() || "A",
  );

  // A bare number in the sidebar reads as "3" to a screen reader with no hint
  // of what three of anything means.
  const unreadLabel = computed(() =>
    unreadCount.value === 1
      ? "1 mensaje sin leer"
      : `${unreadCount.value} mensajes sin leer`,
  );

  function handleLogout() {
    logout();
    router.push("/login");
  }
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Ir al contenido principal</a>

    <header class="mobile-topbar">
      <button
        ref="navToggle"
        class="topbar-btn"
        type="button"
        aria-label="Abrir menú de navegación"
        aria-controls="campus-nav"
        :aria-expanded="navOpen"
        @click="navOpen = true"
      >
        <i class="pi pi-bars" aria-hidden="true"></i>
      </button>
      <div class="topbar-brand"><img src="/logo.png" alt="" class="brand-logo" /> Practiq Campus</div>
      <div class="topbar-avatar" aria-hidden="true">{{ userInitial }}</div>
    </header>

    <button
      v-if="navOpen"
      class="drawer-backdrop"
      type="button"
      tabindex="-1"
      aria-label="Cerrar menú de navegación"
      @click="closeNav()"
    ></button>

    <aside
      id="campus-nav"
      ref="navPanel"
      class="sidebar"
      :class="{ 'sidebar--open': navOpen }"
      tabindex="-1"
    >
      <div class="sidebar-brand">
        <span class="brand-text"><img src="/logo.png" alt="" class="brand-logo" /> Practiq Campus</span>
        <button
          class="close-btn"
          type="button"
          aria-label="Cerrar menú de navegación"
          @click="closeNav()"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>

      <TenantSwitcher />

      <nav class="sidebar-nav" aria-label="Navegación principal">
        <div class="nav-section-label">Estudiante</div>
        <RouterLink
          to="/student/dashboard"
          class="nav-item"
          active-class="nav-item-active"
        >
          <span class="nav-icon"><i class="pi pi-home" aria-hidden="true"></i></span>
          <span>Mis cursos</span>
        </RouterLink>
        <RouterLink
          to="/student/calendar"
          class="nav-item"
          active-class="nav-item-active"
        >
          <span class="nav-icon"><i class="pi pi-calendar" aria-hidden="true"></i></span>
          <span>Calendario</span>
        </RouterLink>
        <RouterLink to="/student/explore" class="nav-item" active-class="nav-item-active">
          <span class="nav-icon"><i class="pi pi-compass" aria-hidden="true"></i></span>
          <span>Explorar cursos</span>
        </RouterLink>
        <RouterLink
          to="/student/messages"
          class="nav-item"
          active-class="nav-item-active"
        >
          <span class="nav-icon"><i class="pi pi-envelope" aria-hidden="true"></i></span>
          <span>Mensajes</span>
          <span v-if="unreadCount" class="nav-badge" aria-hidden="true">{{ unreadCount }}</span>
          <span v-if="unreadCount" class="sr-only">{{ unreadLabel }}</span>
        </RouterLink>
        <RouterLink to="/student/notifications" class="nav-item" active-class="nav-item-active">
          <span class="nav-icon"><i class="pi pi-bell" aria-hidden="true"></i></span>
          <span>Notificaciones</span>
        </RouterLink>
        <RouterLink to="/student/grades" class="nav-item" active-class="nav-item-active">
          <span class="nav-icon"><i class="pi pi-chart-bar" aria-hidden="true"></i></span>
          <span>Calificaciones</span>
        </RouterLink>
        <RouterLink to="/student/activity" class="nav-item" active-class="nav-item-active"><span class="nav-icon"><i class="pi pi-bolt" aria-hidden="true"></i></span><span>Actividad</span></RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-details">
            <div class="user-name">{{ profile?.full_name || "Alumno" }}</div>
            <div class="user-role">Estudiante</div>
          </div>
        </div>
        <button
          class="icon-btn icon-btn--logout"
          type="button"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          @click="handleLogout"
        >
          <i class="pi pi-sign-out" aria-hidden="true"></i>
        </button>
      </div>
    </aside>

    <main id="main-content" class="main-content" tabindex="-1">
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
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--surface-border);
  }

  .brand-text {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 700;
    font-size: var(--text-lg);
    color: var(--text-heading);
  }

  .brand-logo {
    width: 24px;
    height: 24px;
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
    color: var(--color-on-primary);
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
      z-index: var(--z-topbar);
    }

    .topbar-btn {
      display: grid;
      /* 44px is the smallest target a thumb hits reliably; the icon alone was
         about 18. */
      width: 44px;
      height: 44px;
      margin-left: calc(var(--space-3) * -1);
      border: none;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text-primary);
      cursor: pointer;
      font-size: 18px;
      place-items: center;
    }

    .topbar-brand {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-weight: 700;
      color: var(--text-heading);
    }

    .topbar-brand .brand-logo {
      width: 20px;
      height: 20px;
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
      padding: 0;
      border: none;
      background: var(--surface-scrim);
      z-index: var(--z-drawer-backdrop);
      cursor: pointer;
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: var(--z-drawer);
      transform: translateX(-100%);
      /* Hidden, not just slid away: a translated drawer still holds every one
         of its links in the tab order behind the backdrop. Visibility flips
         instantly on open (so the panel can take focus right away) and only
         waits for the slide-out on close. */
      visibility: hidden;
      transition: transform 0.2s ease, visibility 0s linear 0.2s;
      width: min(280px, calc(100vw - 40px));
      overflow-y: auto;
    }

    .sidebar--open {
      transform: translateX(0);
      visibility: visible;
      transition: transform 0.2s ease, visibility 0s;
    }

    .sidebar:focus {
      outline: none;
    }

    .close-btn {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      margin-right: calc(var(--space-2) * -1);
      border: none;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
    }

    .nav-item {
      min-height: 44px;
    }

    .main-content {
      width: 100%;
      box-sizing: border-box;
      padding: var(--space-4);
    }
  }
</style>
