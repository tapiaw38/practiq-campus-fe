<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import SubmissionBody from "@/components/ui/SubmissionBody.vue";
import Pagination from "@/components/ui/Pagination.vue";
import { useSubmissions } from "@/composables/useSubmissions";
import { useRubric } from "@/composables/useRubric";
import { AssignmentService } from "@/services/assignments/assignmentService";
import { campusApi } from "@/api/request/server";
import { formatDateTime } from "@/utils/datetime";
import type { Submission } from "@/types";

const route = useRoute();
const router = useRouter();
const courseId = route.params.courseId as string;
const assignmentId = route.params.assignmentId as string;

type Draft = { score: string; feedback: string; criteria: Record<string, { score: string; feedback: string }> };
type Filter = "pending" | "graded" | "all";

const { submissionsByAssignment, loadByAssignment, grade } = useSubmissions();
const rubric = useRubric();
const title = ref("Tarea");
const max = ref(100);
const drafts = ref<Record<string, Draft>>({});
// The view had no loading state, so the "todavía no hay entregas" card flashed
// on every visit before the request came back.
const loading = ref(true);

const PER_PAGE = 10;
const page = ref(1);
const filter = ref<Filter>("pending");

const all = computed(() => submissionsByAssignment.value[assignmentId] || []);
const pendingCount = computed(() => all.value.filter((s) => s.status !== "graded").length);

// Correcting is queue work, so the ungraded ones come first and, within each
// group, the ones that have been waiting longest.
const ordered = computed(() =>
  [...all.value].sort((first, second) => {
    const firstPending = first.status !== "graded";
    if (firstPending !== (second.status !== "graded")) return firstPending ? -1 : 1;
    return new Date(first.submitted_at).getTime() - new Date(second.submitted_at).getTime();
  }),
);

const filtered = computed(() =>
  ordered.value.filter((submission) => {
    if (filter.value === "pending") return submission.status !== "graded";
    if (filter.value === "graded") return submission.status === "graded";
    return true;
  }),
);

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)));
const visible = computed(() => filtered.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE));

const filters: { value: Filter; label: string }[] = [
  { value: "pending", label: "Sin corregir" },
  { value: "graded", label: "Corregidas" },
  { value: "all", label: "Todas" },
];

// A filter change, or grading the last item on a page, can leave the current
// page past the end of the list.
watch([filtered, totalPages], () => {
  if (page.value > totalPages.value) page.value = totalPages.value;
});
watch(filter, () => {
  page.value = 1;
});

onMounted(async () => {
  try {
    const service = new AssignmentService(campusApi);
    const [{ data }] = await Promise.all([
      service.listByCourse(courseId),
      loadByAssignment(assignmentId),
      rubric.load(assignmentId),
    ]);
    const item = data.find((x) => x.id === assignmentId);
    if (item) {
      title.value = item.title;
      max.value = item.max_score;
    }
    // Opening straight onto an empty queue would look like an empty
    // assignment, so a fully corrected one lands on the full list instead.
    if (!pendingCount.value && all.value.length) filter.value = "all";
  } finally {
    loading.value = false;
  }
});

function draft(s: Submission) {
  if (!drafts.value[s.id]) {
    drafts.value[s.id] = {
      score: s.score == null ? "" : String(s.score),
      feedback: s.feedback,
      criteria: Object.fromEntries(
        rubric.criteria.value.map((c) => {
          const old = s.rubric_scores.find((x) => x.criterion_id === c.id);
          return [c.id || "", { score: old ? String(old.score) : "", feedback: old?.feedback || "" }];
        }),
      ),
    };
  }
  return drafts.value[s.id];
}

async function save(s: Submission) {
  const d = draft(s);
  if (rubric.criteria.value.length) {
    const scores = rubric.criteria.value.map((c) => ({
      criterion_id: c.id || "",
      score: Number(d.criteria[c.id || ""]?.score),
      feedback: d.criteria[c.id || ""]?.feedback || "",
    }));
    if (scores.some((x) => !Number.isInteger(x.score))) return;
    await grade(assignmentId, s.id, 0, d.feedback, scores);
    return;
  }
  await grade(assignmentId, s.id, Number(d.score), d.feedback);
}
</script>

