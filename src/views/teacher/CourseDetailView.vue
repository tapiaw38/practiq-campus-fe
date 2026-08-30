<script setup lang="ts">
  import { computed, onMounted, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import StateMessage from "@/components/ui/StateMessage.vue";
  import { useCourses } from "@/composables/useCourses";
  import { useEnrollments } from "@/composables/useEnrollments";
  import { usePractiqStudents } from "@/composables/usePractiqStudents";
  import { useCourseSections } from "@/composables/useCourseSections";
  import { useAssignments } from "@/composables/useAssignments";
  import { useCourseMaterials } from "@/composables/useCourseMaterials";
  import { useSubmissions } from "@/composables/useSubmissions";
  import { useRubric } from "@/composables/useRubric";
  import type { RubricCriterion } from "@/services/rubrics/rubricService";
  import { useMessages } from "@/composables/useMessages";
  import ForumSection from "@/components/forum/ForumSection.vue";
  import CourseMaterials from "@/components/course/CourseMaterials.vue";
  import type { CourseStatus, Submission } from "@/types";

  const route = useRoute();
  const router = useRouter();
  const courseId = route.params.id as string;
  const courseTabs = ["alumnos", "contenido", "materiales", "tareas", "foro"] as const;
  type CourseTab = (typeof courseTabs)[number];
  const requestedTab = route.query.tab as CourseTab;
  const activeCourseTab = ref<CourseTab>(courseTabs.includes(requestedTab) ? requestedTab : "alumnos");

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
  const { createMaterial, uploadMaterial } = useCourseMaterials();
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
    dueAt: null as Date | null,
    maxScore: "100",
    sectionId: "",
  });
  const newAttachment = ref({ mode: "file" as "file" | "link", title: "", linkURL: "" });
  const newAttachmentFile = ref<File | null>(null);
  const creatingAssignment = ref(false);
  const editingAssignmentId = ref<string | null>(null);
  const editingAssignment = ref({ title: "", description: "", dueAt: "", maxScore: "100", sectionId: "" });
  const assignmentToDelete = ref<{ id: string; title: string } | null>(null);
  const rubric = useRubric();
  const rubricDrafts = ref<Record<string, { title: string; description: string; max_score: number }[]>>({});
  const rubricOpen = ref<string | null>(null);

  const expandedAssignmentId = ref<string | null>(null);
  const gradingCriteria = ref<Record<string, RubricCriterion[]>>({});
  const gradeDrafts = ref<Record<string, { score: string; feedback: string; rubric_scores: Record<string, { score: string; feedback: string }> }>>({});

  function beginEditSection(section: { id: string; title: string }) { editingSectionId.value = section.id; editingSectionTitle.value = section.title; }
  async function saveSection() { if (!editingSectionId.value || !editingSectionTitle.value.trim()) return; await updateSection(courseId, editingSectionId.value, editingSectionTitle.value.trim()); editingSectionId.value = null; }
  function beginEditAssignment(assignment: { id: string; title: string; description: string; due_at: string | null; max_score: number; section_id: string | null }) {
    editingAssignmentId.value = assignment.id;
    editingAssignment.value = { title: assignment.title, description: assignment.description, dueAt: assignment.due_at ? assignment.due_at.slice(0, 16) : "", maxScore: String(assignment.max_score), sectionId: assignment.section_id || "" };
  }
  async function editRubric(id: string) { await rubric.load(id); rubricDrafts.value[id] = rubric.criteria.value.map((x) => ({ title: x.title, description: x.description, max_score: x.max_score })); rubricOpen.value = id; }
  function addCriterion(id: string) { (rubricDrafts.value[id] ||= []).push({ title: "", description: "", max_score: 1 }); }
  async function saveRubric(id: string, max: number) { const list = rubricDrafts.value[id] || []; if (list.reduce((s, x) => s + Number(x.max_score), 0) !== max) return; await rubric.save(id, list); rubricOpen.value = null; }
  async function saveAssignment() {
    const item = assignments.value.find((a) => a.id === editingAssignmentId.value);
    if (!item || !editingAssignment.value.title.trim()) return;
    await updateAssignment(courseId, item.id, { title: editingAssignment.value.title.trim(), description: editingAssignment.value.description, due_at: editingAssignment.value.dueAt ? new Date(editingAssignment.value.dueAt).toISOString() : undefined, max_score: Number(editingAssignment.value.maxScore), section_id: editingAssignment.value.sectionId || null });
    editingAssignmentId.value = null;
  }
  async function confirmDeleteAssignment() {
    if (!assignmentToDelete.value) return;
    await deleteAssignment(courseId, assignmentToDelete.value.id);
    assignmentToDelete.value = null;
  }

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
      const created = await createAssignment(courseId, {
        title: newAssignment.value.title.trim(),
        description: newAssignment.value.description,
        due_at: newAssignment.value.dueAt
          ? newAssignment.value.dueAt.toISOString()
          : undefined,
        max_score: Number(newAssignment.value.maxScore) || undefined,
        section_id: newAssignment.value.sectionId || null,
      });
      const hasAttachment = newAttachment.value.mode === "file" ? !!newAttachmentFile.value : !!newAttachment.value.linkURL.trim();
      if (hasAttachment) {
        const url = newAttachment.value.mode === "file"
          ? (await uploadMaterial(newAttachmentFile.value!)).url
          : newAttachment.value.linkURL.trim();
        await createMaterial(courseId, {
          assignment_id: created.id,
          title: newAttachment.value.title.trim() || (newAttachmentFile.value?.name.replace(/\.[^.]+$/, "") || "Adjunto de tarea"),
          kind: newAttachment.value.mode,
          url,
        });
      }
      newAssignment.value = { title: "", description: "", dueAt: null, maxScore: "100", sectionId: "" };
      newAttachment.value = { mode: "file", title: "", linkURL: "" };
      newAttachmentFile.value = null;
    } catch {
      // useAssignments already surfaced the error via toast
    } finally {
      creatingAssignment.value = false;
    }
  }

  function selectNewAttachment(event: Event) {
    const input = event.target as HTMLInputElement;
    newAttachmentFile.value = input.files?.[0] ?? null;
    if (!newAttachment.value.title && newAttachmentFile.value) newAttachment.value.title = newAttachmentFile.value.name.replace(/\.[^.]+$/, "");
  }

  async function toggleSubmissions(assignmentId: string) {
    if (expandedAssignmentId.value === assignmentId) {
      expandedAssignmentId.value = null;
      return;
    }
    expandedAssignmentId.value = assignmentId;
    await Promise.all([
      loadByAssignment(assignmentId),
      rubric.load(assignmentId).then(() => { gradingCriteria.value[assignmentId] = [...rubric.criteria.value]; }),
    ]);
  }

  function draftFor(submission: Submission, assignmentId: string) {
    if (!gradeDrafts.value[submission.id]) {
      const saved = new Map(submission.rubric_scores.map((score) => [score.criterion_id, score]));
      const rubricScores = Object.fromEntries((gradingCriteria.value[assignmentId] || []).map((criterion) => {
        const previous = saved.get(criterion.id || "");
        return [criterion.id || "", { score: previous ? String(previous.score) : "", feedback: previous?.feedback || "" }];
      }));
      gradeDrafts.value[submission.id] = { score: submission.score == null ? "" : String(submission.score), feedback: submission.feedback || "", rubric_scores: rubricScores };
    }
    return gradeDrafts.value[submission.id];
  }

  async function handleGrade(assignmentId: string, submissionId: string) {
    const submission = (submissionsByAssignment.value[assignmentId] || []).find((item) => item.id === submissionId);
    if (!submission) return;
    const draft = draftFor(submission, assignmentId);
    const criteria = gradingCriteria.value[assignmentId] || [];
    if (criteria.length) {
      const rubricScores = criteria.map((criterion) => ({ criterion_id: criterion.id || "", score: Number(draft.rubric_scores[criterion.id || ""]?.score), feedback: draft.rubric_scores[criterion.id || ""]?.feedback || "" }));
      if (rubricScores.some((item) => !Number.isInteger(item.score))) return;
      await grade(assignmentId, submissionId, 0, draft.feedback, rubricScores);
      return;
    }
    const score = Number(draft.score);
    if (!Number.isNaN(score)) await grade(assignmentId, submissionId, score, draft.feedback);
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
  // The status picker listed the raw API values — "draft", "published" — in an
  // otherwise Spanish screen.
  const COURSE_STATUS_OPTIONS = [
    { value: "draft", label: "Borrador" },
    { value: "published", label: "Publicado" },
    { value: "archived", label: "Archivado" },
  ];
</script>

<template>
  <TeacherLayout>
    <div class="course-detail">
      <button class="back-btn" type="button" @click="router.push('/teacher/dashboard')">
        <i class="pi pi-arrow-left"></i> Volver a mis cursos
      </button>

      <StateMessage
        v-if="courseLoading || !currentCourse"
        variant="loading"
        :rows="4"
        loading-label="Cargando curso"
      />
      <template v-else>
        <header class="course-head">
          <h1>{{ currentCourse.title }}</h1>
          <Select
            :model-value="currentCourse.status"
            :options="COURSE_STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            aria-label="Estado del curso"
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
          <button type="button" :class="{ active: activeCourseTab === 'alumnos' }" :aria-pressed="activeCourseTab === 'alumnos'" @click="activeCourseTab = 'alumnos'"><i class="pi pi-users" aria-hidden="true" /> Alumnos <span v-if="courseEnrollments.length">{{ courseEnrollments.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'contenido' }" :aria-pressed="activeCourseTab === 'contenido'" @click="activeCourseTab = 'contenido'"><i class="pi pi-book" aria-hidden="true" /> Secciones <span v-if="sections.length">{{ sections.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'materiales' }" :aria-pressed="activeCourseTab === 'materiales'" @click="activeCourseTab = 'materiales'"><i class="pi pi-folder-open" aria-hidden="true" /> Materiales</button>
          <button type="button" :class="{ active: activeCourseTab === 'tareas' }" :aria-pressed="activeCourseTab === 'tareas'" @click="activeCourseTab = 'tareas'"><i class="pi pi-check-square" aria-hidden="true" /> Tareas <span v-if="assignments.length">{{ assignments.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'foro' }" :aria-pressed="activeCourseTab === 'foro'" @click="activeCourseTab = 'foro'"><i class="pi pi-comments" aria-hidden="true" /> Foro</button>
        </nav>

        <section v-if="activeCourseTab === 'alumnos'" class="enrollments-section workspace-section">
          <div class="section-heading">
            <div><h2>Alumnos</h2><p>Matriculá, revisá participantes y enviá avisos.</p></div>
            <span v-if="courseEnrollments.length" class="section-count">{{ courseEnrollments.length }}</span>
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

          <StateMessage v-if="enrollmentsLoading" variant="loading" dense :rows="3" loading-label="Cargando alumnos" />
          <StateMessage
            v-else-if="!courseEnrollments.length"
            dense
            icon="pi-users"
            title="Nadie está matriculado todavía"
            description="Agregá alumnos por email desde el formulario de arriba."
          />
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
            <span v-if="sections.length" class="section-count">{{ sections.length }}</span>
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
            <span v-if="assignments.length" class="section-count">{{ assignments.length }}</span>
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
            <div class="task-attachment">
              <label>Adjunto opcional</label>
              <div class="attachment-mode"><button type="button" :class="{ active: newAttachment.mode === 'file' }" @click="newAttachment.mode = 'file'"><i class="pi pi-upload" /> Archivo</button><button type="button" :class="{ active: newAttachment.mode === 'link' }" @click="newAttachment.mode = 'link'"><i class="pi pi-link" /> Enlace</button></div>
              <InputText v-model="newAttachment.title" placeholder="Título adjunto (opcional)" />
              <input v-if="newAttachment.mode === 'file'" type="file" class="file-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt,image/*,audio/*,video/*" @change="selectNewAttachment" />
              <InputText v-else v-model="newAttachment.linkURL" type="url" placeholder="https://…" />
            </div>
            <div class="field-row">
              <label class="due-datetime">Fecha y hora<DatePicker v-model="newAssignment.dueAt" show-time hour-format="24" show-icon fluid date-format="dd/mm/yy" placeholder="Elegí fecha y hora" /></label>
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

          <StateMessage
            v-if="!assignments.length"
            dense
            icon="pi-file-edit"
            title="Todavía no hay tareas"
            description="Creá una tarea para que tus alumnos puedan entregar y recibir devoluciones."
          />
          <ul v-else class="assignment-list">
            <li v-for="assignment in assignments" :key="assignment.id" class="assignment-item">
              <div class="assignment-head">
                <div>
                  <div v-if="editingAssignmentId === assignment.id" class="assignment-edit" @click.stop>
                    <InputText v-model="editingAssignment.title" size="small" placeholder="Título" />
                    <Textarea v-model="editingAssignment.description" rows="2" placeholder="Descripción" />
                    <div class="field-row"><InputText v-model="editingAssignment.dueAt" type="datetime-local" /><InputText v-model="editingAssignment.maxScore" type="number" min="1" /></div>
                    <Select v-model="editingAssignment.sectionId" :options="[{ id: '', title: 'Sin sección' }, ...sections]" option-label="title" option-value="id" />
                    <div class="edit-actions"><Button type="button" label="Guardar" size="small" @click="saveAssignment" /><Button type="button" label="Cancelar" text size="small" @click="editingAssignmentId = null" /></div>
                  </div>
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
                <div class="item-actions"><button type="button" class="item-action" title="Ver entregas" @click="router.push(`/teacher/courses/${courseId}/assignments/${assignment.id}/submissions`)"><i class="pi pi-users" /></button><button type="button" class="item-action" title="Rúbrica" @click.stop="editRubric(assignment.id)"><i class="pi pi-list" /></button><button type="button" class="item-action" title="Editar" @click.stop="beginEditAssignment(assignment)"><i class="pi pi-pencil" /></button><button type="button" class="item-action" title="Eliminar" @click.stop="assignmentToDelete = assignment"><i class="pi pi-trash" /></button></div>
              </div>

              <div v-if="rubricOpen === assignment.id" class="rubric-editor">
                <strong>Rúbrica · {{ assignment.max_score }} puntos</strong>
                <div v-for="(criterion, index) in rubricDrafts[assignment.id] || []" :key="index" class="rubric-row"><InputText v-model="criterion.title" placeholder="Criterio" /><InputText v-model="criterion.description" placeholder="Descripción" /><InputText :model-value="String(criterion.max_score)" type="number" min="1" @update:model-value="criterion.max_score = Number($event)" /></div>
                <Button type="button" label="Agregar criterio" text size="small" @click="addCriterion(assignment.id)" /><Button type="button" label="Guardar rúbrica" size="small" @click="saveRubric(assignment.id, assignment.max_score)" />
              </div>

              <CourseMaterials :course-id="courseId" :assignment-id="assignment.id" :can-manage="true" />

              <div v-if="false" class="submissions-panel">
                <StateMessage v-if="submissionsLoading" variant="loading" dense :rows="2" loading-label="Cargando entregas" />
                <StateMessage
                  v-else-if="!(submissionsByAssignment[assignment.id] || []).length"
                  dense
                  icon="pi-inbox"
                  title="Nadie entregó todavía"
                />
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
                      <template v-if="(gradingCriteria[assignment.id] || []).length">
                        <div v-for="criterion in gradingCriteria[assignment.id]" :key="criterion.id" class="rubric-grade-row">
                          <strong>{{ criterion.title }} <small>/ {{ criterion.max_score }}</small></strong>
                          <InputText v-model="draftFor(submission, assignment.id).rubric_scores[criterion.id!].score" type="number" min="0" :max="criterion.max_score" placeholder="Puntos" class="grade-score" />
                          <InputText v-model="draftFor(submission, assignment.id).rubric_scores[criterion.id!].feedback" placeholder="Comentario por criterio" class="grade-feedback" />
                        </div>
                        <span class="rubric-total">Total automático: {{ (gradingCriteria[assignment.id] || []).reduce((total, criterion) => total + (Number(draftFor(submission, assignment.id).rubric_scores[criterion.id!]?.score) || 0), 0) }} / {{ assignment.max_score }}</span>
                      </template>
                      <InputText v-else v-model="draftFor(submission, assignment.id).score" type="number" placeholder="Nota" class="grade-score" />
                      <InputText
                        v-model="draftFor(submission, assignment.id).feedback"
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

        <Dialog :visible="!!assignmentToDelete" modal header="Eliminar tarea" :style="{ width: 'min(420px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible) assignmentToDelete = null; }">
          <p>Vas a eliminar <strong>{{ assignmentToDelete?.title }}</strong>, sus adjuntos, rúbrica y entregas.</p>
          <small>Esta acción no se puede deshacer.</small>
          <div class="dialog-actions"><Button label="Cancelar" text severity="secondary" @click="assignmentToDelete = null" /><Button label="Eliminar tarea" severity="danger" @click="confirmDeleteAssignment" /></div>
        </Dialog>

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
  .course-nav button:hover { background: var(--surface-hover); color: var(--text-primary); }
  .course-nav button.active { background: var(--fill-primary-soft); color: var(--practiq-violet-dark); }
  .course-nav button.active span { background: var(--surface-card); color: var(--practiq-violet-dark); }
  .course-nav span, .section-count { display: grid; min-width: 20px; height: 20px; padding: 0 5px; place-items: center; border-radius: var(--radius-pill); background: var(--surface-hover); color: var(--text-secondary); font-size: var(--text-xs); font-weight: 700; }

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
  .assignment-edit { display: flex; flex-direction: column; gap: var(--space-2); min-width: min(460px, 100%); }
  .edit-actions, .dialog-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
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
  .task-attachment { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); border: 1px dashed var(--surface-border); border-radius: var(--radius-sm); }
  .task-attachment label { color: var(--text-secondary); font-size: var(--text-xs); font-weight: 700; }
  .attachment-mode { display: flex; gap: var(--space-1); }
  .attachment-mode button { border: 0; border-radius: var(--radius-sm); background: transparent; padding: 6px 9px; color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; cursor: pointer; }
  .attachment-mode button.active { background: var(--fill-primary-soft); color: var(--practiq-violet-dark); }

  .field-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-2);
  }
  .due-datetime { display: flex; flex-direction: column; gap: 4px; color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; }

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

  .rubric-grade-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) 88px minmax(160px, 2fr);
    align-items: center;
    gap: var(--space-2);
    width: 100%;
  }

  .rubric-grade-row strong { font-size: var(--text-xs); color: var(--text-secondary); }
  .rubric-grade-row small, .rubric-total { color: var(--text-muted); font-size: var(--text-xs); }
  .rubric-total { width: 100%; font-weight: 700; }

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
