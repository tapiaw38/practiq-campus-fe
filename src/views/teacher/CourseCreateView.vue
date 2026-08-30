<script setup lang="ts">
  import { computed, onMounted, ref } from "vue";
  import { useRouter } from "vue-router";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import { useCourses } from "@/composables/useCourses";

  const router = useRouter();
  const { createCourse, courses, loadCourses } = useCourses();

  const title = ref("");
  const description = ref("");
  const labels = ref<string[]>([]);
  const labelDraft = ref("");
  const submitting = ref(false);
  const savedLabels = computed(() =>
    [...new Set(courses.value.flatMap((course) => course.labels ?? []))]
      .filter((label) => !labels.value.some((item) => item.toLowerCase() === label.toLowerCase())),
  );

  onMounted(() => { void loadCourses().catch(() => undefined); });

  async function handleSubmit() {
    if (submitting.value) return;
    submitting.value = true;
    try {
      const course = await createCourse({
        title: title.value,
        description: description.value,
        labels: labels.value,
      });
      router.push(`/teacher/courses/${course.id}`);
    } catch {
      // useCourses already surfaced the error via toast
    } finally {
      submitting.value = false;
    }
  }

  function addLabel(value = labelDraft.value) { const label = value.trim(); if (label && !labels.value.some((item) => item.toLowerCase() === label.toLowerCase())) labels.value.push(label); labelDraft.value = ""; }
  function removeLabel(label: string) { labels.value = labels.value.filter((item) => item !== label); }
</script>

<template>
  <TeacherLayout>
    <div class="create-course">
      <button class="back-btn" type="button" @click="router.back()">
        <i class="pi pi-arrow-left"></i> Volver
      </button>

      <h1>Nuevo curso</h1>

      <form class="course-form" @submit.prevent="handleSubmit">
        <label class="field">
          <span class="field-label">Título</span>
          <InputText v-model="title" required />
        </label>
        <div class="field"><span class="field-label">Etiquetas</span><div class="label-entry"><InputText v-model="labelDraft" list="saved-course-labels" placeholder="Ej.: 2.º A, Turno tarde" @keyup.enter.prevent="addLabel()" /><datalist id="saved-course-labels"><option v-for="label in savedLabels" :key="label" :value="label" /></datalist><Button type="button" label="Agregar" size="small" @click="addLabel()" /></div><div v-if="labels.length" class="label-chips"><span v-for="label in labels" :key="label">{{ label }} <button type="button" @click="removeLabel(label)"><i class="pi pi-times" /></button></span></div><small>Al escribir se sugieren etiquetas usadas anteriormente. También podés crear una nueva.</small></div>
        <label class="field">
          <span class="field-label">Descripción</span>
          <Textarea v-model="description" rows="4" />
        </label>
        <Button
          type="submit"
          label="Crear curso"
          :loading="submitting"
          class="submit-btn"
        />
      </form>
    </div>
  </TeacherLayout>
</template>

<style scoped>
  .create-course {
    max-width: 560px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    margin-bottom: var(--space-4);
  }

  h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-6);
  }

  .course-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--surface-card);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-secondary);
  }

  .submit-btn {
    margin-top: var(--space-2);
    align-self: flex-start;
  }
  .label-entry{display:flex;gap:var(--space-2)}.label-entry .p-inputtext{flex:1}.label-chips{display:flex;gap:var(--space-1);flex-wrap:wrap}.label-chips span{display:inline-flex;align-items:center;gap:var(--space-1);padding:3px 7px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:700}.label-chips button{border:0;background:transparent;color:inherit;padding:0;cursor:pointer}.field small{color:var(--text-muted);font-size:var(--text-xs)}
</style>