<template>
  <TeacherLayout>
    <section class="page">
      <Button
        text
        icon="pi pi-arrow-left"
        label="Volver a tareas"
        class="back-link"
        @click="router.push(`/teacher/courses/${courseId}?tab=tareas`)"
      />
      <PageHeader
        eyebrow="Corrección"
        :title="title"
        :subtitle="`Corrección de entregas · máximo ${max} puntos`"
      />

      <StateMessage v-if="loading" variant="loading" :rows="3" loading-label="Cargando entregas" />

      <StateMessage
        v-else-if="!all.length"
        icon="pi-inbox"
        title="Todavía no hay entregas"
        description="Cuando un estudiante entregue esta tarea, vas a poder corregirla acá."
      />

      <template v-else>
        <div class="queue-bar">
          <p class="queue-summary" role="status">
            {{ all.length }} {{ all.length === 1 ? "entrega" : "entregas" }} ·
            <strong :class="{ 'queue-summary--clear': !pendingCount }">
              {{ pendingCount ? `${pendingCount} sin corregir` : "todas corregidas" }}
            </strong>
          </p>
          <div class="queue-filters" role="group" aria-label="Filtrar entregas">
            <button
              v-for="option in filters"
              :key="option.value"
              type="button"
              :class="{ active: filter === option.value }"
              :aria-pressed="filter === option.value"
              @click="filter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <StateMessage
          v-if="!filtered.length"
          dense
          icon="pi-check-circle"
          :title="filter === 'pending' ? 'No queda nada por corregir' : 'Todavía no corregiste ninguna'"
        />

        <article v-for="s in visible" :key="s.id" class="submission">
          <header class="submission-head">
            <h2>{{ s.user_name || s.user_id }}</h2>
            <span
              class="submission-flag"
              :class="s.status === 'graded' ? 'submission-flag--graded' : 'submission-flag--pending'"
            >
              {{ s.status === "graded" ? `Nota ${s.score}` : "Sin corregir" }}
            </span>
            <time :datetime="s.submitted_at">{{ formatDateTime(s.submitted_at) }}</time>
          </header>

          <SubmissionBody :content="s.content" :attachments="s.attachments" />

          <div v-for="c in rubric.criteria.value" :key="c.id" class="criterion">
            <strong>{{ c.title }} / {{ c.max_score }}</strong>
            <InputText
              v-model="draft(s).criteria[c.id!].score"
              type="number"
              min="0"
              :max="c.max_score"
              placeholder="Puntos"
              :aria-label="`Puntos para ${c.title}`"
            />
            <InputText
              v-model="draft(s).criteria[c.id!].feedback"
              placeholder="Comentario"
              :aria-label="`Comentario para ${c.title}`"
            />
          </div>
          <InputText
            v-if="!rubric.criteria.value.length"
            v-model="draft(s).score"
            type="number"
            min="0"
            :max="max"
            placeholder="Nota"
            aria-label="Nota"
            class="score-input"
          />
          <Textarea
            v-model="draft(s).feedback"
            rows="2"
            placeholder="Comentario general"
            aria-label="Comentario general"
          />
          <Button label="Guardar corrección" size="small" class="save-btn" @click="save(s)" />
        </article>

        <Pagination
          v-model:page="page"
          :total-pages="totalPages"
          :total="filtered.length"
          :per-page="PER_PAGE"
          item-label="entregas"
        />
      </template>
    </section>
  </TeacherLayout>
</template>

<style scoped>
  .page { max-width: 900px; }
  .back-link { margin-bottom: var(--space-3); }

  .queue-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .queue-summary { margin: 0; color: var(--text-secondary); font-size: var(--text-xs); }
  .queue-summary strong { color: var(--color-warning-dark); }
  .queue-summary--clear { color: var(--color-success-dark); }

  .queue-filters {
    display: flex;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    background: var(--surface-card);
  }

  .queue-filters button {
    min-height: 28px;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: calc(var(--radius-sm) - 2px);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .queue-filters button:hover { background: var(--surface-hover); color: var(--text-primary); }
  .queue-filters button.active { background: var(--fill-primary-soft); color: var(--practiq-violet-dark); }

  .submission {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
  }

  .submission-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .submission-head h2 { margin: 0; color: var(--text-heading); font-size: var(--text-md); }
  .submission-head time { margin-left: auto; color: var(--text-muted); font-size: var(--text-xs); }

  .submission-flag {
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .submission-flag--pending { background: var(--fill-warning-subtle); color: var(--color-warning-dark); }
  .submission-flag--graded { background: var(--fill-success-subtle); color: var(--color-success-dark); }

  .score-input { max-width: 120px; }
  .save-btn { align-self: flex-start; }

  .criterion {
    display: grid;
    grid-template-columns: 1fr 110px 2fr;
    gap: var(--space-2);
    align-items: center;
  }

  @media (max-width: 600px) {
    .criterion { grid-template-columns: 1fr; }
    .queue-bar { align-items: stretch; flex-direction: column; }
    .queue-filters > * { flex: 1; }
    .submission-head { flex-wrap: wrap; }
    .submission-head time { width: 100%; margin-left: 0; }
  }
</style>
