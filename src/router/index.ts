import { createRouter, createWebHistory } from "vue-router";
import { getToken } from "@/api/request/server";

const APP_NAME = "Practiq Campus";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    requiresGuest?: boolean;
    requiresSuperAdmin?: boolean;
    profileType?: "student" | "teacher";
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
  ],
});

router.beforeEach((to, _from, next) => {
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

  next();
});

// Every screen used to leave the tab reading "Practiq Campus", which makes a
// second tab of the same app unidentifiable and gives a screen reader nothing
// to announce on navigation.
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME;
});

export default router;
