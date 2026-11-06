<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useTenant } from "@/composables/useTenant";
import { useAuthStore } from "@/stores/authStore";
import { tenantDestination } from "@/utils/tenantDestination";

const tenants = useTenant();
const auth = useAuthStore();
const router = useRouter();

const canSwitch = computed(() => tenants.tenants.length > 1);

async function change(event: Event) {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    if (!id || id === tenants.selectedID) return;

    const tenant = tenants.tenants.find((t) => t.id === id);
    if (!tenant) {
        select.value = tenants.selectedID;
        return;
    }

    tenants.select(id);
    await router.replace(tenantDestination(tenant, auth.isSuperAdmin));
    router.go(0);
}

function chooseInstitution() {
    router.push("/choose-institution");
}
</script>

<template>
    <div v-if="tenants.selected" class="tenant-switcher">
        <span class="label">Institución</span>

        <select
            v-if="canSwitch"
            class="picker"
            :value="tenants.selectedID"
            aria-label="Cambiar de institución"
            @change="change"
        >
            <option v-for="tenant in tenants.tenants" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
            </option>
        </select>

        <div v-else class="single-row">
            <span class="single" :title="tenants.selected.name">{{ tenants.selected.name }}</span>
            <button type="button" class="change" @click="chooseInstitution">Cambiar</button>
        </div>
    </div>
</template>

<style scoped>
.tenant-switcher {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    padding: 0.5rem 0.75rem;
}

.label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.picker {
    max-width: 100%;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-card);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.88rem;
}

.single {
    overflow: hidden;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.single-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
}
.change {
    flex: 0 0 auto;
    border: 0;
    background: transparent;
    color: var(--practiq-violet);
    cursor: pointer;
    font: inherit;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0;
}
</style>
