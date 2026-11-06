<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import StudentLayout from "@/layouts/StudentLayout.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import SubmissionBody from "@/components/ui/SubmissionBody.vue";
import { formatDateTime } from "@/utils/datetime";
import { useCourses } from "@/composables/useCourses";
import { useCourseSections } from "@/composables/useCourseSections";
import { useAssignments } from "@/composables/useAssignments";
import { useSubmissions } from "@/composables/useSubmissions";
import { useRubric } from "@/composables/useRubric";
import { useQuizzes } from "@/composables/useQuizzes";
import { useQuizAttempts } from "@/composables/useQuizAttempts";
import { campusApi } from "@/api/request/server";
import { useToast } from "primevue/usetoast";
import ForumSection from "@/components/forum/ForumSection.vue";
import CourseMaterials from "@/components/course/CourseMaterials.vue";
import type { Assignment } from "@/types";
import type { Quiz } from "@/types/quiz";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const courseId = computed(() => route.params.id as string);
const courseTabs = ["materials", "assignments", "quizzes", "forum"] as const;
type CourseTab = (typeof courseTabs)[number];
const requestedTab = route.query.tab as CourseTab;
const activeCourseTab = ref<CourseTab>(
    courseTabs.includes(requestedTab) ? requestedTab : "materials",
);

const { currentCourse, loading, loadCourse } = useCourses();
const { sections, loadSections } = useCourseSections();
const { assignments, loadAssignments } = useAssignments();
const { mySubmissions, mineStatus, loadMine, submit } = useSubmissions();
const rubric = useRubric();
const rubrics = ref<Record<string, typeof rubric.criteria.value>>({});

const submissionDrafts = ref<Record<string, string>>({});
const submitting = ref<Record<string, boolean>>({});
const resubmitting = ref<Record<string, boolean>>({});
const submissionFiles = ref<Record<string, File | null>>({});

const quizzes = useQuizzes();
const quizAttempts = useQuizAttempts();
const takingQuiz = ref<Quiz | null>(null);
const myAnswers = ref<Record<string, string>>({});
const blankAnswers = ref<Record<string, Record<string, string>>>({});
const submittingQuiz = ref(false);
const startingQuiz = ref(false);
const showQuizResults = ref(false);
const reviewingAttempt = ref<string | null>(null);

async function loadCourseData(id: string) {
    await loadCourse(id);
    await loadSections(id).catch(() => undefined);

    const [assignmentList, quizList] = await Promise.all([
        loadAssignments(id).catch(() => [] as Assignment[]),
        quizzes.loadQuizzes(id).catch(() => [] as Quiz[]),
    ]);

    await Promise.allSettled([
        ...assignmentList.map((a) => loadMine(a.id)),
        ...assignmentList.map(async (a) => {
            await rubric.load(a.id);
            rubrics.value[a.id] = [...rubric.criteria.value];
        }),
        ...quizList.map((q) => quizAttempts.loadMyAttempts(q.id)),
    ]);
}

async function refreshUnlocks() {
    const [assignmentList, quizList] = await Promise.all([
        loadAssignments(courseId.value).catch(() => [] as Assignment[]),
        quizzes.loadQuizzes(courseId.value).catch(() => [] as Quiz[]),
    ]);
    await Promise.allSettled(quizList.map((q) => quizAttempts.loadMyAttempts(q.id)));
    return { assignmentList, quizList };
}

onMounted(() => loadCourseData(courseId.value));

watch(courseId, (id) => {
    if (id) void loadCourseData(id);
});

function blankIds(statement: string): string[] {
    return [...statement.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => m[1]);
}
function attemptsUsed(quiz: Quiz) {
    return quizAttempts.myAttempts.value[quiz.id]?.length ?? 0;
}
function liveAttempt(quiz: Quiz) {
    const now = quizAttempts.serverNowMs();
    return (
        (quizAttempts.myAttempts.value[quiz.id] || []).find(
            (a) => !a.submitted_at && (!a.expires_at || new Date(a.expires_at).getTime() > now),
        ) ?? null
    );
}
function attemptsLabel(quiz: Quiz) {
    return quiz.max_attempts === 0
        ? `${attemptsUsed(quiz)} intentos realizados`
        : `${attemptsUsed(quiz)}/${quiz.max_attempts} intentos`;
}
function quizActionLabel(quiz: Quiz) {
    return liveAttempt(quiz) ? "Continuar" : "Comenzar";
}
function canAttempt(quiz: Quiz) {
    if (quiz.locked) return false;
    if (liveAttempt(quiz)) return true;
    if (
        quiz.available_until &&
        new Date(quiz.available_until).getTime() <= quizAttempts.serverNowMs()
    )
        return false;
    if (quiz.scheduled_at && new Date(quiz.scheduled_at).getTime() > quizAttempts.serverNowMs())
        return false;
    return quiz.max_attempts === 0 || attemptsUsed(quiz) < quiz.max_attempts;
}
function bestScore(quiz: Quiz) {
    const submitted = (quizAttempts.myAttempts.value[quiz.id] || []).filter((a) => a.submitted_at);
    if (!submitted.length) return null;
    const best = submitted.reduce((max, a) => (a.score > max.score ? a : max), submitted[0]);
    return `${best.score}/${best.max_score}`;
}

