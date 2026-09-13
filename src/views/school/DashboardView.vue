<script setup lang="ts">
  import { computed, onMounted, ref } from "vue";
  import { useRouter } from "vue-router";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import { authApi, campusApi } from "@/api/request/server";
  import { SchoolService, type SchoolMember } from "@/services/school/schoolService";
  import { useAuthStore } from "@/stores/authStore";
  import { useTenantStore } from "@/stores/tenantStore";
  import type { AuthUser } from "@/types";

  const router = useRouter();
  const authStore = useAuthStore();
  const tenantStore = useTenantStore();
  const service = new SchoolService(campusApi);
  const members = ref<SchoolMember[]>([]);
  const loading = ref(true);
  const error = ref("");
  const adding = ref(false);
  const userID = ref("");
  const userQuery = ref("");
  const matches = ref<AuthUser[]>([]);
  const role = ref<SchoolMember["role"]>("student");

  // Searching by email/name needs auth-api-be's user list, which it only
  // serves to a superadmin — same boundary practiq-fe runs into, so a
  // non-superadmin institution admin keeps the exact-username field below.
  async function searchUsers() {
    userID.value = "";
    const query = userQuery.value.trim().toLowerCase();
    if (!authStore.isSuperAdmin || query.length < 2) { matches.value = []; return; }
    try {
      const { data } = await authApi.get<{ data: AuthUser[] }>("/user/list", { params: { limit: 100 } });
      matches.value = data.data.filter((user) =>
        [user.username, user.first_name, user.last_name, user.email].join(" ").toLowerCase().includes(query),
      ).slice(0, 8);
    } catch { matches.value = []; }
  }

  function selectUser(user: AuthUser) {
    userID.value = user.username || user.id;
    userQuery.value = user.email || `${user.first_name} ${user.last_name}`.trim();
    matches.value = [];
  }

  function clearMatchesSoon() { window.setTimeout(() => { matches.value = []; }, 150); }

  const activeMembers = computed(() => members.value.filter((member) => member.active));
  const count = (value: SchoolMember["role"]) => activeMembers.value.filter((member) => member.role === value).length;
  const roleLabel: Record<SchoolMember["role"], string> = { admin: "Administrador", teacher: "Docente", student: "Alumno" };

  function reason(e: unknown, fallback: string) {
    const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    return message ? message : fallback;
  }

  async function load() {
    loading.value = true;
    error.value = "";
    try { members.value = await service.members(); }
    catch (e) { error.value = reason(e, "No se pudieron cargar las personas de esta institución."); }
    finally { loading.value = false; }
  }

  async function add() {
    const id = userID.value.trim();
    if (!id || adding.value) return;
    adding.value = true;
    error.value = "";
    try { await service.addMember(id, role.value); userID.value = ""; userQuery.value = ""; await load(); }
    catch (e) { error.value = reason(e, "No se pudo agregar. Verificá que esta persona ya tenga perfil en Practiq."); }
    finally { adding.value = false; }
  }

  async function remove(member: SchoolMember) {
    if (!window.confirm(`¿Quitar a ${member.name} de ${tenantStore.selected?.name || "esta institución"}?`)) return;
    error.value = "";
    try { await service.removeMember(member.user_id); await load(); }
    catch (e) { error.value = reason(e, "No se pudo quitar esta persona."); }
  }

  onMounted(load);
</script>

<template>
  <TeacherLayout>
    <div class="school-admin">
      <header class="head">
        <div>
          <span class="eyebrow">Administración de institución</span>
          <h1>{{ tenantStore.selected?.name || "Institución" }}</h1>
          <p>Organizá las personas y el trabajo de Campus en un solo espacio.</p>
        </div>
        <button type="button" class="course-button" @click="router.push('/teacher/dashboard')"><i class="pi pi-book"></i> Gestionar cursos</button>
      </header>

      <section class="stats" aria-label="Resumen de personas">
        <div><strong>{{ activeMembers.length }}</strong><span>personas activas</span></div>
        <div><strong>{{ count('teacher') }}</strong><span>docentes</span></div>
        <div><strong>{{ count('student') }}</strong><span>alumnos</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>Personas</h2><p>Los permisos y membresías se guardan en Practiq.</p></div></div>
        <form class="add" @submit.prevent="add">
          <label class="search-field">
            <span>{{ authStore.isSuperAdmin ? "Buscar persona" : "Usuario Practiq" }}</span>
            <input v-if="authStore.isSuperAdmin" v-model="userQuery" type="search" placeholder="Email o nombre" autocomplete="off" @input="searchUsers" @blur="clearMatchesSoon" />
            <input v-else v-model="userID" placeholder="Username de la persona" autocomplete="off" />
            <div v-if="matches.length" class="suggestions">
              <button v-for="user in matches" :key="user.id" type="button" @mousedown.prevent="selectUser(user)">
                <strong>{{ user.first_name }} {{ user.last_name }}</strong><span>{{ user.email }}</span>
              </button>
            </div>
          </label>
          <label><span>Rol</span><select v-model="role"><option value="student">Alumno</option><option value="teacher">Docente</option><option value="admin">Administrador</option></select></label>
          <button type="submit" :disabled="adding || !userID.trim()">{{ adding ? "Agregando…" : "Agregar" }}</button>
        </form>
        <p class="hint">
          <template v-if="authStore.isSuperAdmin">Buscá por email o nombre y elegí la persona sugerida.</template>
          <template v-else>Ingresá el username exacto. La persona debe haber ingresado al menos una vez a Practiq.</template>
        </p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="loading" class="muted">Cargando personas…</p>
        <p v-else-if="!members.length" class="muted">Todavía no hay personas asignadas.</p>
        <ul v-else class="members">
          <li v-for="member in members" :key="member.user_id">
            <span class="avatar">{{ member.name?.[0]?.toUpperCase() || '?' }}</span>
            <span class="person"><strong>{{ member.name }}</strong><small>{{ member.email || "(sin email)" }}</small></span>
            <span :class="['role', `role--${member.role}`]">{{ roleLabel[member.role] }}</span>
            <button type="button" class="remove" @click="remove(member)">Quitar</button>
          </li>
        </ul>
      </section>
    </div>
  </TeacherLayout>
