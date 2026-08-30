<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
  import { useUsers } from "@/composables/useUsers";

  const { users, loading, pageMeta, loadUsers, createOrSyncUser, setBlocked } = useUsers();

  const email = ref("");
  const firstName = ref("");
  const lastName = ref("");
  const password = ref("");
  const needsDetails = ref(false);
  const submitting = ref(false);
  const search = ref("");
  const userToChange = ref<(typeof users.value)[number] | null>(null);
  const changingBlock = ref(false);

  onMounted(() => {
    loadUsers({ page: 1 });
  });

  function resetForm() {
    email.value = "";
    firstName.value = "";
    lastName.value = "";
    password.value = "";
    needsDetails.value = false;
  }

  async function searchUsers() { await loadUsers({ search: search.value.trim(), page: 1 }); }
  async function changePage(page: number) { if (page >= 1 && page <= pageMeta.value.total_pages) await loadUsers({ search: search.value.trim(), page }); }
  async function confirmBlockChange() {
    if (!userToChange.value || changingBlock.value) return;
    changingBlock.value = true;
    try { await setBlocked(userToChange.value.id, !userToChange.value.is_blocked); userToChange.value = null; }
    finally { changingBlock.value = false; }
  }

  async function handleSubmit() {
    if (!email.value.trim() || submitting.value) return;
    submitting.value = true;
    try {
      const result = await createOrSyncUser({
        email: email.value.trim(),
        ...(needsDetails.value
          ? {
              first_name: firstName.value,
              last_name: lastName.value,
              password: password.value,
            }
          : {}),
      });
      if (result.needsDetails) {
        needsDetails.value = true;
      } else {
        resetForm();
      }
    } catch {
      // useUsers already surfaced the error via toast
    } finally {
      submitting.value = false;
    }
  }
</script>