async function openQuiz(quiz: Quiz) {
    if (startingQuiz.value) return;
    startingQuiz.value = true;
    myAnswers.value = {};
    blankAnswers.value = {};
    showQuizResults.value = false;
    autoSubmitTries = 0;
    autoSubmitDone = false;
    try {
        await quizAttempts.start(quiz.id);
        restoreDraft();
        takingQuiz.value = quiz;
    } catch {
        takingQuiz.value = null;
    } finally {
        startingQuiz.value = false;
    }
    await quizAttempts.loadMyAttempts(quiz.id);
}
function closeQuiz() {
    flushDraft();
    takingQuiz.value = null;
}

function flushDraft() {
    const attemptId = quizAttempts.activeAttempt.value?.id;
    if (!attemptId || showQuizResults.value) return;
    if (draftTimer) {
        clearTimeout(draftTimer);
        draftTimer = null;
    }
    void quizAttempts.saveDraft(attemptId, currentAnswers());
}

function restoreDraft() {
    for (const question of quizAttempts.activeQuestions.value) {
        const stored = quizAttempts.savedAnswers.value[question.id];
        if (!stored) continue;
        if (question.type === "fill_blanks") {
            try {
                blankAnswers.value[question.id] = JSON.parse(stored) as Record<string, string>;
            } catch {}
        } else {
            myAnswers.value[question.id] = stored;
        }
    }
}

function currentAnswers() {
    return quizAttempts.activeQuestions.value.map((q) => ({
        question_id: q.id,
        answer_text:
            q.type === "fill_blanks"
                ? JSON.stringify(blankAnswers.value[q.id] || {})
                : myAnswers.value[q.id] || "",
    }));
}

let draftTimer: ReturnType<typeof setTimeout> | null = null;
function queueDraftSave() {
    const attemptId = quizAttempts.activeAttempt.value?.id;
    if (!attemptId || !takingQuiz.value || showQuizResults.value || timeIsUp.value) return;
    const answers = currentAnswers();
    quizAttempts.rememberLocally(attemptId, answers);
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
        void quizAttempts.saveDraft(attemptId, answers);
    }, 1200);
}

watch([myAnswers, blankAnswers], queueDraftSave, { deep: true, flush: "sync" });

const nowTick = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | null = null;
const AUTO_SUBMIT_TRIES = 3;
let autoSubmitTries = 0;
let autoSubmitDone = false;

const secondsLeft = computed(() => {
    const expiresAt = quizAttempts.activeAttempt.value?.expires_at;
    if (!expiresAt) return null;
    void nowTick.value;
    return Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - quizAttempts.serverNowMs()) / 1000),
    );
});

