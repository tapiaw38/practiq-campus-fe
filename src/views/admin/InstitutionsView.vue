<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import { campusApi } from "@/api/request/server";
  import {
    TenantAdminService,
    type CampusTenantAdmin,
  } from "@/services/tenants/tenantService";

  const service = new TenantAdminService(campusApi);

  const tenants = ref<CampusTenantAdmin[]>([]);
  const loading = ref(true);
  const error = ref("");
  const schoolID = ref("");
  const activating = ref(false);

  const statusLabel: Record<CampusTenantAdmin["status"], string> = {
    active: "Activa",
    suspended: "Suspendida",
    closed: "Cerrada",
  };

  async function load() {
    loading.value = true;
    error.value = "";
    try {
      tenants.value = await service.list();
    } catch {
      error.value = "No se pudieron cargar las instituciones.";
    } finally {
      loading.value = false;
    }
  }

  async function activate() {
    const id = schoolID.value.trim();
    if (!id || activating.value) return;
    activating.value = true;
    error.value = "";
    try {
      await service.activate(id);
      schoolID.value = "";
      await load();
    } catch (e: unknown) {
      // The API decides eligibility, so its message is shown rather than a
      // guess: it knows whether the school is missing, personal, on a
      // subscription or closed.
      const response = (e as { response?: { data?: { message?: string } } })?.response;
      error.value = response?.data?.message || "No se pudo habilitar Campus para esa escuela.";
    } finally {
      activating.value = false;
    }
  }

  async function setStatus(tenant: CampusTenantAdmin, status: CampusTenantAdmin["status"]) {
    const verb = status === "closed" ? "cerrar" : status === "suspended" ? "suspender" : "reactivar";
    // Suspending and closing cut off everyone in the institution at once, so
    // they are confirmed rather than done on a single click.
    if (status !== "active" && !window.confirm(`¿Seguro que querés ${verb} ${tenant.name || "esta institución"}?`)) {
      return;
    }
    error.value = "";
    try {
      await service.setStatus(tenant.id, status);
      await load();
    } catch (e: unknown) {
      const response = (e as { response?: { data?: { message?: string } } })?.response;
      error.value = response?.data?.message || "No se pudo cambiar el estado.";
    }
  }

  onMounted(load);
</script>

<template>
  <main class="institutions">
    <header>
      <h1>Instituciones de Campus</h1>
      <p>
        Campus se habilita por institución. Solo entran las que Practiq tiene
        como institución con facturación por contrato y en estado activo.
      </p>
    </header>

    <form class="activate" @submit.prevent="activate">
      <label>
        <span>ID de escuela en Practiq</span>
        <input v-model="schoolID" placeholder="UUID de la escuela" autocomplete="off" />
      </label>
      <button type="submit" :disabled="activating || !schoolID.trim()">
        Habilitar Campus
      </button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p v-if="loading" class="muted">Cargando…</p>
    <p v-else-if="!tenants.length" class="muted">
      Todavía no hay ninguna institución con Campus habilitado.
    </p>

    <ul v-else class="list">
      <li v-for="tenant in tenants" :key="tenant.id" class="row">
        <div class="main">
          <strong>{{ tenant.name || "(escuela sin nombre en Practiq)" }}</strong>
          <span class="school-id">{{ tenant.school_id }}</span>
          <span v-if="!tenant.eligible" class="warn">
            Ya no cumple los requisitos en Practiq
          </span>
        </div>

        <span :class="['status', `status--${tenant.status}`]">
          {{ statusLabel[tenant.status] }}
        </span>

        <div class="actions">
          <button v-if="tenant.status !== 'active'" type="button" @click="setStatus(tenant, 'active')">
            Reactivar
          </button>
          <button v-if="tenant.status === 'active'" type="button" @click="setStatus(tenant, 'suspended')">
            Suspender
          </button>
          <button
            v-if="tenant.status !== 'closed'"
            type="button"
            class="danger"
            @click="setStatus(tenant, 'closed')"
          >
            Cerrar
          </button>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
  .institutions {
    max-width: 860px;
    padding: 2rem;
  }

  header h1 {
    margin: 0 0 0.4rem;
    font-size: 1.5rem;
    color: var(--text-heading);
  }

  header p,
  .muted {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .activate {
    display: flex;
    align-items: end;
    gap: 0.6rem;
    margin: 1.5rem 0 1rem;
  }

  .activate label {
    display: grid;
    flex: 1;
    gap: 0.25rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .activate input {
    min-height: 40px;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    font: inherit;
  }

  button {
    min-height: 40px;
    padding: 0 0.9rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-card);
    font-weight: 600;
    cursor: pointer;
  }

  .activate button {
    border: 0;
    background: var(--practiq-violet);
    color: #fff;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .danger {
    color: var(--color-error-dark);
    border-color: var(--color-error);
  }

  .error {
    margin: 0 0 1rem;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    background: var(--color-error-bg);
    color: var(--color-error-dark);
    font-size: 0.88rem;
  }

  .list {
    display: grid;
    gap: 0.5rem;
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--surface-border);
    border-radius: 10px;
  }

  .main {
    display: grid;
    flex: 1;
    gap: 0.15rem;
    min-width: 0;
  }

  .school-id {
    overflow: hidden;
    color: var(--text-muted);
    font-size: 0.74rem;
    text-overflow: ellipsis;
  }

  .warn {
    color: var(--color-warning-dark);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status {
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .status--active {
    background: var(--color-success-bg);
    color: var(--color-success-dark);
  }

  .status--suspended {
    background: var(--color-warning-bg);
    color: var(--color-warning-dark);
  }

  .status--closed {
    background: var(--color-error-bg);
    color: var(--color-error-dark);
  }

  .actions {
    display: flex;
    gap: 0.4rem;
  }

  @media (max-width: 640px) {
    .institutions {
      padding: 1rem;
    }

    .activate,
    .row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