</template>

<style scoped>
  .school-admin { max-width: 1120px; margin: 0 auto; padding: 2rem; }
  .head { display: flex; justify-content: space-between; gap: 1rem; align-items: end; margin-bottom: 1.5rem; }
  .eyebrow { color: var(--practiq-violet); font-weight: 800; font-size: .72rem; letter-spacing: .09em; text-transform: uppercase; }
  h1 { margin: .25rem 0; color: var(--text-heading); font-size: 1.8rem; } .head p, .panel p, .muted { color: var(--text-secondary); margin: 0; }
  .course-button, .add button { border: 0; border-radius: 9px; background: var(--practiq-violet); color: white; min-height: 42px; padding: 0 .9rem; font: inherit; font-weight: 700; cursor: pointer; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; margin-bottom: 1.25rem; } .stats div, .panel { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 13px; }
  .stats div { padding: 1rem; display: grid; gap: .2rem; } .stats strong { font-size: 1.45rem; color: var(--text-heading); } .stats span { color: var(--text-secondary); font-size: .85rem; }
  .panel { padding: 1.2rem; } h2 { margin: 0 0 .25rem; color: var(--text-heading); font-size: 1.15rem; }
  .add { display: grid; grid-template-columns: 1fr 160px auto; gap: .65rem; align-items: end; margin: 1rem 0 .5rem; } label { display:grid; gap:.25rem; color: var(--text-secondary); font-size:.78rem; font-weight:700; } input,select { min-height:42px; border:1px solid var(--surface-border); border-radius:8px; padding:0 .65rem; font:inherit; background:var(--surface-ground); color:var(--text-primary); } .hint { font-size:.8rem; } .error { margin-top:.75rem !important; color:var(--color-error-dark) !important; }
  .search-field { position: relative; }
  .suggestions { position: absolute; z-index: 4; top: calc(100% + 4px); width: 100%; overflow: hidden; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--surface-card); box-shadow: 0 4px 14px rgba(0,0,0,.08); }
  .suggestions button { display: grid; width: 100%; min-height: 0; padding: .55rem .7rem; border: 0; border-radius: 0; color: var(--text-primary); background: transparent; text-align: left; font: inherit; cursor: pointer; }
  .suggestions button:hover { background: var(--surface-ground); }
  .suggestions span { overflow: hidden; color: var(--text-secondary); font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
  .members { margin: 1rem 0 0; padding: 0; list-style:none; border-top:1px solid var(--surface-border); } .members li { display:flex; align-items:center; gap:.75rem; padding:.8rem 0; border-bottom:1px solid var(--surface-border); } .avatar { display:grid; place-items:center; width:2.15rem; height:2.15rem; border-radius:50%; color:var(--practiq-violet); background:var(--practiq-violet-100); font-weight:800; } .person { display:grid; gap:.1rem; min-width:0; flex:1; } .person strong,.person small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .person small { color:var(--text-secondary); } .role { font-size:.76rem; font-weight:700; padding:.3rem .5rem; border-radius:999px; background:var(--surface-ground); } .role--admin { color:var(--practiq-violet); background:var(--practiq-violet-100); } .role--teacher { color:var(--color-success-dark); background:var(--color-success-bg); } .remove { border:0; background:transparent; color:var(--color-error-dark); cursor:pointer; font:inherit; font-weight:700; }
  @media (max-width: 680px) {
    .school-admin { padding: 0; }
    .head { align-items: stretch; flex-direction: column; gap: .7rem; }
    h1 { font-size: 1.35rem; line-height: 1.25; }
    .stats { grid-template-columns: 1fr; gap: .4rem; }
    .stats div { padding: .6rem .7rem; }
    .stats strong { font-size: 1.2rem; }
    .panel { padding: .9rem; }
    h2 { font-size: 1rem; }
    .add { grid-template-columns: 1fr; gap: .5rem; }
    .add button { width: 100%; }
    input, select { min-height: 40px; }
    .members li { gap: .45rem; padding: .65rem 0; }
    .role { display: none; }
  }
</style>