const remainingLabel = computed(() => {
    const left = secondsLeft.value;
    if (left === null) return null;
    const minutes = String(Math.floor(left / 60)).padStart(2, "0");
    const seconds = String(left % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
});

const timeIsUp = computed(() => secondsLeft.value === 0);

watch(
    () => !!takingQuiz.value && !showQuizResults.value && secondsLeft.value !== null,
    (needsTicking) => {
        if (tickTimer) {
            clearInterval(tickTimer);
            tickTimer = null;
        }
        if (!needsTicking) return;
        tickTimer = setInterval(() => {
            nowTick.value = Date.now();
            if (
                !autoSubmitDone &&
                autoSubmitTries < AUTO_SUBMIT_TRIES &&
                secondsLeft.value !== null &&
                secondsLeft.value <= 2 &&
                !submittingQuiz.value &&
                !showQuizResults.value
            ) {
                autoSubmitTries += 1;
                void submitQuiz()
                    .then(() => {
                        autoSubmitDone = true;
                    })
                    .catch(() => {});
            }
        }, 1000);
    },
    { immediate: true },
);

onUnmounted(() => {
    if (tickTimer) clearInterval(tickTimer);
    flushDraft();
    if (draftTimer) clearTimeout(draftTimer);
});
async function submitQuiz() {
    if (!quizAttempts.activeAttempt.value || submittingQuiz.value) return;
    submittingQuiz.value = true;
    if (draftTimer) {
        clearTimeout(draftTimer);
        draftTimer = null;
    }
    try {
        await quizAttempts.submit(quizAttempts.activeAttempt.value.id, currentAnswers());
        showQuizResults.value = true;
        if (takingQuiz.value) await quizAttempts.loadMyAttempts(takingQuiz.value.id);
        await refreshUnlocks();
    } finally {
        submittingQuiz.value = false;
    }
}

async function reviewAttempt(quiz: Quiz, attemptId: string) {
    if (reviewingAttempt.value) return;
    reviewingAttempt.value = attemptId;
    try {
        const { attempt, results } = await quizAttempts.getAttempt(attemptId);
        quizAttempts.activeAttempt.value = attempt;
        quizAttempts.lastResults.value = results;
        quizAttempts.activeQuestions.value = [];
        showQuizResults.value = true;
        takingQuiz.value = quiz;
    } catch {
        toast.add({ severity: "error", summary: "No pudimos abrir la revisión", life: 3000 });
    } finally {
        reviewingAttempt.value = null;
    }
}

function retryLoadMine(assignmentId: string) {
    void loadMine(assignmentId).catch(() => undefined);
}

function reviewableAttempt(quiz: Quiz) {
    const submitted = (quizAttempts.myAttempts.value[quiz.id] || []).filter((a) => a.submitted_at);
    if (!submitted.length) return null;
    return submitted.reduce(
        (latest, a) => (a.attempt_number > latest.attempt_number ? a : latest),
        submitted[0],
    );
}

function sectionTitle(sectionId: string | null) {
    if (!sectionId) return null;
    return sections.value.find((s) => s.id === sectionId)?.title ?? null;
}

async function handleSubmit(assignmentId: string) {
    let content = submissionDrafts.value[assignmentId]?.trim() || "";
    const file = submissionFiles.value[assignmentId];
    if ((!content && !file) || submitting.value[assignmentId]) return;
    submitting.value[assignmentId] = true;
    try {
        if (file) {
            const body = new FormData();
            body.append("folder", "submissions");
            body.append("file", file);
            const { data } = await campusApi.post<{ data: { url: string } }>("/uploads", body);
            content = `${content}${content ? "\n\n" : ""}Archivo adjunto: ${file.name}\n${data.data.url}`;
        }
        await submit(assignmentId, content);
        submissionDrafts.value[assignmentId] = "";
        submissionFiles.value[assignmentId] = null;
        resubmitting.value[assignmentId] = false;
        await refreshUnlocks();
    } catch {
    } finally {
        submitting.value[assignmentId] = false;
    }
}

function canResubmit(assignment: Assignment) {
    if (mySubmissions.value[assignment.id]?.graded_at) return false;
    return !assignment.due_at || new Date(assignment.due_at) > new Date();
}

function startResubmit(assignmentId: string) {
    submissionDrafts.value[assignmentId] = mySubmissions.value[assignmentId]?.content || "";
    resubmitting.value[assignmentId] = true;
}

function selectSubmissionFile(assignmentId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    submissionFiles.value[assignmentId] = input.files?.[0] ?? null;
}
function studentCourseStatus(status: string) {
    return status === "archived" ? "Finalizado" : "Activo";
}

const courseProgress = computed(() => {
    const total = assignments.value.length;
    let handedIn = 0;
    let gradedCount = 0;
    let ratioSum = 0;
    for (const assignment of assignments.value) {
        const submission = mySubmissions.value[assignment.id];
        if (!submission) continue;
        handedIn++;
        if (submission.status !== "graded" || submission.score == null || !assignment.max_score)
            continue;
        gradedCount++;
        ratioSum += submission.score / assignment.max_score;
    }
    return {
        total,
        handedIn,
        percent: total ? Math.round((handedIn / total) * 100) : 0,
        average: gradedCount ? Math.round((ratioSum / gradedCount) * 100) : null,
        pending: total - handedIn,
    };
});
</script>

<template>
    <StudentLayout>
        <div class="course-detail">
            <button class="back-btn" type="button" @click="router.push('/student/dashboard')">
                <i class="pi pi-arrow-left"></i> Volver a mis cursos
            </button>

            <StateMessage
                v-if="loading || !currentCourse"
                variant="loading"
                :rows="4"
                loading-label="Cargando curso"
            />
            <template v-else>
                <header class="course-head">
                    <div class="course-head-main">
                        <div class="course-head-top">
                            <span class="course-icon"
                                ><i class="pi pi-book" aria-hidden="true"></i
                            ></span>
                            <span class="course-status">{{
                                studentCourseStatus(currentCourse.status)
                            }}</span>
                        </div>
                        <h1>{{ currentCourse.title }}</h1>
                        <p v-if="currentCourse.description" class="course-description">
                            {{ currentCourse.description }}
                        </p>
                        <p v-else class="course-description course-description--empty">
                            El docente todavía no agregó una descripción.
                        </p>
                        <div v-if="currentCourse.labels?.length" class="course-labels">
                            <span v-for="label in currentCourse.labels" :key="label">{{
                                label
                            }}</span>
                        </div>
                    </div>
                    <div v-if="courseProgress.total" class="course-progress">
                        <div class="course-progress-head">
                            <span>Tu avance</span>
                            <span>{{ courseProgress.percent }}%</span>
                        </div>
                        <div class="course-progress-bar">
                            <span :style="{ width: `${courseProgress.percent}%` }"></span>
                        </div>
                        <div class="course-progress-stats">
                            <span
                                ><strong>{{
                                    courseProgress.average == null
                                        ? "—"
                                        : `${courseProgress.average}%`
                                }}</strong
                                >promedio</span
                            >
                            <span
                                ><strong :class="{ 'is-pending': courseProgress.pending }">{{
                                    courseProgress.pending
                                }}</strong
                                >pendientes</span
                            >
                        </div>
                    </div>
                </header>

                <nav class="course-nav" aria-label="Contenido del curso">
                    <button
                        type="button"
                        :class="{ active: activeCourseTab === 'materials' }"
                        :aria-pressed="activeCourseTab === 'materials'"
                        @click="activeCourseTab = 'materials'"
                    >
                        <i class="pi pi-folder-open" aria-hidden="true" /> Materiales
                    </button>
                    <button
                        type="button"
                        :class="{ active: activeCourseTab === 'assignments' }"
                        :aria-pressed="activeCourseTab === 'assignments'"
                        @click="activeCourseTab = 'assignments'"
                    >
                        <i class="pi pi-check-square" aria-hidden="true" /> Tareas
                        <span v-if="assignments.length">{{ assignments.length }}</span>
                    </button>
                    <button
                        type="button"
                        :class="{ active: activeCourseTab === 'quizzes' }"
                        :aria-pressed="activeCourseTab === 'quizzes'"
                        @click="activeCourseTab = 'quizzes'"
                    >
                        <i class="pi pi-verified" aria-hidden="true" /> Evaluaciones
                        <span v-if="quizzes.quizzes.value.length">{{
                            quizzes.quizzes.value.length
                        }}</span>
                    </button>
                    <button
                        type="button"
                        :class="{ active: activeCourseTab === 'forum' }"
                        :aria-pressed="activeCourseTab === 'forum'"
                        @click="activeCourseTab = 'forum'"
                    >
                        <i class="pi pi-comments" aria-hidden="true" /> Foro
                    </button>
                </nav>

                <CourseMaterials
                    v-if="activeCourseTab === 'materials'"
                    :course-id="courseId"
                    :sections="sections"
                />

                <section v-if="activeCourseTab === 'assignments'" class="assignments-section">
                    <h2>Tareas</h2>
                    <StateMessage
                        v-if="!assignments.length"
                        dense
                        icon="pi-file-edit"
                        title="Todavía no hay tareas"
                        description="Cuando tu docente publique una actividad, la vas a ver acá."
                    />
                    <ul v-else class="assignment-list">
                        <li
                            v-for="assignment in assignments"
                            :key="assignment.id"
                            class="assignment-item"
                        >
                            <div class="assignment-title">{{ assignment.title }}</div>
                            <div class="assignment-meta">
                                <span v-if="sectionTitle(assignment.section_id)">
                                    {{ sectionTitle(assignment.section_id) }} ·
                                </span>
                                <span v-if="assignment.due_at">
                                    vence {{ formatDateTime(assignment.due_at) }} ·
                                </span>
                                <span>máx. {{ assignment.max_score }}</span>
                            </div>
                            <p v-if="assignment.description" class="assignment-description">
                                {{ assignment.description }}
                            </p>
                            <ul v-if="rubrics[assignment.id]?.length" class="rubric-list">
                                <li
                                    v-for="criterion in rubrics[assignment.id]"
                                    :key="criterion.title"
                                >
                                    <strong>{{ criterion.title }}</strong
                                    ><span>{{ criterion.description }}</span
                                    ><em>{{ criterion.max_score }} pts</em>
                                </li>
                            </ul>
                            <CourseMaterials :course-id="courseId" :assignment-id="assignment.id" />

                            <div
                                v-if="mySubmissions[assignment.id] && !resubmitting[assignment.id]"
                                class="my-submission"
                            >
                                <SubmissionBody
                                    class="submission-content"
                                    :content="mySubmissions[assignment.id]?.content || ''"
                                    :attachments="mySubmissions[assignment.id]?.attachments"
                                />
                                <span
                                    class="submission-status"
                                    :class="`submission-status--${mySubmissions[assignment.id]?.status}`"
                                >
                                    {{
                                        mySubmissions[assignment.id]?.status === "graded"
                                            ? `Nota: ${mySubmissions[assignment.id]?.score}`
                                            : "Entregado, esperando corrección"
                                    }}
                                </span>
                                <p
                                    v-if="mySubmissions[assignment.id]?.feedback"
                                    class="submission-feedback"
                                >
                                    {{ mySubmissions[assignment.id]?.feedback }}
                                </p>
                                <ul
                                    v-if="mySubmissions[assignment.id]?.rubric_scores?.length"
                                    class="rubric-feedback-list"
                                >
                                    <li
                                        v-for="score in mySubmissions[assignment.id]?.rubric_scores"
                                        :key="score.criterion_id"
                                    >
                                        <strong>{{
                                            rubrics[assignment.id]?.find(
                                                (criterion) => criterion.id === score.criterion_id,
                                            )?.title
                                        }}</strong>
                                        <span
                                            >{{ score.score }} /
                                            {{
                                                rubrics[assignment.id]?.find(
                                                    (criterion) =>
                                                        criterion.id === score.criterion_id,
                                                )?.max_score
                                            }}</span
                                        >
                                        <p v-if="score.feedback">{{ score.feedback }}</p>
                                    </li>
                                </ul>
                                <Button
                                    v-if="canResubmit(assignment)"
                                    label="Actualizar entrega"
                                    icon="pi pi-refresh"
                                    size="small"
                                    text
                                    @click="startResubmit(assignment.id)"
                                />
                                <small v-else class="submission-locked">{{
                                    mySubmissions[assignment.id]?.graded_at
                                        ? "Entrega corregida: ya no se puede modificar"
                                        : "El plazo de entrega venció"
                                }}</small>
                            </div>
                            <div v-else-if="assignment.locked" class="locked-state">
                                <i class="pi pi-lock" /> {{ assignment.locked_reason }}
                            </div>
                            <div
                                v-else-if="mineStatus[assignment.id] === 'error'"
                                class="locked-state"
                            >
                                <i class="pi pi-exclamation-triangle" /> No pudimos comprobar si ya
                                entregaste.
                                <Button
                                    label="Reintentar"
                                    size="small"
                                    text
                                    @click="retryLoadMine(assignment.id)"
                                />
                            </div>
                            <div
                                v-else-if="mineStatus[assignment.id] !== 'loaded'"
                                class="locked-state"
                            >
                                <i class="pi pi-spin pi-spinner" /> Cargando tu entrega…
                            </div>
                            <form
                                v-else
                                class="submit-form"
                                @submit.prevent="handleSubmit(assignment.id)"
                            >
                                <Textarea
                                    v-model="submissionDrafts[assignment.id]"
                                    rows="3"
                                    placeholder="Tu respuesta o link de entrega"
                                />
                                <label class="submission-file"
                                    ><i class="pi pi-paperclip" /> Adjuntar archivo<input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt,image/*,audio/*,video/*"
                                        @change="selectSubmissionFile(assignment.id, $event)"
                                    /><small v-if="submissionFiles[assignment.id]">{{
                                        submissionFiles[assignment.id]?.name
                                    }}</small></label
                                >
                                <Button
                                    type="submit"
                                    :label="
                                        resubmitting[assignment.id]
                                            ? 'Reenviar entrega'
                                            : 'Entregar'
                                    "
                                    size="small"
                                    :loading="submitting[assignment.id]"
                                    class="submit-btn"
                                />
                                <Button
                                    v-if="resubmitting[assignment.id]"
                                    type="button"
                                    label="Cancelar"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="resubmitting[assignment.id] = false"
                                />
                            </form>
                        </li>
                    </ul>
                </section>

                <section v-if="activeCourseTab === 'quizzes'" class="quizzes-section">
                    <StateMessage
                        v-if="!quizzes.quizzes.value.length"
                        dense
                        icon="pi-verified"
                        title="Todavía no hay evaluaciones"
                        description="Tu docente no publicó evaluaciones en este curso."
                    />
                    <ul v-else class="quiz-list">
                        <li v-for="quiz in quizzes.quizzes.value" :key="quiz.id" class="quiz-item">
                            <div class="quiz-main">
                                <strong>{{ quiz.title }}</strong>
                                <p v-if="quiz.description">{{ quiz.description }}</p>
                                <span class="quiz-meta"
                                    ><template v-if="sectionTitle(quiz.section_id)"
                                        >{{ sectionTitle(quiz.section_id) }} · </template
                                    >{{ attemptsLabel(quiz)
                                    }}<template v-if="quiz.time_limit_secs">
                                        · {{ Math.round(quiz.time_limit_secs / 60) }} min</template
                                    ><template v-if="bestScore(quiz)">
                                        · mejor nota {{ bestScore(quiz) }}</template
                                    ></span
                                >
                                <span v-if="quiz.locked" class="quiz-locked-reason"
                                    ><i class="pi pi-lock" /> {{ quiz.locked_reason }}</span
                                >
                            </div>
                            <div class="quiz-actions">
                                <Button
                                    v-if="reviewableAttempt(quiz)"
                                    label="Ver resultados"
                                    size="small"
                                    text
                                    :loading="reviewingAttempt === reviewableAttempt(quiz)?.id"
                                    @click="reviewAttempt(quiz, reviewableAttempt(quiz)!.id)"
                                />
                                <Button
                                    v-if="canAttempt(quiz)"
                                    :label="quizActionLabel(quiz)"
                                    size="small"
                                    :loading="startingQuiz"
                                    :disabled="startingQuiz"
                                    @click="openQuiz(quiz)"
                                />
                            </div>
                        </li>
                    </ul>
                </section>

                <Dialog
                    :visible="!!takingQuiz"
                    modal
                    closable
                    close-on-escape
                    :header="takingQuiz?.title"
                    :style="{ width: 'min(640px, calc(100vw - 32px))' }"
                    @update:visible="
                        (visible) => {
                            if (!visible) closeQuiz();
                        }
                    "
                >
                    <div v-if="!showQuizResults" class="quiz-attempt">
                        <p
                            v-if="quizAttempts.draftStatus.value === 'error'"
                            class="quiz-draft quiz-draft--error"
                        >
                            No pudimos guardar tus últimas respuestas. Quedaron en este dispositivo
                            y se reintenta al seguir escribiendo.
                        </p>
                        <p
                            v-else-if="quizAttempts.draftStatus.value === 'saving'"
                            class="quiz-draft"
                        >
                            Guardando…
                        </p>
                        <p
                            v-else-if="quizAttempts.draftStatus.value === 'saved'"
                            class="quiz-draft"
                        >
                            Respuestas guardadas
                        </p>
                        <div
                            v-if="remainingLabel"
                            class="quiz-timer"
                            :class="{ 'quiz-timer--out': timeIsUp }"
                        >
                            <i class="pi pi-clock"></i>
                            <span v-if="timeIsUp">Se acabó el tiempo</span>
                            <span v-else>Tiempo restante: {{ remainingLabel }}</span>
                        </div>
                        <div
                            v-for="question in quizAttempts.activeQuestions.value"
                            :key="question.id"
                            class="quiz-question"
                        >
                            <p class="quiz-statement">{{ question.statement }}</p>
                            <Select
                                v-if="question.type === 'multiple_choice'"
                                :model-value="myAnswers[question.id]"
                                :options="question.options.map((o) => ({ label: o, value: o }))"
                                option-label="label"
                                option-value="value"
                                placeholder="Elegí una opción"
                                @update:model-value="myAnswers[question.id] = $event"
                            />
                            <Select
                                v-else-if="question.type === 'true_false'"
                                :model-value="myAnswers[question.id]"
                                :options="[
                                    { label: 'Verdadero', value: 'true' },
                                    { label: 'Falso', value: 'false' },
                                ]"
                                option-label="label"
                                option-value="value"
                                placeholder="Elegí una opción"
                                @update:model-value="myAnswers[question.id] = $event"
                            />
                            <div v-else-if="question.type === 'fill_blanks'" class="blanks-inputs">
                                <div
                                    v-for="id in blankIds(question.statement)"
                                    :key="id"
                                    class="blank-field"
                                >
                                    <label>Espacio {{ id }}</label
                                    ><InputText
                                        :model-value="blankAnswers[question.id]?.[id] || ''"
                                        @update:model-value="
                                            blankAnswers[question.id] = {
                                                ...(blankAnswers[question.id] || {}),
                                                [id]: String($event),
                                            }
                                        "
                                    />
                                </div>
                            </div>
                            <span class="quiz-points">{{ question.points }} pto(s)</span>
                        </div>
                        <Button
                            label="Entregar"
                            :loading="submittingQuiz"
                            :disabled="!quizAttempts.activeAttempt.value || timeIsUp"
                            @click="submitQuiz"
                        />
                    </div>
                    <div v-else class="quiz-results">
                        <p class="quiz-score">
                            Nota: {{ quizAttempts.activeAttempt.value?.score }}/{{
                                quizAttempts.activeAttempt.value?.max_score
                            }}
                        </p>
                        <div
                            v-for="result in quizAttempts.lastResults.value"
                            :key="result.question_id"
                            class="quiz-result-row"
                            :class="{ correct: result.is_correct, incorrect: !result.is_correct }"
                        >
                            <p>{{ result.statement }}</p>
                            <span>Tu respuesta: {{ result.answer_text || "(sin responder)" }}</span>
                            <span v-if="!result.is_correct"
                                >Correcta: {{ result.correct_answer }}</span
                            >
                        </div>
                        <Button label="Cerrar" text @click="closeQuiz" />
                    </div>
                </Dialog>

                <ForumSection v-if="activeCourseTab === 'forum'" :course-id="courseId" />
            </template>
        </div>
    </StudentLayout>
</template>

<style scoped>
.course-detail {
    max-width: 720px;
}

.back-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: 0 var(--space-3) 0 var(--space-2);
    border: none;
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-base);
    font-weight: 600;
    cursor: pointer;
    margin-bottom: var(--space-4);
}

.back-btn:hover {
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
}

.course-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
    margin-bottom: var(--space-3);
    padding: var(--space-6);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-xl);
    background: var(--surface-card);
}

.course-head-main {
    flex: 1;
    min-width: 220px;
}
.course-head-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
}

.course-icon {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: var(--radius-lg);
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
}

.course-head h1 {
    margin: 0;
    font-family: var(--font-ui-family);
    font-size: 28px;
    font-weight: 900;
    letter-spacing: -0.035em;
    line-height: 1.06;
    color: var(--text-heading);
}

.course-progress {
    min-width: 190px;
    padding: var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-bg);
}

.course-progress-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 600;
}
.course-progress-head span:last-child {
    color: var(--text-heading);
}
.course-progress-bar {
    height: 7px;
    margin-bottom: var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--practiq-violet-100);
}
.course-progress-bar span {
    display: block;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--practiq-violet);
}
.course-progress-stats {
    display: flex;
    gap: var(--space-5);
    color: var(--text-secondary);
    font-size: var(--text-sm);
}
.course-progress-stats strong {
    display: block;
    color: var(--text-heading);
    font-family: var(--font-ui-family);
    font-size: var(--text-lg);
    font-weight: 900;
}
.course-progress-stats .is-pending {
    color: var(--color-warning-dark);
}

.course-status {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--color-success-bg);
    color: var(--color-success-dark);
}

.course-description {
    margin: var(--space-2) 0 0;
    max-width: 60ch;
    color: var(--text-secondary);
    font-size: var(--text-md);
    line-height: 1.6;
}

.course-description--empty {
    font-style: italic;
    color: var(--text-muted);
}

.course-labels {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
    margin-top: var(--space-3);
}
.course-labels span {
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--fill-primary-soft);
    color: var(--practiq-violet-dark);
    font-size: 10px;
    font-weight: 800;
}

.course-nav {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    gap: var(--space-1);
    overflow-x: auto;
    padding: var(--space-1);
    margin-top: var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    mask-image: linear-gradient(
        to right,
        transparent,
        black var(--space-3),
        black calc(100% - var(--space-3)),
        transparent
    );
    -webkit-mask-image: linear-gradient(
        to right,
        transparent,
        black var(--space-3),
        black calc(100% - var(--space-3)),
        transparent
    );
}
.course-nav button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 42px;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-ui-family);
    font-size: var(--text-base);
    font-weight: 900;
    white-space: nowrap;
    cursor: pointer;
}
.course-nav button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
}
.course-nav button.active {
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
}
.course-nav button.active span {
    background: var(--practiq-violet);
    color: var(--color-on-primary);
}
.course-nav span {
    display: grid;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    place-items: center;
    border-radius: var(--radius-pill);
    background: var(--surface-hover);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: 700;
}

.assignments-section {
    margin-top: var(--space-6);
}

.assignments-section h2 {
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-3);
}

.assignment-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.assignment-item {
    padding: var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-xl);
    background: var(--surface-card);
}

.assignment-title {
    color: var(--text-heading);
    font-family: var(--font-ui-family);
    font-size: 19px;
    font-weight: 900;
    letter-spacing: -0.03em;
}

.assignment-meta {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-1);
}

.assignment-description {
    max-width: 68ch;
    font-size: var(--text-md);
    line-height: 1.6;
    color: var(--text-primary);
    margin-top: var(--space-3);
}

.my-submission {
    margin-top: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-hover);
}

.submission-content {
    margin-bottom: var(--space-3);
}

.submission-status {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
}

.submission-status--graded {
    color: var(--color-success-dark);
}

.submission-locked {
    display: block;
    margin-top: var(--space-2);
    color: var(--text-muted);
    font-size: var(--text-xs);
}

.locked-state {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    color: var(--text-muted);
    font-size: var(--text-sm);
}

.submission-feedback {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-2);
    font-style: italic;
}

.rubric-feedback-list {
    display: grid;
    gap: var(--space-2);
    margin: var(--space-3) 0;
    padding: 0;
    list-style: none;
}
.rubric-feedback-list li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px var(--space-3);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--surface-card);
    font-size: var(--text-xs);
}
.rubric-feedback-list strong {
    color: var(--text-primary);
}
.rubric-feedback-list span {
    color: var(--practiq-violet-dark);
    font-weight: 700;
}
.rubric-feedback-list p {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--text-secondary);
}

.submit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
}
.submission-file {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    color: var(--practiq-violet-dark);
    font-size: var(--text-xs);
    font-weight: 700;
    cursor: pointer;
}
.submission-file input {
    max-width: 220px;
    color: var(--text-secondary);
    font-weight: 400;
}
.submission-file small {
    color: var(--text-muted);
    font-weight: 400;
}

.submit-btn {
    align-self: flex-start;
}

.quiz-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
    padding: 0;
}
.quiz-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
}
.quiz-item :deep(.p-button) {
    flex-shrink: 0;
}
.quiz-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}
.quiz-main strong {
    color: var(--text-heading);
}
.quiz-main p {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-sm);
}
.quiz-meta {
    color: var(--text-muted);
    font-size: var(--text-xs);
}
.quiz-locked-reason {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    color: var(--color-warning-dark);
    font-size: var(--text-xs);
    font-weight: 700;
}
.quiz-attempt {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}
.quiz-timer {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    align-self: flex-start;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.quiz-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
}
.quiz-draft {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
}
.quiz-draft--error {
    color: var(--color-error, #b91c1c);
    font-weight: 700;
}
.quiz-timer--out {
    background: var(--color-error-bg, #fee2e2);
    color: var(--color-error, #b91c1c);
}
.quiz-question {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--surface-border);
}
.quiz-statement {
    margin: 0;
    font-weight: 700;
    color: var(--text-heading);
}
.quiz-points {
    color: var(--text-muted);
    font-size: var(--text-xs);
}
.blanks-inputs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}
.blank-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--text-xs);
    color: var(--text-muted);
}
.quiz-results {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}
.quiz-score {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 800;
    color: var(--text-heading);
}
.quiz-result-row {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    border-left: 3px solid transparent;
}
.quiz-result-row p {
    margin: 0 0 3px;
    font-weight: 700;
}
.quiz-result-row span {
    display: block;
    font-size: var(--text-xs);
    color: var(--text-secondary);
}
.quiz-result-row.correct {
    border-left-color: var(--color-success-dark);
    background: var(--fill-success-subtle);
}
.quiz-result-row.incorrect {
    border-left-color: var(--color-error-dark);
    background: var(--fill-error-subtle);
}

@media (max-width: 640px) {
    .course-detail {
        max-width: none;
    }
    .course-nav {
        margin-inline: calc(var(--space-1) * -1);
        border-inline: 0;
        border-radius: 0;
    }
    .quiz-item {
        flex-direction: column;
        align-items: stretch;
    }
    .quiz-item :deep(.p-button) {
        width: 100%;
    }
}
</style>
