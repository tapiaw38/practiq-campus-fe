import { createRouter, createWebHistory } from "vue-router";
import { getToken } from "@/api/request/server";
import { useTenantStore } from "@/stores/tenantStore";

const APP_NAME = "Practiq Campus";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    requiresGuest?: boolean;
    requiresSuperAdmin?: boolean;
    profileType?: "student" | "teacher";
    /**
     * Set on the few screens that work without an institution selected: the
     * ones that let somebody sign in, discover which institutions they belong
     * to, or be told they belong to none.
     */
    allowsNoTenant?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: () => {
        if (!getToken()) return "/login";
        try {
          const profileStr = localStorage.getItem("campus_profile");
          if (profileStr) {
            const profile = JSON.parse(profileStr);
            if (profile.profile_type === "teacher") return "/teacher/dashboard";
          }
        } catch {
          // fall through to the student dashboard
        }
        return "/student/dashboard";
      },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/auth/LoginView.vue"),
      meta: { title: "Iniciar sesión", requiresGuest: true },
    },
    {
      path: "/register",
      name: "register",
      component: () => import("@/views/auth/RegisterView.vue"),
      meta: { title: "Crear cuenta", requiresGuest: true },
    },
    {
      path: "/no-institution",
      name: "no-institution",
      component: () => import("@/views/NoInstitutionView.vue"),
      meta: { title: "Sin institución", requiresAuth: true, allowsNoTenant: true },
    },
    {
      path: "/student/dashboard",
      name: "student-dashboard",
      component: () => import("@/views/student/DashboardView.vue"),
      meta: { title: "Mis cursos", requiresAuth: true, profileType: "student" },
    },
    {
      path: "/student/courses/:id",
      name: "student-course-detail",
      component: () => import("@/views/student/CourseDetailView.vue"),
      meta: { title: "Curso", requiresAuth: true, profileType: "student" },
    },
    {
      path: "/student/courses/:courseId/forum/:threadId",
      name: "student-forum-thread",
      component: () => import("@/views/student/ForumThreadView.vue"),
      meta: { title: "Foro", requiresAuth: true, profileType: "student" },
    },
    {
      path: "/student/calendar",
      name: "student-calendar",
      component: () => import("@/views/student/CalendarView.vue"),
      meta: { title: "Calendario", requiresAuth: true, profileType: "student" },
    },
    {
      path: "/student/explore",
      name: "student-explore",
      component: () => import("@/views/student/ExploreCoursesView.vue"),
      meta: { title: "Explorar cursos", requiresAuth: true, profileType: "student" },
    },
    {
      path: "/student/messages",
      name: "student-messages",
      component: () => import("@/views/student/MessagesView.vue"),
      meta: { title: "Mensajes", requiresAuth: true, profileType: "student" },
    },
    {
      path: "/student/notifications",
      name: "student-notifications",
      component: () => import("@/views/NotificationsView.vue"),
      meta: { title: "Notificaciones", requiresAuth: true, profileType: "student" },
    },
    {
      path: "/student/grades",
      name: "student-grades",
      component: () => import("@/views/GradesView.vue"),
      meta: { title: "Mis calificaciones", requiresAuth: true, profileType: "student" },
    },
    { path: "/student/activity", name: "student-activity", component: () => import("@/views/ActivityView.vue"), meta: { title: "Actividad", requiresAuth: true, profileType: "student" } },
    {
      path: "/teacher/dashboard",
      name: "teacher-dashboard",
      component: () => import("@/views/teacher/DashboardView.vue"),
      meta: { title: "Mis cursos", requiresAuth: true, profileType: "teacher" },
    },
    {
      path: "/teacher/courses/:id",
      name: "teacher-course-detail",
      component: () => import("@/views/teacher/CourseDetailView.vue"),
      meta: { title: "Curso", requiresAuth: true, profileType: "teacher" },
    },
    { path: "/teacher/courses/:courseId/assignments/:assignmentId/submissions", name: "teacher-assignment-submissions", component: () => import("@/views/teacher/AssignmentSubmissionsView.vue"), meta: { title: "Entregas", requiresAuth: true, profileType: "teacher" } },
    {
      path: "/teacher/courses/:courseId/forum/:threadId",
      name: "teacher-forum-thread",
      component: () => import("@/views/student/ForumThreadView.vue"),
      meta: { title: "Foro", requiresAuth: true, profileType: "teacher" },
    },
    {
      path: "/teacher/calendar",
      name: "teacher-calendar",
      component: () => import("@/views/teacher/CalendarView.vue"),
      meta: { title: "Calendario", requiresAuth: true, profileType: "teacher" },
    },
    {
      path: "/teacher/messages",
      name: "teacher-messages",
      component: () => import("@/views/teacher/MessagesView.vue"),
      meta: { title: "Mensajes", requiresAuth: true, profileType: "teacher" },
    },
    {
      path: "/teacher/notifications",
      name: "teacher-notifications",
      component: () => import("@/views/NotificationsView.vue"),
      meta: { title: "Notificaciones", requiresAuth: true, profileType: "teacher" },
    },
    {
      path: "/teacher/grades",
      name: "teacher-grades",
      component: () => import("@/views/GradesView.vue"),
      meta: { title: "Calificaciones", requiresAuth: true, profileType: "teacher" },
    },
    { path: "/teacher/activity", name: "teacher-activity", component: () => import("@/views/ActivityView.vue"), meta: { title: "Actividad", requiresAuth: true, profileType: "teacher" } },
    {
      path: "/admin/users",
      name: "admin-users",
      component: () => import("@/views/admin/UsersView.vue"),
      meta: { title: "Usuarios", requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      // Enabling Campus for an institution is what creates a tenant, so this
      // screen is reachable without one selected.
      path: "/admin/institutions",
      name: "admin-institutions",
      component: () => import("@/views/admin/InstitutionsView.vue"),
      meta: {
        title: "Instituciones",
        requiresAuth: true,
        requiresSuperAdmin: true,
        allowsNoTenant: true,
      },
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const isAuthenticated = !!getToken();

  if (to.meta.requiresAuth && !isAuthenticated) {
    next("/login");
    return;
  }

  if (to.meta.requiresGuest && isAuthenticated) {
    next("/");
    return;
  }

  if (to.meta.requiresAuth && to.meta.requiresSuperAdmin) {
    try {
      const authUserStr = localStorage.getItem("campus_auth_user");
      const authUser = authUserStr ? JSON.parse(authUserStr) : null;
      const isSuperAdmin = !!authUser?.roles?.some(
        (role: { name: string }) => role.name === "superadmin",
      );
      if (!isSuperAdmin) {
        next("/");
        return;
      }
    } catch {
      next("/");
      return;
    }
  }

  if (to.meta.requiresAuth && to.meta.profileType) {
    try {
      const profileStr = localStorage.getItem("campus_profile");
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        if (profile.profile_type !== to.meta.profileType) {
          next(
            profile.profile_type === "teacher"
              ? "/teacher/dashboard"
              : "/student/dashboard",
          );
          return;
        }
      }
    } catch {
      // an unreadable profile is treated as "no profile yet" below
    }
  }

  // Campus only exists inside an institution, so every product screen needs
  // one selected. The check runs last: it costs a request on a cold load, and
  // there is no reason to pay it for somebody who is being sent to the login
  // screen anyway.
  if (to.meta.requiresAuth && !to.meta.allowsNoTenant && !to.meta.requiresSuperAdmin) {
    const tenants = useTenantStore();
    if (!tenants.tenants.length) {
      try {
        await tenants.load();
      } catch {
        // Unreachable API is not "no institutions": sending somebody to the
        // empty-state screen over a network blip would tell them they lost
        // access they still have.
        next();
        return;
      }
    }
    if (!tenants.selected) {
      next("/no-institution");
      return;
    }
  }

  next();
});

// Every screen used to leave the tab reading "Practiq Campus", which makes a
// second tab of the same app unidentifiable and gives a screen reader nothing
// to announce on navigation.
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME;
});

export default router;