<template>
  <TeacherLayout>
    <div class="users">
      <h1>Usuarios</h1>
      <p class="hint">
        Poné el email: si ya tiene cuenta en Practiq/Auth se sincroniza sola
        (sin pedir contraseña). Si es nuevo, vas a completar nombre y
        contraseña temporal.
      </p>

      <form class="create-form" @submit.prevent="handleSubmit">
        <InputText
          v-model="email"
          type="email"
          placeholder="Email"
          required
          :disabled="needsDetails"
        />

        <template v-if="needsDetails">
          <p class="details-hint">
            No existe todavía — completá los datos para crear la cuenta.
          </p>
          <div class="field-row">
            <InputText v-model="firstName" placeholder="Nombre" required />
            <InputText v-model="lastName" placeholder="Apellido" required />
          </div>
          <InputText
            v-model="password"
            type="password"
            placeholder="Contraseña temporal"
            required
          />
        </template>

        <div class="form-actions">
          <Button
            type="submit"
            :label="needsDetails ? 'Crear cuenta' : 'Verificar / sincronizar'"
            :loading="submitting"
            size="small"
          />
          <Button
            v-if="needsDetails"
            type="button"
            label="Cancelar"
            severity="secondary"
            text
            size="small"
            @click="resetForm"
          />
        </div>
      </form>

      <div class="users-toolbar"><form class="search-form" @submit.prevent="searchUsers"><InputText v-model="search" placeholder="Buscar por nombre o email" /><Button type="submit" icon="pi pi-search" label="Buscar" size="small" /></form><span>{{ pageMeta.total }} {{ pageMeta.total === 1 ? "usuario" : "usuarios" }}</span></div>
      <StateMessage v-if="loading" variant="loading" loading-label="Cargando usuarios" :rows="5" />
      <StateMessage
        v-else-if="!users.length"
        icon="pi-users"
        title="Todavía no hay usuarios sincronizados"
        description="Verificá un email desde el formulario de arriba para traer una cuenta al campus."
      />
      <ul v-else class="user-list">
        <li v-for="user in users" :key="user.id" class="user-item" :class="{ 'user-item--blocked': user.is_blocked }">
          <div class="user-identity"><span class="user-name">{{ user.full_name || "(sin nombre)" }}</span><span class="user-email">{{ user.email }}</span></div>
          <span class="user-type" :class="`user-type--${user.profile_type}`">
            {{ user.profile_type === "teacher" ? "Docente" : "Alumno" }}
          </span>
          <span v-if="user.is_blocked" class="blocked-badge"><i class="pi pi-ban" /> Bloqueado</span>
          <Button type="button" :label="user.is_blocked ? 'Desbloquear' : 'Bloquear'" :icon="user.is_blocked ? 'pi pi-lock-open' : 'pi pi-ban'" :severity="user.is_blocked ? 'success' : 'danger'" text size="small" @click="userToChange = user" />
        </li>
      </ul>
      <div v-if="pageMeta.total_pages > 1" class="pagination"><Button icon="pi pi-chevron-left" text rounded size="small" aria-label="Página anterior" :disabled="pageMeta.page <= 1" @click="changePage(pageMeta.page - 1)" /><span>Página {{ pageMeta.page }} de {{ pageMeta.total_pages }}</span><Button icon="pi pi-chevron-right" text rounded size="small" aria-label="Página siguiente" :disabled="pageMeta.page >= pageMeta.total_pages" @click="changePage(pageMeta.page + 1)" /></div>
      <Dialog :visible="!!userToChange" modal :header="userToChange?.is_blocked ? 'Desbloquear usuario' : 'Bloquear usuario'" :style="{ width: 'min(420px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible && !changingBlock) userToChange = null; }"><p v-if="userToChange?.is_blocked">{{ userToChange.full_name || userToChange.email }} podrá volver a acceder a Campus.</p><p v-else><strong>{{ userToChange?.full_name || userToChange?.email }}</strong> no podrá acceder a Campus hasta que lo desbloquees.</p><div class="dialog-actions"><Button label="Cancelar" severity="secondary" text :disabled="changingBlock" @click="userToChange = null" /><Button :label="userToChange?.is_blocked ? 'Desbloquear' : 'Bloquear'" :severity="userToChange?.is_blocked ? 'success' : 'danger'" :loading="changingBlock" @click="confirmBlockChange" /></div></Dialog>
    </div>
  </TeacherLayout>
</template>

<style scoped>
  .users {
    max-width: 880px;
  }

  .users h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-1);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-5);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    margin-bottom: var(--space-6);
  }

  .details-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .state-message {
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .user-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
  }

  .users-toolbar{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3);color:var(--text-muted);font-size:var(--text-xs);font-weight:700}.search-form{display:flex;gap:var(--space-2);min-width:min(100%,420px)}.search-form :deep(.p-inputtext){flex:1}.user-identity{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}.user-item--blocked{opacity:.72;background:var(--surface-hover)}.blocked-badge{display:inline-flex;align-items:center;gap:4px;padding:2px var(--space-2);border-radius:var(--radius-pill);background:var(--color-error-bg);color:var(--color-error-dark);font-size:var(--text-xs);font-weight:700;white-space:nowrap}.pagination{display:flex;align-items:center;justify-content:center;gap:var(--space-3);margin-top:var(--space-5);color:var(--text-secondary);font-size:var(--text-xs);font-weight:700}.dialog-actions{display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-5)}

  .user-name {
    font-weight: 600;
    color: var(--text-primary);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  }

  .user-email {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-type {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    flex-shrink: 0;
  }

  .user-type--teacher {
    background: var(--fill-primary-soft);
    color: var(--practiq-violet-dark);
  }

  .user-type--student {
    background: var(--surface-hover);
    color: var(--text-secondary);
  }
  @media(max-width:640px){.users-toolbar{align-items:stretch;flex-direction:column}.search-form{min-width:0}.user-item{align-items:flex-start;flex-wrap:wrap}.user-identity{flex-basis:calc(100% - 80px)}.user-item :deep(.p-button){margin-left:auto}}
</style>
