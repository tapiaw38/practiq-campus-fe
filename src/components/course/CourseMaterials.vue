<script setup lang="ts">
  import StateMessage from "@/components/ui/StateMessage.vue";
  import { computed, onMounted, ref } from "vue";
  import { useCourseMaterials } from "@/composables/useCourseMaterials";
  import type { CourseSection, MaterialKind } from "@/types";

  const props = withDefaults(defineProps<{ courseId: string; assignmentId?: string | null; sections?: CourseSection[]; canManage?: boolean }>(), { assignmentId: null, sections: () => [], canManage: false });
  const { materials, loading, loadMaterials, createMaterial, uploadMaterial, deleteMaterial } = useCourseMaterials();
  const mode = ref<MaterialKind>("file");
  const title = ref("");
  const description = ref("");
  const sectionId = ref("");
  const linkURL = ref("");
  const selectedFile = ref<File | null>(null);
  const saving = ref(false);
  const materialToDelete = ref<(typeof materials.value)[number] | null>(null);
  const visibleMaterials = computed(() => props.assignmentId ? materials.value.filter((material) => material.assignment_id === props.assignmentId) : materials.value.filter((material) => !material.assignment_id));

  onMounted(() => { void loadMaterials(props.courseId).catch(() => undefined); });

  function onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    selectedFile.value = input.files?.[0] ?? null;
    if (!title.value && selectedFile.value) title.value = selectedFile.value.name.replace(/\.[^.]+$/, "");
  }

  async function saveMaterial() {
    if (saving.value || !title.value.trim()) return;
    if (mode.value === "file" && !selectedFile.value) return;
    if (mode.value === "link" && !linkURL.value.trim()) return;
    saving.value = true;
    try {
      const url = mode.value === "file" ? (await uploadMaterial(selectedFile.value!)).url : linkURL.value.trim();
      await createMaterial(props.courseId, { title: title.value.trim(), description: description.value.trim(), section_id: sectionId.value || null, assignment_id: props.assignmentId, kind: mode.value, url });
      title.value = ""; description.value = ""; sectionId.value = ""; linkURL.value = ""; selectedFile.value = null;
    } finally { saving.value = false; }
  }

  async function confirmDelete() {
    if (!materialToDelete.value) return;
    await deleteMaterial(materialToDelete.value.id);
    materialToDelete.value = null;
  }

  function sectionName(id: string | null) { return props.sections.find((section) => section.id === id)?.title; }
</script>

<template>
  <section class="materials-section">
    <div class="materials-heading"><div><h2>{{ assignmentId ? "Adjuntos" : "Materiales" }}</h2><p>{{ canManage ? "Compartí archivos, enlaces y recursos con esta tarea." : "Archivos y enlaces adjuntos por tu docente." }}</p></div><span v-if="visibleMaterials.length" class="material-count">{{ visibleMaterials.length }}</span></div>

    <details v-if="canManage" class="add-material">
      <summary><i class="pi pi-plus" /> Agregar material</summary>
      <form class="material-form" @submit.prevent="saveMaterial">
        <div class="material-mode"><button type="button" :class="{ active: mode === 'file' }" @click="mode = 'file'"><i class="pi pi-upload" /> Archivo</button><button type="button" :class="{ active: mode === 'link' }" @click="mode = 'link'"><i class="pi pi-link" /> Enlace</button></div>
        <InputText v-model="title" placeholder="Título del material" required />
        <Textarea v-model="description" rows="2" placeholder="Descripción (opcional)" />
        <Select v-model="sectionId" :options="[{ id: '', title: 'Sin sección' }, ...sections]" option-label="title" option-value="id" placeholder="Sección (opcional)" />
        <input v-if="mode === 'file'" class="file-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt,image/*,audio/*,video/*" @change="onFileSelect" />
        <InputText v-else v-model="linkURL" type="url" placeholder="https://…" required />
        <small v-if="mode === 'file'">PDF, documentos, imágenes, audio o video. Máximo 50 MB.</small>
        <Button type="submit" :label="mode === 'file' ? 'Subir y publicar' : 'Publicar enlace'" size="small" :loading="saving" class="submit-material" />
      </form>
    </details>

    <StateMessage v-if="loading" variant="loading" dense :rows="2" loading-label="Cargando materiales" />
    <div v-else-if="!visibleMaterials.length" class="materials-state">{{ canManage ? "Todavía no adjuntaste materiales." : "Tu docente todavía no adjuntó materiales." }}</div>
    <ul v-else class="materials-list">
      <li v-for="material in visibleMaterials" :key="material.id" class="material-item">
        <span class="material-icon"><i :class="material.kind === 'link' ? 'pi pi-link' : 'pi pi-file'" /></span>
        <div class="material-content"><a :href="material.view_url || material.url" target="_blank" rel="noopener noreferrer">{{ material.title }} <i class="pi pi-external-link" /></a><p v-if="material.description">{{ material.description }}</p><small><span v-if="sectionName(material.section_id)">{{ sectionName(material.section_id) }} · </span>{{ material.kind === 'link' ? 'Enlace' : 'Archivo' }} · {{ new Date(material.created_at).toLocaleDateString() }}</small></div>
        <button v-if="canManage" type="button" class="delete-material" title="Eliminar material" @click="materialToDelete = material"><i class="pi pi-trash" /></button>
      </li>
    </ul>
    <Dialog :visible="!!materialToDelete" modal header="Eliminar material" :style="{ width: 'min(420px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible) materialToDelete = null; }"><p>Vas a eliminar <strong>{{ materialToDelete?.title }}</strong>.</p><small>Los alumnos dejarán de verlo. Esta acción no se puede deshacer.</small><div class="dialog-actions"><Button label="Cancelar" text severity="secondary" @click="materialToDelete = null" /><Button label="Eliminar" severity="danger" @click="confirmDelete" /></div></Dialog>
  </section>
