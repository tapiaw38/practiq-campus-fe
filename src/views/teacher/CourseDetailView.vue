<script setup lang="ts">
  import { computed, onMounted, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import { useCourses } from "@/composables/useCourses";
  import { useEnrollments } from "@/composables/useEnrollments";
  import { usePractiqStudents } from "@/composables/usePractiqStudents";
  import { useCourseSections } from "@/composables/useCourseSections";
  import { useAssignments } from "@/composables/useAssignments";
  import { useSubmissions } from "@/composables/useSubmissions";
  import { useMessages } from "@/composables/useMessages";
  import ForumSection from "@/components/forum/ForumSection.vue";
  import CourseMaterials from "@/components/course/CourseMaterials.vue";
  import type { CourseStatus } from "@/types";

  const route = useRoute();
  const router = useRouter();
  const courseId = route.params.id as string;
  type CourseTab = "alumnos" | "contenido" | "materiales" | "tareas" | "foro";
  const activeCourseTab = ref<CourseTab>("alumnos");

  const { currentCourse, courses, loading: courseLoading, loadCourse, loadCourses, updateCourse } =
    useCourses();
  const {
    courseEnrollments,
    loading: enrollmentsLoading,
    loadByCourse,
    enroll,
    unenroll,
  } = useEnrollments();

  const { practiqStudents, loadPractiqStudents } = usePractiqStudents();

  const { sections, loadSections, createSection, updateSection, deleteSection } = useCourseSections();
  const { assignments, loadAssignments, createAssignment, updateAssignment, deleteAssignment } = useAssignments();
  const {
    submissionsByAssignment,
    loading: submissionsLoading,
    loadByAssignment,
    grade,
  } = useSubmissions();
  const { broadcast } = useMessages();

  const broadcastBody = ref("");
  const broadcasting = ref(false);
  const courseLabelDraft = ref("");
  const savingLabels = ref(false);
  const courseLabelSuggestions = computed(() => {
    const currentLabels = currentCourse.value?.labels ?? [];
    return [...new Set(courses.value.flatMap((course) => course.labels ?? []))]
      .filter((label) => !currentLabels.some((item) => item.toLowerCase() === label.toLowerCase()));
  });

  async function handleBroadcast() {
    if (!broadcastBody.value.trim() || broadcasting.value) return;
    broadcasting.value = true;
    try {
      await broadcast(courseId, broadcastBody.value.trim());
      broadcastBody.value = "";
    } catch {
      // useMessages already surfaced the error via toast
    } finally {
      broadcasting.value = false;
    }
  }

  const newStudentEmail = ref("");
  const enrolling = ref(false);

  const newSectionTitle = ref("");
  const creatingSection = ref(false);
  const editingSectionId = ref<string | null>(null);
  const editingSectionTitle = ref("");

  const newAssignment = ref({
    title: "",
    description: "",
    dueAt: "",
    maxScore: "100",
    sectionId: "",
  });
  const creatingAssignment = ref(false);
  const editingAssignmentId = ref<string | null>(null);
  const editingAssignmentTitle = ref("");

  const expandedAssignmentId = ref<string | null>(null);
  const gradeDrafts = ref<Record<string, { score: string; feedback: string }>>({});

  function beginEditSection(section: { id: string; title: string }) { editingSectionId.value = section.id; editingSectionTitle.value = section.title; }
  async function saveSection() { if (!editingSectionId.value || !editingSectionTitle.value.trim()) return; await updateSection(courseId, editingSectionId.value, editingSectionTitle.value.trim()); editingSectionId.value = null; }
  function beginEditAssignment(assignment: { id: string; title: string }) { editingAssignmentId.value = assignment.id; editingAssignmentTitle.value = assignment.title; }
  async function saveAssignment() { const item = assignments.value.find((a) => a.id === editingAssignmentId.value); if (!item || !editingAssignmentTitle.value.trim()) return; await updateAssignment(courseId, item.id, { title: editingAssignmentTitle.value.trim(), description: item.description, due_at: item.due_at || undefined, max_score: item.max_score, section_id: item.section_id }); editingAssignmentId.value = null; }

  onMounted(() => {
    loadCourse(courseId);
    loadCourses();
    loadByCourse(courseId);
    loadPractiqStudents();
    loadSections(courseId);
    loadAssignments(courseId);
  });

  function pickPractiqStudent(email: string) {
    newStudentEmail.value = email;
  }

  async function handleCreateSection() {
    if (!newSectionTitle.value.trim() || creatingSection.value) return;
    creatingSection.value = true;
    try {
      await createSection(courseId, newSectionTitle.value.trim());
      newSectionTitle.value = "";
    } catch {
      // useCourseSections already surfaced the error via toast
    } finally {
      creatingSection.value = false;
    }
  }

  function sectionTitle(sectionId: string | null) {
    if (!sectionId) return null;
    return sections.value.find((s) => s.id === sectionId)?.title ?? null;
  }

  async function handleCreateAssignment() {
    if (!newAssignment.value.title.trim() || creatingAssignment.value) return;
    creatingAssignment.value = true;
    try {
      await createAssignment(courseId, {
        title: newAssignment.value.title.trim(),
        description: newAssignment.value.description,
        due_at: newAssignment.value.dueAt
          ? new Date(newAssignment.value.dueAt).toISOString()
          : undefined,
        max_score: Number(newAssignment.value.maxScore) || undefined,
        section_id: newAssignment.value.sectionId || null,
      });
      newAssignment.value = { title: "", description: "", dueAt: "", maxScore: "100", sectionId: "" };
    } catch {
      // useAssignments already surfaced the error via toast
    } finally {
      creatingAssignment.value = false;
    }
  }

  async function toggleSubmissions(assignmentId: string) {
    if (expandedAssignmentId.value === assignmentId) {
      expandedAssignmentId.value = null;
      return;
    }
    expandedAssignmentId.value = assignmentId;
    await loadByAssignment(assignmentId);
  }

  function draftFor(submissionId: string) {
    if (!gradeDrafts.value[submissionId]) {
      gradeDrafts.value[submissionId] = { score: "", feedback: "" };
    }
    return gradeDrafts.value[submissionId];
  }

  async function handleGrade(assignmentId: string, submissionId: string) {
    const draft = draftFor(submissionId);
    const score = Number(draft.score);
    if (Number.isNaN(score)) return;
    await grade(assignmentId, submissionId, score, draft.feedback);
  }

  async function handleEnroll() {
    if (!newStudentEmail.value.trim() || enrolling.value) return;
    enrolling.value = true;
    try {
      await enroll(courseId, newStudentEmail.value.trim());
      newStudentEmail.value = "";
    } catch {
      // useEnrollments already surfaced the error via toast
    } finally {
      enrolling.value = false;
    }
  }

  async function handleStatusChange(status: CourseStatus) {
    await updateCourse(courseId, { status });
  }

  async function addCourseLabel() {
    const label = courseLabelDraft.value.trim();
    if (!label || !currentCourse.value || savingLabels.value) return;
    const labels = currentCourse.value.labels ?? [];
    if (labels.some((item) => item.toLowerCase() === label.toLowerCase())) {
      courseLabelDraft.value = "";
      return;
    }
    savingLabels.value = true;
    try {
      await updateCourse(courseId, { labels: [...labels, label] });
      courseLabelDraft.value = "";
    } finally {
      savingLabels.value = false;
    }
  }

  async function removeCourseLabel(label: string) {
    if (!currentCourse.value || savingLabels.value) return;
    savingLabels.value = true;
    try {
      await updateCourse(courseId, {
        labels: (currentCourse.value.labels ?? []).filter((item) => item !== label),
      });
    } finally {
      savingLabels.value = false;
    }
  }
</script>

<template>
  <TeacherLayout>
    <div class="course-detail">
      <button class="back-btn" type="button" @click="router.back()">
        <i class="pi pi-arrow-left"></i> Volver
      </button>

      <div v-if="courseLoading || !currentCourse" class="state-message">
        Cargando…
      </div>
      <template v-else>
        <header class="course-head">
          <h1>{{ currentCourse.title }}</h1>
          <Select
            :model-value="currentCourse.status"
            :options="['draft', 'published', 'archived']"
            @update:model-value="handleStatusChange"
          />
        </header>
        <p v-if="currentCourse.description" class="course-description">
          {{ currentCourse.description }}
        </p>

        <div class="course-labels">
          <span v-for="label in currentCourse.labels" :key="label" class="course-label">
            {{ label }}
            <button type="button" :aria-label="`Quitar etiqueta ${label}`" @click="removeCourseLabel(label)">
              <i class="pi pi-times" />
            </button>
          </span>
          <form class="course-label-form" @submit.prevent="addCourseLabel">
            <InputText v-model="courseLabelDraft" list="course-label-suggestions" placeholder="Agregar etiqueta" aria-label="Nueva etiqueta" />
            <datalist id="course-label-suggestions"><option v-for="label in courseLabelSuggestions" :key="label" :value="label" /></datalist>
            <Button type="submit" icon="pi pi-plus" text rounded size="small" :loading="savingLabels" aria-label="Agregar etiqueta" />
          </form>
        </div>

        <nav class="course-nav" aria-label="Secciones del curso">
          <button type="button" :class="{ active: activeCourseTab === 'alumnos' }" @click="activeCourseTab = 'alumnos'"><i class="pi pi-users" /> Alumnos <span>{{ courseEnrollments.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'contenido' }" @click="activeCourseTab = 'contenido'"><i class="pi pi-book" /> Secciones <span>{{ sections.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'materiales' }" @click="activeCourseTab = 'materiales'"><i class="pi pi-folder-open" /> Materiales</button>
          <button type="button" :class="{ active: activeCourseTab === 'tareas' }" @click="activeCourseTab = 'tareas'"><i class="pi pi-check-square" /> Tareas <span>{{ assignments.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'foro' }" @click="activeCourseTab = 'foro'"><i class="pi pi-comments" /> Foro</button>
        </nav>

        <section v-if="activeCourseTab === 'alumnos'" class="enrollments-section workspace-section">
          <div class="section-heading">
            <div><h2>Alumnos</h2><p>Matriculá, revisá participantes y enviá avisos.</p></div>
            <span class="section-count">{{ courseEnrollments.length }}</span>
          </div>

          <details class="create-disclosure">
            <summary><i class="pi pi-user-plus" /> Matricular alumno</summary>
            <div class="disclosure-body">
              <form class="enroll-form" @submit.prevent="handleEnroll">
                <InputText
                  v-model="newStudentEmail"
                  type="email"
                  placeholder="Email del alumno"
                  class="enroll-input"
                />
                <Button type="submit" label="Matricular" :loading="enrolling" size="small" />
              </form>
              <p class="enroll-hint">El alumno debe tener cuenta Campus creada por un superadmin.</p>
            </div>
          </details>

          <div v-if="practiqStudents.length" class="practiq-students">
            <span class="practiq-students-label">Tus alumnos en Practiq:</span>
            <button
              v-for="student in practiqStudents"
              :key="student.id"
              type="button"
              class="practiq-student-chip"
              @click="pickPractiqStudent(student.email)"
            >
              {{ student.name || student.email }}
            </button>
          </div>

          <div v-if="enrollmentsLoading" class="state-message">Cargando…</div>
          <div v-else-if="!courseEnrollments.length" class="state-message">
            Nadie está matriculado todavía.
          </div>
          <ul v-else class="enrollment-list">
            <li
              v-for="enrollment in courseEnrollments"
              :key="enrollment.id"
              class="enrollment-item"
            >
              <span class="enrollment-user">{{ enrollment.user_name || enrollment.user_id }}</span>
              <span class="enrollment-role">{{ enrollment.enrollment_role }}</span>
              <button
                class="remove-btn"
                type="button"
                title="Dar de baja"
                @click="unenroll(enrollment.id)"
              >
                <i class="pi pi-times"></i>
              </button>
            </li>
          </ul>

          <form class="broadcast-form" @submit.prevent="handleBroadcast">
            <span class="broadcast-label">Mensaje a todos los matriculados</span>
            <div class="field-row">
              <InputText
                v-model="broadcastBody"
                placeholder="Escribí un mensaje…"
                class="broadcast-input"
              />
              <Button
                type="submit"
                label="Enviar a todos"
                size="small"
                :loading="broadcasting"
              />
            </div>
          </form>
        </section>

        <section v-if="activeCourseTab === 'contenido'" class="content-section workspace-section">
          <div class="section-heading">
            <div><h2>Secciones</h2><p>Ordená el material del curso por unidades o temas.</p></div>
            <span class="section-count">{{ sections.length }}</span>
          </div>
          <details class="create-disclosure">
            <summary><i class="pi pi-plus" /> Agregar sección</summary>
            <form class="inline-form disclosure-body" @submit.prevent="handleCreateSection">
              <InputText v-model="newSectionTitle" placeholder="Ej.: Unidad 1 — Números" class="enroll-input" />
              <Button type="submit" label="Agregar" :loading="creatingSection" size="small" />
            </form>
          </details>
          <ul v-if="sections.length" class="section-list">
            <li v-for="section in sections" :key="section.id" class="section-chip">
              <template v-if="editingSectionId === section.id"><InputText v-model="editingSectionTitle" size="small" @keyup.enter="saveSection" /><button type="button" class="item-action" @click="saveSection"><i class="pi pi-check" /></button></template>
              <template v-else>{{ section.title }} <button type="button" class="item-action" title="Editar" @click="beginEditSection(section)"><i class="pi pi-pencil" /></button><button type="button" class="item-action" title="Eliminar" @click="deleteSection(courseId, section.id)"><i class="pi pi-trash" /></button></template>
            </li>
          </ul>
        </section>

        <div v-if="activeCourseTab === 'materiales'">
          <CourseMaterials :course-id="courseId" :sections="sections" can-manage />
        </div>

        <section v-if="activeCourseTab === 'tareas'" class="content-section workspace-section">
          <div class="section-heading">
            <div><h2>Tareas</h2><p>Creá actividades y abrí una tarea para revisar sus entregas.</p></div>
            <span class="section-count">{{ assignments.length }}</span>
          </div>
          <details class="create-disclosure">
            <summary><i class="pi pi-plus" /> Crear tarea</summary>
          <form class="assignment-form disclosure-body" @submit.prevent="handleCreateAssignment">
            <InputText v-model="newAssignment.title" placeholder="Título" required />
            <Textarea
              v-model="newAssignment.description"
              rows="2"
              placeholder="Descripción (opcional)"
            />
            <div class="field-row">
              <InputText
                v-model="newAssignment.dueAt"
                type="datetime-local"
                placeholder="Fecha de entrega (opcional)"
              />
              <InputText
                v-model="newAssignment.maxScore"
                type="number"
                placeholder="Nota máxima"
              />
            </div>
            <Select
              v-model="newAssignment.sectionId"
              :options="[{ id: '', title: 'Sin sección' }, ...sections]"
              option-label="title"
              option-value="id"
              placeholder="Sección (opcional)"
            />
            <Button
              type="submit"
              label="Crear tarea"
              :loading="creatingAssignment"
              size="small"
              class="submit-btn"
            />
          </form>
          </details>

          <div v-if="!assignments.length" class="state-message">
            Todavía no hay tareas.
          </div>
          <ul v-else class="assignment-list">
            <li v-for="assignment in assignments" :key="assignment.id" class="assignment-item">
              <div class="assignment-head" @click="toggleSubmissions(assignment.id)">
                <div>
                  <div v-if="editingAssignmentId === assignment.id" class="inline-edit"><InputText v-model="editingAssignmentTitle" size="small" @keyup.enter="saveAssignment" /><button type="button" class="item-action" @click="saveAssignment"><i class="pi pi-check" /></button></div>
                  <div v-else class="assignment-title">{{ assignment.title }}</div>
                  <div class="assignment-meta">
                    <span v-if="sectionTitle(assignment.section_id)">
                      {{ sectionTitle(assignment.section_id) }} ·
                    </span>
                    <span v-if="assignment.due_at">
                      vence {{ new Date(assignment.due_at).toLocaleString() }} ·
                    </span>
                    <span>máx. {{ assignment.max_score }}</span>
                  </div>
                </div>
                <div class="item-actions"><button type="button" class="item-action" title="Editar" @click.stop="beginEditAssignment(assignment)"><i class="pi pi-pencil" /></button><button type="button" class="item-action" title="Eliminar" @click.stop="deleteAssignment(courseId, assignment.id)"><i class="pi pi-trash" /></button></div><i
                  class="pi"
                  :class="expandedAssignmentId === assignment.id ? 'pi-chevron-up' : 'pi-chevron-down'"
                ></i>
              </div>

              <div v-if="expandedAssignmentId === assignment.id" class="submissions-panel">
                <div v-if="submissionsLoading" class="state-message">Cargando…</div>
                <div
                  v-else-if="!(submissionsByAssignment[assignment.id] || []).length"
                  class="state-message"
                >
                  Nadie entregó todavía.
                </div>
                <ul v-else class="submission-list">
                  <li
                    v-for="submission in submissionsByAssignment[assignment.id]"
                    :key="submission.id"
                    class="submission-item"
                  >
                    <div class="submission-head">
                      <span class="submission-user">{{ submission.user_name || submission.user_id }}</span>
                      <span
                        class="submission-status"
                        :class="`submission-status--${submission.status}`"
                      >
                        {{ submission.status === "graded" ? `Nota: ${submission.score}` : "Entregado" }}
                      </span>
                    </div>
                    <p class="submission-content">{{ submission.content }}</p>
                    <div class="grade-form">
                      <InputText
                        v-model="draftFor(submission.id).score"
                        type="number"
                        placeholder="Nota"
                        class="grade-score"
                      />
                      <InputText
                        v-model="draftFor(submission.id).feedback"
                        placeholder="Comentario (opcional)"
                        class="grade-feedback"
                      />
                      <Button
                        type="button"
                        label="Calificar"
                        size="small"
                        @click="handleGrade(assignment.id, submission.id)"
                      />
                    </div>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="activeCourseTab === 'foro'" class="forum-section-wrap">
          <ForumSection :course-id="courseId" />
        </section>
      </template>
    </div>
  </TeacherLayout>
</template>

<style scoped>
  .course-detail {
    max-width: 920px;
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

  .state-message {
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .course-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .course-head h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-heading);
  }

  .course-description {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    margin-bottom: var(--space-3);
  }

  .course-labels { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-5); }
  .course-label { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--fill-primary-soft); color: var(--practiq-violet-dark); font-size: var(--text-xs); font-weight: 700; }
  .course-label button { border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
  .course-label-form { display: flex; align-items: center; gap: 2px; }
  .course-label-form :deep(.p-inputtext) { width: 150px; padding: 5px 8px; font-size: var(--text-xs); }

  .course-nav { display: flex; gap: var(--space-2); overflow-x: auto; padding: var(--space-3); margin-bottom: var(--space-5); border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); box-shadow: var(--shadow-card); }
  .course-nav button { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 var(--space-3); border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary); font-size: var(--text-xs); font-weight: 700; white-space: nowrap; cursor: pointer; }
  .course-nav button:hover, .course-nav button.active { background: var(--surface-hover); color: var(--practiq-violet-dark); }
  .course-nav span, .section-count { display: grid; min-width: 20px; height: 20px; padding: 0 5px; place-items: center; border-radius: var(--radius-pill); background: var(--surface-hover); color: var(--text-muted); font-size: var(--text-xs); }

  .workspace-section { padding: var(--space-5); border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); box-shadow: var(--shadow-card); }
  .section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-4); }
  .section-heading h2 { margin-bottom: 2px; }
  .section-heading p { color: var(--text-muted); font-size: var(--text-xs); line-height: 1.4; }
  .create-disclosure { border: 1px dashed rgba(var(--surface-border-rgb), .8); border-radius: var(--radius-sm); background: var(--surface-hover); margin-bottom: var(--space-4); }
  .create-disclosure summary { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); color: var(--practiq-violet-dark); font-size: var(--text-sm); font-weight: 700; cursor: pointer; list-style: none; }
  .create-disclosure summary::-webkit-details-marker { display: none; }
  .disclosure-body { margin: 0; padding: 0 var(--space-3) var(--space-3); }

  .enrollments-section h2 {
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-3);
  }

  .enroll-form {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .enroll-input {
    flex: 1;
  }

  .enroll-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-4);
  }

  .practiq-students {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
  }

  .practiq-students-label {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-right: var(--space-1);
  }

  .practiq-student-chip {
    border: 1px solid rgba(var(--surface-border-rgb), 0.4);
    background: var(--surface-hover);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: 600;
    padding: 2px var(--space-3);
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .practiq-student-chip:hover {
    background: var(--fill-primary-soft);
    color: var(--practiq-violet-dark);
  }

  .enrollment-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .enrollment-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
  }

  .enrollment-user {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .enrollment-role {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .remove-btn {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .remove-btn:hover {
    background: var(--color-error-bg);
    color: var(--color-error-dark);
  }

  .broadcast-form {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--surface-border);
  }

  .broadcast-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: var(--space-2);
  }

  .broadcast-input {
    flex: 1;
  }

  .content-section {
    margin-top: var(--space-6);
  }

  .content-section h2 {
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-3);
  }

  .inline-form {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .section-list {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .section-chip {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--surface-hover);
    padding: 2px var(--space-3);
    border-radius: var(--radius-pill);
  }

  .item-actions, .inline-edit { display: inline-flex; align-items: center; gap: 4px; }
  .item-action { border: 0; background: transparent; color: var(--text-muted); cursor: pointer; padding: 3px; }
  .item-action:hover { color: var(--practiq-violet-dark); }

  .assignment-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: transparent;
    box-shadow: none;
    margin-bottom: var(--space-4);
  }

  .field-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-2);
  }

  .submit-btn {
    align-self: flex-start;
  }

  .assignment-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .assignment-item {
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .assignment-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3);
    cursor: pointer;
  }

  .assignment-title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }

  .assignment-meta {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: 2px;
  }

  .submissions-panel {
    border-top: 1px solid var(--surface-border);
    padding: var(--space-3);
  }

  .submission-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .submission-item {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-hover);
  }

  .submission-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-1);
  }

  .submission-user {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
  }

  .submission-status {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
  }

  .submission-status--graded {
    color: var(--color-success-dark);
  }

  .submission-content {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
    white-space: pre-wrap;
  }

  .grade-form {
    display: flex;
    gap: var(--space-2);
  }

  .grade-score {
    width: 80px;
  }

  .grade-feedback {
    flex: 1;
  }

  .forum-section-wrap { margin-top: var(--space-6); }

  @media (max-width: 640px) {
    .course-detail { max-width: none; }
    .course-head { align-items: flex-start; flex-direction: column; }
    .course-head :deep(.p-select) { width: 100%; }
    .workspace-section { padding: var(--space-4); }
    .course-nav { margin-inline: calc(var(--space-1) * -1); border-inline: 0; border-radius: 0; }
    .enroll-form, .grade-form, .field-row { grid-template-columns: 1fr; flex-direction: column; }
    .enroll-form :deep(.p-button), .grade-form :deep(.p-button), .inline-form :deep(.p-button) { width: 100%; }
    .inline-form { flex-direction: column; }
    .course-label-form { width: 100%; }
    .course-label-form :deep(.p-inputtext) { flex: 1; width: auto; }
  }
</style>
