<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import { useRouter } from "vue-router";
  import { campusApi } from "@/api/request/server";
  import {
    TenantAdminService,
    type CampusTenantAdmin,
    type EligibleSchool,
  } from "@/services/tenants/tenantService";
  import { useTenantStore } from "@/stores/tenantStore";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import PageHeader from "@/components/ui/PageHeader.vue";

  const service = new TenantAdminService(campusApi);
  const router = useRouter();
  const tenantStore = useTenantStore();

  const tenants = ref<CampusTenantAdmin[]>([]);
  const loading = ref(true);
  const error = ref("");
  const schoolID = ref("");
  const activating = ref(false);
  // Offered rather than typed: the server knows which schools qualify, and
  // asking an operator to paste a uuid from another product turned a typo into
  // "no such school".
  const eligible = ref<EligibleSchool[]>([]);
  const eligibleError = ref(false);
  const statusChange = ref<{ tenant: CampusTenantAdmin; status: CampusTenantAdmin["status"] } | null>(null);
  const changingStatus = ref(false);

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
    try {
      eligible.value = await service.eligibleSchools();
      eligibleError.value = false;
      // Nothing preselected: enabling Campus for the wrong institution is not
      // something to do by pressing a button without reading it.
      if (!eligible.value.some((s) => s.id === schoolID.value)) schoolID.value = "";
    } catch {
      eligible.value = [];
      eligibleError.value = true;
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
    if (changingStatus.value) return;
    changingStatus.value = true;
    error.value = "";
    try {
      await service.setStatus(tenant.id, status);
      statusChange.value = null;
      await load();
    } catch (e: unknown) {
      const response = (e as { response?: { data?: { message?: string } } })?.response;
      error.value = response?.data?.message || "No se pudo cambiar el estado.";
    } finally {
      changingStatus.value = false;
    }
  }

  function requestStatus(tenant: CampusTenantAdmin, status: CampusTenantAdmin["status"]) {
    if (status === "active") { void setStatus(tenant, status); return; }
    statusChange.value = { tenant, status };
  }

  function statusVerb(status: CampusTenantAdmin["status"]) {
    return status === "closed" ? "Cerrar" : "Suspender";
  }

  async function open(tenant: CampusTenantAdmin) {
    await tenantStore.load();
    tenantStore.select(tenant.id);
    await router.push("/school/dashboard");
  }

  onMounted(load);
</script>

<template>
  <TeacherLayout>
  <div class="institutions">
    <PageHeader
      eyebrow="Administración de plataforma"
      title="Instituciones"
      subtitle="Habilitá Campus y administrá el acceso por institución."
    />

    <form v-if="eligible.length" class="activate" @submit.prevent="activate">
      <label>
        <span>Institución</span>
        <select v-model="schoolID">
          <option value="">Elegí una institución…</option>
          <option v-for="school in eligible" :key="school.id" :value="school.id">
            {{ school.name }}
          </option>
        </select>
      </label>
      <button type="submit" :disabled="activating || !schoolID">
        Habilitar Campus
      </button>
    </form>
    <p v-else-if="eligibleError" class="error" role="alert">
      No se pudo consultar instituciones elegibles. Reintentá en unos segundos.
    </p>
    <p v-else class="muted empty-eligible">
      No hay instituciones para habilitar. Campus sirve a las que en Practiq son
      institución con facturación por contrato y están activas; creá una desde
      Practiq y aparecerá acá.
    </p>

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
          <button v-if="tenant.status === 'active' && tenant.eligible" type="button" @click="open(tenant)">
            Abrir Campus
          </button>
          <button v-if="tenant.status !== 'active'" type="button" @click="requestStatus(tenant, 'active')">
            Reactivar
          </button>
          <button v-if="tenant.status === 'active'" type="button" @click="requestStatus(tenant, 'suspended')">
            Suspender
          </button>
          <button
            v-if="tenant.status !== 'closed'"
            type="button"
            class="danger"
            @click="requestStatus(tenant, 'closed')"
          >
            Cerrar
          </button>
        </div>
      </li>
    </ul>
    <Dialog :visible="!!statusChange" modal :header="statusChange ? `${statusVerb(statusChange.status)} institución` : ''" :style="{ width: 'min(420px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible && !changingStatus) statusChange = null; }">
      <p>Vas a {{ statusChange?.status === "closed" ? "cerrar" : "suspender" }} <strong>{{ statusChange?.tenant.name || "esta institución" }}</strong>.</p>
      <small>Las personas perderán acceso a Campus hasta que la reactives.</small>
      <div class="dialog-actions"><Button label="Cancelar" text severity="secondary" :disabled="changingStatus" @click="statusChange = null" /><Button :label="statusChange ? statusVerb(statusChange.status) : ''" severity="danger" :loading="changingStatus" @click="statusChange && setStatus(statusChange.tenant, statusChange.status)" /></div>
    </Dialog>
  </div>
  </TeacherLayout>
</template>

<style scoped>
  .institutions {
    max-width: 960px;
  }

  .muted {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .activate {
    display: flex;
    align-items: end;
    gap: 0.6rem;
    margin: 0 0 var(--space-5);
    padding: var(--space-4);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
  }

  .activate label {
    display: grid;
    flex: 1;
    gap: 0.25rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .activate select,
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
  .dialog-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1.2rem; }

  .list {
    display: grid;
    gap: 0.5rem;
    margin: var(--space-4) 0 0;
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
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .empty-eligible {
    margin: 1.5rem 0 1rem;
    padding: 0.75rem;
    border: 1px dashed var(--surface-border);
    border-radius: 10px;
  }

  @media (max-width: 640px) {
    .institutions {
      max-width: none;
    }

    .activate,
    .row {
      flex-direction: column;
      align-items: stretch;
    }

    .actions button {
      flex: 1 1 auto;
    }
  }
</style>