</template>

<style scoped>
  .materials-section{margin-top:var(--space-6);padding:var(--space-5);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.materials-heading{display:flex;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-4)}.materials-heading h2{margin:0 0 2px;color:var(--text-heading);font-size:var(--text-md)}.materials-heading p,.material-content p,.material-content small,.material-form small{margin:0;color:var(--text-muted);font-size:var(--text-xs);line-height:1.4}.material-count{display:grid;min-width:22px;height:22px;place-items:center;border-radius:var(--radius-pill);background:var(--surface-hover);color:var(--text-muted);font-size:var(--text-xs)}.add-material{margin-bottom:var(--space-4);border:1px dashed rgba(var(--surface-border-rgb),.8);border-radius:var(--radius-sm);background:var(--surface-hover)}.add-material summary{display:flex;align-items:center;gap:var(--space-2);padding:var(--space-3);color:var(--practiq-violet-dark);font-size:var(--text-sm);font-weight:700;cursor:pointer;list-style:none}.add-material summary::-webkit-details-marker{display:none}.material-form{display:flex;flex-direction:column;gap:var(--space-2);padding:0 var(--space-3) var(--space-3)}.material-mode{display:flex;gap:var(--space-1)}.material-mode button{border:0;border-radius:var(--radius-sm);background:transparent;padding:6px 9px;color:var(--text-muted);font-size:var(--text-xs);font-weight:700;cursor:pointer}.material-mode button.active{background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.file-input{max-width:100%;font-size:var(--text-xs)}.submit-material{align-self:flex-start}.materials-state{padding:var(--space-4);border-radius:var(--radius-sm);background:var(--surface-hover);color:var(--text-secondary);font-size:var(--text-sm)}.materials-list{display:flex;flex-direction:column;gap:var(--space-2);list-style:none}.material-item{display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--surface-border);border-radius:var(--radius-sm)}.material-icon{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:var(--radius-sm);background:var(--fill-primary-subtle);color:var(--practiq-violet-dark)}.material-content{min-width:0;flex:1}.material-content a{color:var(--text-primary);font-size:var(--text-sm);font-weight:700;text-decoration:none}.material-content a:hover{color:var(--practiq-violet-dark);text-decoration:underline}.material-content p{margin-top:2px}.material-content small{display:block;margin-top:var(--space-1)}.delete-material{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--text-muted);cursor:pointer}.delete-material:hover{background:var(--color-error-bg);color:var(--color-error-dark)}.dialog-actions{display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-5)}
  @media(max-width:640px){.materials-section{padding:var(--space-4)}}
</style>
