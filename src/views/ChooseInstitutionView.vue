<script setup lang="ts">
  import { computed, onMounted, ref } from "vue";
  import { useRouter } from "vue-router";
  import { useAuthStore } from "@/stores/authStore";
  import { useTenantStore, type CampusTenant } from "@/stores/tenantStore";

  const router = useRouter();
  const auth = useAuthStore();
  const tenants = useTenantStore();
  const loading = ref(true);
  const error = ref("");

  const roleLabel: Record<CampusTenant["role"], string> = {
    admin: "Administrás esta institución",
    teacher: "Sos docente en esta institución",
    student: "Sos estudiante en esta institución",
  };

  const title = computed(() => auth.isSuperAdmin ? "Administrá Campus" : "Elegí tu institución");

  function destination(tenant: CampusTenant) {
    if (auth.isSuperAdmin || tenant.role === "admin") return "/school/dashboard";
    return tenant.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
  }

  async function open(tenant: CampusTenant) {
    tenants.select(tenant.id);
    await router.push(destination(tenant));
  }

  onMounted(async () => {
    try {
      await tenants.load();
      if (auth.isSuperAdmin) {
        await router.replace("/admin/institutions");
        return;
      }
      if (tenants.tenants.length === 1) await open(tenants.tenants[0]);
    } catch {
      error.value = "No se pudieron cargar tus instituciones. Probá de nuevo.";
    } finally {
      loading.value = false;
    }
  });
</script>

<template>
  <main class="chooser">
    <section class="card" aria-labelledby="choose-title">
      <img src="/logo.png" alt="Practiq" class="logo" />
      <p class="eyebrow">Practiq Campus</p>
      <h1 id="choose-title">{{ title }}</h1>
      <p class="lead">{{ auth.isSuperAdmin ? "Gestioná instituciones, accesos y estado de Campus." : "Elegí desde qué institución querés trabajar." }}</p>

      <p v-if="loading" class="muted">Cargando instituciones…</p>
      <p v-else-if="error" class="error" role="alert">{{ error }}</p>
      <template v-else-if="tenants.tenants.length">
        <button v-for="tenant in tenants.tenants" :key="tenant.id" type="button" class="institution" @click="open(tenant)">
          <span class="building"><i class="pi pi-building" aria-hidden="true"></i></span>
          <span class="copy"><strong>{{ tenant.name }}</strong><small>{{ roleLabel[tenant.role] }}</small></span>
          <i class="pi pi-arrow-right" aria-hidden="true"></i>
        </button>
      </template>
      <template v-else>
        <p class="empty">Todavía no tenés acceso a una institución Campus.</p>
        <p class="muted">Pedile a quien administra tu escuela que te agregue.</p>
      </template>
    </section>
  </main>
</template>

<style scoped>
  .chooser { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; background: var(--gradient-app-bg); }
  .card { width: min(100%, 580px); padding: 2rem; background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 20px; box-shadow: var(--shadow-card); }
  .logo { width: 34px; height: 34px; margin-bottom: .8rem; }
  .eyebrow { margin: 0 0 .35rem; color: var(--practiq-violet); font-size: .75rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  h1 { margin: 0; color: var(--text-heading); font-size: 1.65rem; }
  .lead, .muted { color: var(--text-secondary); line-height: 1.5; }
  .lead { margin: .5rem 0 1.5rem; }
  .institution { display: flex; width: 100%; align-items: center; gap: .85rem; padding: 1rem; margin-top: .65rem; text-align: left; color: var(--text-primary); background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 12px; cursor: pointer; font: inherit; }
  .institution:hover, .institution:focus-visible { border-color: var(--practiq-violet); background: var(--practiq-violet-50); }
  .building { display: grid; place-items: center; width: 2.35rem; height: 2.35rem; color: var(--practiq-violet); background: var(--practiq-violet-100); border-radius: 9px; }
  .copy { display: grid; flex: 1; gap: .18rem; min-width: 0; }
  .copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .copy small { color: var(--text-secondary); }
  .empty { margin: 1.5rem 0 .3rem; font-weight: 700; color: var(--text-heading); }
  .error { color: var(--color-error-dark); }
</style>
