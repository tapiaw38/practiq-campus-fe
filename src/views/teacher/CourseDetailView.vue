<script setup lang="ts">
  import { computed, onMounted, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import StateMessage from "@/components/ui/StateMessage.vue";
  import { formatDateTime } from "@/utils/datetime";
  import { useCourses } from "@/composables/useCourses";
  import { useEnrollments } from "@/composables/useEnrollments";
  import { usePractiqStudents } from "@/composables/usePractiqStudents";
  import { useCourseSections } from "@/composables/useCourseSections";
  import { useAssignments } from "@/composables/useAssignments";
  import { useCourseMaterials } from "@/composables/useCourseMaterials";
  import { useRubric } from "@/composables/useRubric";
  import { useMessages } from "@/composables/useMessages";
  import { useQuizzes } from "@/composables/useQuizzes";
  import { useQuizAttempts } from "@/composables/useQuizAttempts";
  import { useCourseGroups } from "@/composables/useCourseGroups";
  import ForumSection from "@/components/forum/ForumSection.vue";
  import CourseMaterials from "@/components/course/CourseMaterials.vue";
  import type { Assignment, CourseStatus } from "@/types";
  import type { Quiz, QuizQuestionType } from "@/types/quiz";
  import type { QuestionParams } from "@/services/quizzes/quizService";

  const route = useRoute();
  const router = useRouter();
  const courseId = route.params.id as string;
  const courseTabs = ["alumnos", "contenido", "materiales", "tareas", "evaluaciones", "foro"] as const;
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
  const courseGroups = useCourseGroups();
  const groupFilter = ref("all");
  const newGroupName = ref("");
  const creatingGroup = ref(false);
  const addMemberDrafts = ref<Record<string, string>>({});
  const filteredEnrollments = computed(() => {
    if (groupFilter.value === "all") return courseEnrollments.value;
    const group = courseGroups.groups.value.find((g) => g.id === groupFilter.value);
    if (!group) return courseEnrollments.value;
    return courseEnrollments.value.filter((e) => group.member_ids.includes(e.user_id));
  });
  function enrollmentName(userId: string) {
    return courseEnrollments.value.find((e) => e.user_id === userId)?.user_name || userId;
  }
  function unassignedEnrollments(groupId: string) {
    const group = courseGroups.groups.value.find((g) => g.id === groupId);
    if (!group) return [];
    return courseEnrollments.value.filter((e) => !group.member_ids.includes(e.user_id));
  }
  async function handleCreateGroup() {
    if (!newGroupName.value.trim() || creatingGroup.value) return;
    creatingGroup.value = true;
    try {
      await courseGroups.createGroup(courseId, newGroupName.value.trim());
      newGroupName.value = "";
    } catch {
      // useCourseGroups already surfaced the error via toast
    } finally {
      creatingGroup.value = false;
    }
  }
  async function handleAddMember(groupId: string) {
    const userId = addMemberDrafts.value[groupId];
    if (!userId) return;
    await courseGroups.addMember(groupId, userId);
    addMemberDrafts.value[groupId] = "";
  }

  const { sections, loadSections, createSection, updateSection, deleteSection } = useCourseSections();
  const { assignments, loadAssignments, createAssignment, updateAssignment, deleteAssignment } = useAssignments();
  const { createMaterial, uploadMaterial } = useCourseMaterials();
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
  const newSectionDescription = ref("");
  const creatingSection = ref(false);
  const editingSectionId = ref<string | null>(null);
  const editingSectionTitle = ref("");
  const editingSectionDescription = ref("");

  const newAssignment = ref({
    title: "",
    description: "",
    dueAt: null as Date | null,
    maxScore: "100",
    sectionId: "",
    weight: "100",
    visibleGroupId: "",
    unlockAfter: "",
  });
  const newAttachment = ref({ mode: "file" as "file" | "link", title: "", linkURL: "" });
  const newAttachmentFile = ref<File | null>(null);
  const creatingAssignment = ref(false);
  const editingAssignmentId = ref<string | null>(null);
  const editingAssignment = ref({ title: "", description: "", dueAt: "", maxScore: "100", sectionId: "", weight: "100", visibleGroupId: "", unlockAfter: "" });
  const assignmentToDelete = ref<{ id: string; title: string } | null>(null);
  const rubric = useRubric();
  const rubricDrafts = ref<Record<string, { title: string; description: string; max_score: number }[]>>({});
  const rubricOpen = ref<string | null>(null);

  const quizzes = useQuizzes();
  const quizAttempts = useQuizAttempts();
  const QUESTION_TYPES: { label: string; value: QuizQuestionType }[] = [
    { label: "Opción múltiple", value: "multiple_choice" },
    { label: "Verdadero/Falso", value: "true_false" },
    { label: "Completar espacios", value: "fill_blanks" },
  ];
  const newQuiz = ref({ title: "", description: "", maxAttempts: "1", timeLimitMin: "", sectionId: "", weight: "100", visibleGroupId: "", unlockAfter: "" });
  const creatingQuiz = ref(false);
  const editingQuizId = ref<string | null>(null);
  const editingQuiz = ref({ title: "", description: "", maxAttempts: "1", timeLimitMin: "", sectionId: "", weight: "100", visibleGroupId: "", unlockAfter: "" });
  const quizToDelete = ref<Quiz | null>(null);
  const questionsOpen = ref<string | null>(null);
  const questionDrafts = ref<Record<string, QuestionParams[]>>({});
  const attemptsOpen = ref<string | null>(null);

  async function handleCreateQuiz() {
    if (!newQuiz.value.title.trim() || creatingQuiz.value) return;
    creatingQuiz.value = true;
    try {
      await quizzes.createQuiz(courseId, {
        title: newQuiz.value.title.trim(),
        description: newQuiz.value.description,
        max_attempts: Number(newQuiz.value.maxAttempts) || 1,
        time_limit_secs: newQuiz.value.timeLimitMin ? Number(newQuiz.value.timeLimitMin) * 60 : null,
        section_id: newQuiz.value.sectionId || null,
        weight: Number(newQuiz.value.weight) || 100,
        visible_group_id: newQuiz.value.visibleGroupId || null,
        ...parseUnlockAfter(newQuiz.value.unlockAfter),
      });
      newQuiz.value = { title: "", description: "", maxAttempts: "1", timeLimitMin: "", sectionId: "", weight: "100", visibleGroupId: "", unlockAfter: "" };
    } catch {
      // useQuizzes already surfaced the error via toast
    } finally {
      creatingQuiz.value = false;
    }
  }

  function beginEditQuiz(quiz: Quiz) {
    editingQuizId.value = quiz.id;
    editingQuiz.value = { title: quiz.title, description: quiz.description, maxAttempts: String(quiz.max_attempts), timeLimitMin: quiz.time_limit_secs ? String(Math.round(quiz.time_limit_secs / 60)) : "", sectionId: quiz.section_id || "", weight: String(quiz.weight), visibleGroupId: quiz.visible_group_id || "", unlockAfter: unlockAfterValue(quiz.unlock_after_type, quiz.unlock_after_id) };
  }
  async function saveQuiz() {
    if (!editingQuizId.value || !editingQuiz.value.title.trim()) return;
    await quizzes.updateQuiz(editingQuizId.value, {
      title: editingQuiz.value.title.trim(),
      description: editingQuiz.value.description,
      max_attempts: Number(editingQuiz.value.maxAttempts) || 1,
      time_limit_secs: editingQuiz.value.timeLimitMin ? Number(editingQuiz.value.timeLimitMin) * 60 : null,
      section_id: editingQuiz.value.sectionId || null,
      weight: Number(editingQuiz.value.weight) || 100,
      visible_group_id: editingQuiz.value.visibleGroupId || null,
      ...parseUnlockAfter(editingQuiz.value.unlockAfter),
    });
    editingQuizId.value = null;
  }
  async function confirmDeleteQuiz() {
    if (!quizToDelete.value) return;
    await quizzes.deleteQuiz(quizToDelete.value.id);
    quizToDelete.value = null;
  }

  function blankIds(statement: string): string[] {
    return [...new Set([...statement.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => m[1]))];
  }
  function insertBlank(question: QuestionParams) {
    const next = blankIds(question.statement).length + 1;
    const trimmed = question.statement.trimEnd();
    question.statement = (trimmed ? trimmed + " " : "") + `{{${next}}}`;
  }
  async function openQuestions(quiz: Quiz) {
    const list = await quizzes.loadQuestions(quiz.id);
    questionDrafts.value[quiz.id] = list.length
      ? list.map((q) => ({ type: q.type, statement: q.statement, options: q.options, correct_answer: q.correct_answer, points: q.points }))
      : [];
    questionsOpen.value = quiz.id;
  }
  function addQuestion(quizId: string) {
    (questionDrafts.value[quizId] ||= []).push({ type: "multiple_choice", statement: "", options: ["", ""], correct_answer: "", points: 1 });
  }
  function changeQuestionType(question: QuestionParams, type: QuizQuestionType) {
    question.type = type;
    question.correct_answer = type === "true_false" ? "true" : type === "fill_blanks" ? "{}" : "";
    question.options = type === "multiple_choice" ? ["", ""] : [];
  }
  function addOption(question: QuestionParams) { question.options.push(""); }
  function removeOption(question: QuestionParams, index: number) {
    question.options.splice(index, 1);
    if (question.correct_answer && !question.options.includes(question.correct_answer)) question.correct_answer = "";
  }
  function normalizeOptions(question: QuestionParams) { question.options = question.options.map((option) => option.trim()).filter(Boolean); if (question.correct_answer && !question.options.includes(question.correct_answer)) question.correct_answer = ""; }
  function questionError(question: QuestionParams): string {
    if (!question.statement.trim()) return "Falta el enunciado.";
    if (question.type === "multiple_choice" && (question.options.length < 2 || question.options.some((option) => !option.trim()) || !question.options.includes(question.correct_answer))) return "Agregá dos opciones válidas y elegí una correcta.";
    if (question.type === "fill_blanks" && (!blankIds(question.statement).length || blankIds(question.statement).some((id) => !blankAnswer(question, id).trim()))) return "Indicá {{1}}, {{2}}… y completá cada respuesta.";
    return "";
  }
  function removeQuestion(quizId: string, index: number) {
    questionDrafts.value[quizId]?.splice(index, 1);
  }
  function setBlankAnswer(question: QuestionParams, id: string, value: string) {
    const answers = JSON.parse(question.correct_answer || "{}");
    answers[id] = value;
    question.correct_answer = JSON.stringify(answers);
  }
  function blankAnswer(question: QuestionParams, id: string): string {
    try { return JSON.parse(question.correct_answer || "{}")[id] || ""; } catch { return ""; }
  }
  async function saveQuestionsFor(quizId: string) {
    if ((questionDrafts.value[quizId] || []).some((question) => questionError(question))) return;
    try {
      await quizzes.saveQuestions(quizId, questionDrafts.value[quizId] || []);
      questionsOpen.value = null;
    } catch {
      // useQuizzes already surfaced the error via toast
    }
  }

  async function openAttempts(quiz: Quiz) {
    await quizAttempts.loadAttemptsByQuiz(quiz.id);
    attemptsOpen.value = quiz.id;
  }


  function beginEditSection(section: { id: string; title: string; description: string }) { editingSectionId.value = section.id; editingSectionTitle.value = section.title; editingSectionDescription.value = section.description; }
  async function saveSection() { if (!editingSectionId.value || !editingSectionTitle.value.trim()) return; await updateSection(courseId, editingSectionId.value, editingSectionTitle.value.trim(), editingSectionDescription.value); editingSectionId.value = null; }

  // A "Tarea: X" / "Evaluación: Y" prerequisite picker shared by the
  // assignment and quiz forms — a composite "type:id" string is simplest to
  // bind to a single Select, split back into the two fields the API wants
  // on save.
  function unlockOptions(excludeType?: string, excludeId?: string) {
    const opts: { label: string; value: string }[] = [{ label: "Sin requisito", value: "" }];
    for (const a of assignments.value) {
      if (excludeType === "assignment" && excludeId === a.id) continue;
      opts.push({ label: `Tarea: ${a.title}`, value: `assignment:${a.id}` });
    }
    for (const q of quizzes.quizzes.value) {
      if (excludeType === "quiz" && excludeId === q.id) continue;
      opts.push({ label: `Evaluación: ${q.title}`, value: `quiz:${q.id}` });
    }
    return opts;
  }
  function parseUnlockAfter(value: string): { unlock_after_type: "assignment" | "quiz" | null; unlock_after_id: string | null } {
    if (!value) return { unlock_after_type: null, unlock_after_id: null };
    const [type, id] = value.split(":");
    return { unlock_after_type: type as "assignment" | "quiz", unlock_after_id: id };
  }
  function unlockAfterValue(type: string | null, id: string | null) {
    return type && id ? `${type}:${id}` : "";
  }

  function beginEditAssignment(assignment: Assignment) {
    editingAssignmentId.value = assignment.id;
    editingAssignment.value = { title: assignment.title, description: assignment.description, dueAt: assignment.due_at ? assignment.due_at.slice(0, 16) : "", maxScore: String(assignment.max_score), sectionId: assignment.section_id || "", weight: String(assignment.weight), visibleGroupId: assignment.visible_group_id || "", unlockAfter: unlockAfterValue(assignment.unlock_after_type, assignment.unlock_after_id) };
  }
  async function editRubric(id: string) { await rubric.load(id); rubricDrafts.value[id] = rubric.criteria.value.map((x) => ({ title: x.title, description: x.description, max_score: x.max_score })); rubricOpen.value = id; }
  function addCriterion(id: string) { (rubricDrafts.value[id] ||= []).push({ title: "", description: "", max_score: 1 }); }
  async function saveRubric(id: string, max: number) { const list = rubricDrafts.value[id] || []; if (list.reduce((s, x) => s + Number(x.max_score), 0) !== max) return; await rubric.save(id, list); rubricOpen.value = null; }
  async function saveAssignment() {
    const item = assignments.value.find((a) => a.id === editingAssignmentId.value);
    if (!item || !editingAssignment.value.title.trim()) return;
    await updateAssignment(courseId, item.id, { title: editingAssignment.value.title.trim(), description: editingAssignment.value.description, due_at: editingAssignment.value.dueAt ? new Date(editingAssignment.value.dueAt).toISOString() : undefined, max_score: Number(editingAssignment.value.maxScore), section_id: editingAssignment.value.sectionId || null, weight: Number(editingAssignment.value.weight) || 100, visible_group_id: editingAssignment.value.visibleGroupId || null, ...parseUnlockAfter(editingAssignment.value.unlockAfter) });
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
    courseGroups.load(courseId);
    loadPractiqStudents();
    loadSections(courseId);
    loadAssignments(courseId);
    quizzes.loadQuizzes(courseId);
  });

  function pickPractiqStudent(email: string) {
    newStudentEmail.value = email;
  }

  async function handleCreateSection() {
    if (!newSectionTitle.value.trim() || creatingSection.value) return;
    creatingSection.value = true;
    try {
      await createSection(courseId, newSectionTitle.value.trim(), newSectionDescription.value);
      newSectionTitle.value = "";
      newSectionDescription.value = "";
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
        weight: Number(newAssignment.value.weight) || 100,
        visible_group_id: newAssignment.value.visibleGroupId || null,
        ...parseUnlockAfter(newAssignment.value.unlockAfter),
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
      newAssignment.value = { title: "", description: "", dueAt: null, maxScore: "100", sectionId: "", weight: "100", visibleGroupId: "", unlockAfter: "" };
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
          <button type="button" :class="{ active: activeCourseTab === 'evaluaciones' }" :aria-pressed="activeCourseTab === 'evaluaciones'" @click="activeCourseTab = 'evaluaciones'"><i class="pi pi-verified" aria-hidden="true" /> Evaluaciones <span v-if="quizzes.quizzes.value.length">{{ quizzes.quizzes.value.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'foro' }" :aria-pressed="activeCourseTab === 'foro'" @click="activeCourseTab = 'foro'"><i class="pi pi-comments" aria-hidden="true" /> Foro</button>
        </nav>

        <section v-if="activeCourseTab === 'alumnos'" class="enrollments-section workspace-section">
          <div class="section-heading">
            <div><h2>Alumnos</h2><p>Matriculá, revisá participantes y enviá avisos.</p></div>
            <span v-if="courseEnrollments.length" class="section-count">{{ courseEnrollments.length }}</span>
          </div>

          <details class="create-disclosure">
            <summary><i class="pi pi-sitemap" /> Grupos</summary>
            <div class="disclosure-body">
              <form class="enroll-form" @submit.prevent="handleCreateGroup">
                <InputText v-model="newGroupName" placeholder="Nombre del grupo (ej.: Comisión A)" class="enroll-input" />
                <Button type="submit" label="Crear grupo" :loading="creatingGroup" size="small" />
              </form>
              <ul v-if="courseGroups.groups.value.length" class="group-list">
                <li v-for="group in courseGroups.groups.value" :key="group.id" class="group-item">
                  <div class="group-item-head">
                    <strong>{{ group.name }}</strong>
                    <button type="button" class="remove-btn" title="Eliminar grupo" @click="courseGroups.deleteGroup(group.id)"><i class="pi pi-trash" /></button>
                  </div>
                  <div v-if="group.member_ids.length" class="group-members">
                    <span v-for="userId in group.member_ids" :key="userId" class="group-member-chip">{{ enrollmentName(userId) }} <button type="button" @click="courseGroups.removeMember(group.id, userId)"><i class="pi pi-times" /></button></span>
                  </div>
                  <div v-if="unassignedEnrollments(group.id).length" class="field-row">
                    <Select v-model="addMemberDrafts[group.id]" :options="unassignedEnrollments(group.id)" option-label="user_name" option-value="user_id" placeholder="Agregar alumno…" />
                    <Button type="button" label="Agregar" size="small" @click="handleAddMember(group.id)" />
                  </div>
                </li>
              </ul>
            </div>
          </details>

          <div v-if="courseGroups.groups.value.length" class="group-filter">
            <span>Filtrar por grupo:</span>
            <Select v-model="groupFilter" :options="[{ id: 'all', name: 'Todos' }, ...courseGroups.groups.value]" option-label="name" option-value="id" />
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
              v-for="enrollment in filteredEnrollments"
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
              <Textarea v-model="newSectionDescription" rows="2" placeholder="Contenido de la sección (opcional)" />
              <Button type="submit" label="Agregar" :loading="creatingSection" size="small" class="submit-btn" />
            </form>
          </details>
          <ul v-if="sections.length" class="section-list">
            <li v-for="section in sections" :key="section.id" class="section-chip">
              <template v-if="editingSectionId === section.id">
                <div class="section-edit">
                  <InputText v-model="editingSectionTitle" size="small" placeholder="Título" />
                  <Textarea v-model="editingSectionDescription" rows="2" placeholder="Contenido de la sección (opcional)" />
                  <div class="edit-actions"><Button type="button" label="Guardar" size="small" @click="saveSection" /><Button type="button" label="Cancelar" text size="small" @click="editingSectionId = null" /></div>
                </div>
              </template>
              <template v-else>
                <div class="section-chip-main">
                  <strong>{{ section.title }}</strong>
                  <p v-if="section.description" class="section-chip-description">{{ section.description }}</p>
                </div>
                <span class="item-actions"><button type="button" class="item-action" title="Editar" @click="beginEditSection(section)"><i class="pi pi-pencil" /></button><button type="button" class="item-action" title="Eliminar" @click="deleteSection(courseId, section.id)"><i class="pi pi-trash" /></button></span>
              </template>
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
            <details class="advanced-disclosure">
              <summary>Avanzado: peso, visibilidad, requisito</summary>
              <div class="advanced-body">
                <label>Peso en el promedio<InputText v-model="newAssignment.weight" type="number" min="1" placeholder="100" /></label>
                <label>Visible solo para<Select v-model="newAssignment.visibleGroupId" :options="[{ id: '', name: 'Todo el curso' }, ...courseGroups.groups.value]" option-label="name" option-value="id" /></label>
                <label>Se desbloquea después de<Select v-model="newAssignment.unlockAfter" :options="unlockOptions()" option-label="label" option-value="value" /></label>
              </div>
            </details>
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
                    <details class="advanced-disclosure">
                      <summary>Avanzado: peso, visibilidad, requisito</summary>
                      <div class="advanced-body">
                        <label>Peso en el promedio<InputText v-model="editingAssignment.weight" type="number" min="1" placeholder="100" /></label>
                        <label>Visible solo para<Select v-model="editingAssignment.visibleGroupId" :options="[{ id: '', name: 'Todo el curso' }, ...courseGroups.groups.value]" option-label="name" option-value="id" /></label>
                        <label>Se desbloquea después de<Select v-model="editingAssignment.unlockAfter" :options="unlockOptions('assignment', assignment.id)" option-label="label" option-value="value" /></label>
                      </div>
                    </details>
                    <div class="edit-actions"><Button type="button" label="Guardar" size="small" @click="saveAssignment" /><Button type="button" label="Cancelar" text size="small" @click="editingAssignmentId = null" /></div>
                  </div>
                  <div v-else class="assignment-title">{{ assignment.title }}</div>
                  <div class="assignment-meta">
                    <span v-if="sectionTitle(assignment.section_id)">
                      {{ sectionTitle(assignment.section_id) }} ·
                    </span>
                    <span v-if="assignment.due_at">
                      vence {{ formatDateTime(assignment.due_at) }} ·
                    </span>
                    <span>máx. {{ assignment.max_score }}</span>
                    <span v-if="assignment.weight !== 100"> · peso {{ assignment.weight }}</span>
                    <span v-if="assignment.visible_group_id" class="meta-flag"><i class="pi pi-users" /> {{ courseGroups.groups.value.find((g) => g.id === assignment.visible_group_id)?.name || "grupo" }}</span>
                    <span v-if="assignment.unlock_after_id" class="meta-flag"><i class="pi pi-lock" /> requiere requisito</span>
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

            </li>
          </ul>
        </section>

        <Dialog :visible="!!assignmentToDelete" modal header="Eliminar tarea" :style="{ width: 'min(420px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible) assignmentToDelete = null; }">
          <p>Vas a eliminar <strong>{{ assignmentToDelete?.title }}</strong>, sus adjuntos, rúbrica y entregas.</p>
          <small>Esta acción no se puede deshacer.</small>
          <div class="dialog-actions"><Button label="Cancelar" text severity="secondary" @click="assignmentToDelete = null" /><Button label="Eliminar tarea" severity="danger" @click="confirmDeleteAssignment" /></div>
        </Dialog>

        <section v-if="activeCourseTab === 'evaluaciones'" class="quizzes-section workspace-section">
          <div class="section-heading">
            <div><h2>Evaluaciones</h2><p>Corrección automática — opción múltiple, verdadero/falso y completar espacios.</p></div>
            <span v-if="quizzes.quizzes.value.length" class="section-count">{{ quizzes.quizzes.value.length }}</span>
          </div>

          <details class="create-disclosure">
            <summary><i class="pi pi-plus" /> Nueva evaluación</summary>
            <div class="disclosure-body">
              <form class="quiz-form" @submit.prevent="handleCreateQuiz">
                <InputText v-model="newQuiz.title" placeholder="Título" required />
                <Textarea v-model="newQuiz.description" rows="2" placeholder="Descripción (opcional)" />
                <div class="field-row">
                  <InputText v-model="newQuiz.maxAttempts" type="number" min="0" placeholder="Intentos permitidos (0 = ilimitado)" />
                  <InputText v-model="newQuiz.timeLimitMin" type="number" min="1" placeholder="Límite en minutos (opcional)" />
                </div>
                <Select v-model="newQuiz.sectionId" :options="[{ id: '', title: 'Sin sección' }, ...sections]" option-label="title" option-value="id" placeholder="Sección (opcional)" />
                <details class="advanced-disclosure">
                  <summary>Avanzado: peso, visibilidad, requisito</summary>
                  <div class="advanced-body">
                    <label>Peso en el promedio<InputText v-model="newQuiz.weight" type="number" min="1" placeholder="100" /></label>
                    <label>Visible solo para<Select v-model="newQuiz.visibleGroupId" :options="[{ id: '', name: 'Todo el curso' }, ...courseGroups.groups.value]" option-label="name" option-value="id" /></label>
                    <label>Se desbloquea después de<Select v-model="newQuiz.unlockAfter" :options="unlockOptions()" option-label="label" option-value="value" /></label>
                  </div>
                </details>
                <Button type="submit" label="Crear evaluación" :loading="creatingQuiz" size="small" class="submit-btn" />
              </form>
            </div>
          </details>

          <StateMessage
            v-if="!quizzes.quizzes.value.length"
            dense
            icon="pi-verified"
            title="Todavía no hay evaluaciones"
            description="Creá una evaluación y sumá preguntas para que tus alumnos las resuelvan."
          />
          <ul v-else class="assignment-list">
            <li v-for="quiz in quizzes.quizzes.value" :key="quiz.id" class="assignment-item">
              <div class="assignment-head">
                <div>
                  <div v-if="editingQuizId === quiz.id" class="assignment-edit" @click.stop>
                    <InputText v-model="editingQuiz.title" size="small" placeholder="Título" />
                    <Textarea v-model="editingQuiz.description" rows="2" placeholder="Descripción" />
                    <div class="field-row"><InputText v-model="editingQuiz.maxAttempts" type="number" min="0" placeholder="Intentos" /><InputText v-model="editingQuiz.timeLimitMin" type="number" min="1" placeholder="Minutos" /></div>
                    <Select v-model="editingQuiz.sectionId" :options="[{ id: '', title: 'Sin sección' }, ...sections]" option-label="title" option-value="id" placeholder="Sección (opcional)" />
                    <details class="advanced-disclosure">
                      <summary>Avanzado: peso, visibilidad, requisito</summary>
                      <div class="advanced-body">
                        <label>Peso en el promedio<InputText v-model="editingQuiz.weight" type="number" min="1" placeholder="100" /></label>
                        <label>Visible solo para<Select v-model="editingQuiz.visibleGroupId" :options="[{ id: '', name: 'Todo el curso' }, ...courseGroups.groups.value]" option-label="name" option-value="id" /></label>
                        <label>Se desbloquea después de<Select v-model="editingQuiz.unlockAfter" :options="unlockOptions('quiz', quiz.id)" option-label="label" option-value="value" /></label>
                      </div>
                    </details>
                    <div class="edit-actions"><Button type="button" label="Guardar" size="small" @click="saveQuiz" /><Button type="button" label="Cancelar" text size="small" @click="editingQuizId = null" /></div>
                  </div>
                  <div v-else><div class="assignment-title">{{ quiz.title }}</div><p v-if="quiz.description" class="quiz-description">{{ quiz.description }}</p></div>
                  <div class="quiz-metrics"><span v-if="sectionTitle(quiz.section_id)"><i class="pi pi-book" /> {{ sectionTitle(quiz.section_id) }}</span><span><i class="pi pi-list" /> {{ questionsOpen === quiz.id ? (questionDrafts[quiz.id]?.length ?? 0) : quiz.question_count }} preguntas</span><span><i class="pi pi-refresh" /> {{ quiz.max_attempts === 0 ? "Sin límite" : `${quiz.max_attempts} intento(s)` }}</span><span v-if="quiz.time_limit_secs"><i class="pi pi-clock" /> {{ Math.round(quiz.time_limit_secs / 60) }} min</span><span v-if="quiz.weight !== 100">peso {{ quiz.weight }}</span><span v-if="quiz.visible_group_id" class="meta-flag"><i class="pi pi-users" /> {{ courseGroups.groups.value.find((g) => g.id === quiz.visible_group_id)?.name || "grupo" }}</span><span v-if="quiz.unlock_after_id" class="meta-flag"><i class="pi pi-lock" /> requiere requisito</span></div>
                </div>
                <div class="quiz-actions"><Button type="button" label="Preguntas" icon="pi pi-list" size="small" outlined @click.stop="openQuestions(quiz)" /><Button type="button" label="Resultados" icon="pi pi-chart-bar" size="small" @click.stop="openAttempts(quiz)" /><button type="button" class="item-action" title="Editar evaluación" @click.stop="beginEditQuiz(quiz)"><i class="pi pi-pencil" /></button><button type="button" class="item-action" title="Eliminar evaluación" @click.stop="quizToDelete = quiz"><i class="pi pi-trash" /></button></div>
              </div>

              <div v-if="questionsOpen === quiz.id" class="question-editor">
                <div class="question-editor-head"><div><strong>Constructor de preguntas</strong><small>Definí tipo, puntaje, enunciado y respuesta correcta.</small></div><Button type="button" label="Cerrar" text size="small" icon="pi pi-times" @click="questionsOpen = null" /></div>
                <div v-for="(question, index) in questionDrafts[quiz.id] || []" :key="index" class="question-row">
                  <div class="question-row-head"><strong>Pregunta {{ index + 1 }}</strong><Button icon="pi pi-trash" text severity="danger" size="small" aria-label="Eliminar pregunta" @click="removeQuestion(quiz.id, index)" /></div>
                  <div class="question-settings">
                    <label>Tipo<Select :model-value="question.type" :options="QUESTION_TYPES" option-label="label" option-value="value" @update:model-value="changeQuestionType(question, $event as QuizQuestionType)" /></label>
                    <label>Puntos<InputText :model-value="String(question.points)" type="number" min="1" @update:model-value="question.points = Number($event)" /></label>
                  </div>
                  <label>Enunciado<Textarea v-model="question.statement" rows="3" :placeholder="question.type === 'fill_blanks' ? 'Escribí la consigna y usá el botón para marcar espacios' : 'Escribí la consigna para el alumno'" /></label>
                  <Button v-if="question.type === 'fill_blanks'" type="button" label="Agregar espacio" icon="pi pi-plus" text size="small" @click="insertBlank(question)" />
                  <div v-if="question.type === 'multiple_choice'" class="choice-builder"><label>Opciones</label><div v-for="(_, optionIndex) in question.options" :key="optionIndex" class="choice-row"><InputText v-model="question.options[optionIndex]" placeholder="Escribí una opción" @blur="normalizeOptions(question)" /><button type="button" class="item-action" title="Quitar opción" :disabled="question.options.length <= 2" @click="removeOption(question, optionIndex)"><i class="pi pi-times" /></button></div><Button type="button" label="Agregar opción" text size="small" icon="pi pi-plus" @click="addOption(question)" /><label>Respuesta correcta</label><div class="choice-chips"><button v-for="option in question.options.filter(Boolean)" :key="option" type="button" :class="{ selected: question.correct_answer === option }" @click="question.correct_answer = option"><i :class="question.correct_answer === option ? 'pi pi-check-circle' : 'pi pi-circle'" /> {{ option }}</button></div></div>
                  <label v-if="question.type === 'true_false'">Respuesta correcta<Select v-model="question.correct_answer" :options="[{ label: 'Verdadero', value: 'true' }, { label: 'Falso', value: 'false' }]" option-label="label" option-value="value" /></label>
                  <div v-else-if="question.type === 'fill_blanks'" class="field-row">
                    <div v-for="id in blankIds(question.statement)" :key="id" class="blank-field"><label>Espacio {{ id }}</label><InputText :model-value="blankAnswer(question, id)" @update:model-value="setBlankAnswer(question, id, $event as string)" /></div>
                  </div>
                  <small v-if="questionError(question)" class="question-error"><i class="pi pi-exclamation-circle" /> {{ questionError(question) }}</small>
                </div>
                <div class="question-editor-actions"><Button type="button" label="Agregar pregunta" icon="pi pi-plus" text size="small" @click="addQuestion(quiz.id)" /><Button type="button" label="Guardar preguntas" icon="pi pi-check" size="small" @click="saveQuestionsFor(quiz.id)" /></div>
              </div>

              <div v-if="attemptsOpen === quiz.id" class="rubric-editor">
                <strong>Intentos</strong>
                <StateMessage v-if="!quizAttempts.attemptsByQuiz.value[quiz.id]?.length" dense icon="pi-inbox" title="Nadie rindió esta evaluación todavía" />
                <ul v-else class="attempt-list">
                  <li v-for="attempt in quizAttempts.attemptsByQuiz.value[quiz.id]" :key="attempt.id">
                    <span>{{ attempt.user_name || attempt.user_id }} · intento {{ attempt.attempt_number }}</span>
                    <span v-if="attempt.submitted_at">{{ attempt.score }}/{{ attempt.max_score }}</span>
                    <span v-else class="attempt-pending">en curso</span>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </section>

        <Dialog :visible="!!quizToDelete" modal header="Eliminar evaluación" :style="{ width: 'min(420px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible) quizToDelete = null; }">
          <p>Vas a eliminar <strong>{{ quizToDelete?.title }}</strong>, sus preguntas e intentos.</p>
          <small>Esta acción no se puede deshacer.</small>
          <div class="dialog-actions"><Button label="Cancelar" text severity="secondary" @click="quizToDelete = null" /><Button label="Eliminar evaluación" severity="danger" @click="confirmDeleteQuiz" /></div>
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

  .course-nav { display: flex; gap: var(--space-2); overflow-x: auto; padding: var(--space-3); margin-bottom: var(--space-5); border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); box-shadow: var(--shadow-card); mask-image: linear-gradient(to right, transparent, black var(--space-3), black calc(100% - var(--space-3)), transparent); -webkit-mask-image: linear-gradient(to right, transparent, black var(--space-3), black calc(100% - var(--space-3)), transparent); }
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

  .group-list { display: flex; flex-direction: column; gap: var(--space-3); list-style: none; padding: 0; margin: var(--space-3) 0 0; }
  .group-item { padding: var(--space-3); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--surface-card); }
  .group-item-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
  .group-item-head strong { color: var(--text-heading); font-size: var(--text-sm); }
  .group-members { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-2); }
  .group-member-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 999px; background: var(--fill-primary-soft); color: var(--practiq-violet-dark); font-size: var(--text-xs); font-weight: 700; }
  .group-member-chip button { border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
  .group-filter { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); font-size: var(--text-xs); color: var(--text-secondary); font-weight: 700; }

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
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-chip {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--surface-hover);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
  }
  .section-chip-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .section-chip-main strong { color: var(--text-heading); font-size: var(--text-sm); }
  .section-chip-description { margin: 0; color: var(--text-muted); font-weight: 400; white-space: pre-wrap; }
  .section-edit { display: flex; flex-direction: column; gap: var(--space-2); width: 100%; }

  .advanced-disclosure { border: 1px dashed rgba(var(--surface-border-rgb), .8); border-radius: var(--radius-sm); background: var(--surface-hover); }
  .advanced-disclosure summary { padding: var(--space-2) var(--space-3); color: var(--text-secondary); font-size: var(--text-xs); font-weight: 700; cursor: pointer; list-style: none; }
  .advanced-disclosure summary::-webkit-details-marker { display: none; }
  .advanced-body { display: flex; flex-direction: column; gap: var(--space-2); padding: 0 var(--space-3) var(--space-3); }
  .advanced-body label { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-xs); color: var(--text-secondary); font-weight: 700; }
  .meta-flag { display: inline-flex; align-items: center; gap: 4px; }

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
  .question-editor { margin: var(--space-3); padding: var(--space-4); border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-hover); }
  .question-editor-head { display: flex; justify-content: space-between; gap: var(--space-3); align-items: flex-start; margin-bottom: var(--space-3); }
  .question-editor-head strong { display: block; color: var(--text-heading); }
  .question-editor-head small, .question-row label { color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; }
  .question-row { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-3); padding: var(--space-4); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); background: var(--surface-card); }
  .question-row-head { display: flex; align-items: center; justify-content: space-between; color: var(--text-heading); }
  .question-settings { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-2); }
  .question-row label { display: flex; flex-direction: column; gap: 5px; }
  .question-editor-actions { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-4); }
  .choice-builder { display: flex; flex-direction: column; gap: var(--space-2); }
  .choice-row { display: flex; align-items: center; gap: var(--space-1); }
  .choice-row :deep(.p-inputtext) { flex: 1; }
  .choice-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .choice-chips button { border: 1px solid var(--surface-border); border-radius: var(--radius-pill); padding: 6px 10px; background: var(--surface-card); color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; }
  .choice-chips button.selected { border-color: var(--practiq-violet-dark); background: var(--fill-primary-soft); color: var(--practiq-violet-dark); font-weight: 700; }
  .question-error { display: flex; align-items: center; gap: 5px; color: var(--color-error-dark); font-size: var(--text-xs); font-weight: 700; }
  .blank-field { display: flex; flex-direction: column; gap: 2px; font-size: var(--text-xs); color: var(--text-muted); }
  .attempt-list { display: flex; flex-direction: column; gap: var(--space-1); list-style: none; padding: 0; margin: 0; }
  .attempt-list li { display: flex; justify-content: space-between; padding: var(--space-1) 0; font-size: var(--text-sm); }
  .attempt-pending { color: var(--text-muted); font-style: italic; }

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

  .quiz-description { margin: 3px 0 0; color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.4; }
  .quiz-metrics { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
  .quiz-metrics span { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: var(--radius-pill); background: var(--surface-hover); color: var(--text-secondary); font-size: var(--text-xs); font-weight: 700; }
  .quiz-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-1); }

  .submissions-panel {
    border-top: 1px solid var(--surface-border);
    padding: var(--space-3);
  }

  .forum-section-wrap { margin-top: var(--space-6); }

  @media (max-width: 640px) {
    .course-detail { max-width: none; }
    .course-head { align-items: flex-start; flex-direction: column; }
    .course-head :deep(.p-select) { width: 100%; }
    .workspace-section { padding: var(--space-4); }
    .course-nav { margin-inline: calc(var(--space-1) * -1); border-inline: 0; border-radius: 0; }
    .enroll-form, .field-row { grid-template-columns: 1fr; flex-direction: column; }
    .enroll-form :deep(.p-button), .inline-form :deep(.p-button) { width: 100%; }
    .inline-form { flex-direction: column; }
    .course-label-form { width: 100%; }
    .course-label-form :deep(.p-inputtext) { flex: 1; width: auto; }
  }
</style>
