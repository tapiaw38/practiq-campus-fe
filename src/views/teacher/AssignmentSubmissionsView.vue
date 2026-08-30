<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useSubmissions } from "@/composables/useSubmissions";
import { useRubric } from "@/composables/useRubric";
import { AssignmentService } from "@/services/assignments/assignmentService";
import { campusApi } from "@/api/request/server";
import type { Submission } from "@/types";
const route=useRoute(), router=useRouter(), courseId=route.params.courseId as string, assignmentId=route.params.assignmentId as string;
type Draft = { score: string; feedback: string; criteria: Record<string, { score: string; feedback: string }> };
const { submissionsByAssignment, loadByAssignment, grade }=useSubmissions(); const rubric=useRubric(); const title=ref("Tarea"); const max=ref(100); const drafts=ref<Record<string, Draft>>({});
onMounted(async()=>{const service=new AssignmentService(campusApi);const [{data}]=await Promise.all([service.listByCourse(courseId),loadByAssignment(assignmentId),rubric.load(assignmentId)]);const item=data.find(x=>x.id===assignmentId); if(item){title.value=item.title;max.value=item.max_score}});
function draft(s:Submission){if(!drafts.value[s.id]) drafts.value[s.id]={score:s.score==null?"":String(s.score),feedback:s.feedback,criteria:Object.fromEntries(rubric.criteria.value.map(c=>{const old=s.rubric_scores.find(x=>x.criterion_id===c.id);return[c.id||"",{score:old?String(old.score):"",feedback:old?.feedback||""}]}))};return drafts.value[s.id]}
async function save(s:Submission){const d=draft(s);if(rubric.criteria.value.length){const scores=rubric.criteria.value.map(c=>({criterion_id:c.id||"",score:Number(d.criteria[c.id||""]?.score),feedback:d.criteria[c.id||""]?.feedback||""}));if(scores.some(x=>!Number.isInteger(x.score)))return;await grade(assignmentId,s.id,0,d.feedback,scores)}else await grade(assignmentId,s.id,Number(d.score),d.feedback)}
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
      <StateMessage
        v-if="!submissionsByAssignment[assignmentId]?.length"
        icon="pi-inbox"
        title="Todavía no hay entregas"
        description="Cuando un estudiante entregue esta tarea, vas a poder corregirla acá."
      />
      <article v-for="s in submissionsByAssignment[assignmentId]" :key="s.id" class="submission">
        <h2>
          {{ s.user_name || s.user_id }}
          <small v-if="s.status === 'graded'">· Nota {{ s.score }}</small>
          <small v-else class="submission-pending">· Sin corregir</small>
        </h2>
        <p class="content">{{ s.content }}</p>
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
        <template v-if="!rubric.criteria.value.length">
          <InputText
            v-model="draft(s).score"
            type="number"
            min="0"
            :max="max"
            placeholder="Nota"
            aria-label="Nota"
          />
        </template>
        <Textarea v-model="draft(s).feedback" rows="2" placeholder="Comentario general" aria-label="Comentario general" />
        <Button label="Guardar corrección" size="small" class="save-btn" @click="save(s)" />
      </article>
    </section>
  </TeacherLayout>
</template>
<style scoped>.page{max-width:900px}.back-link{margin-bottom:var(--space-3)}.submission small{color:var(--text-muted);font-weight:600}.submission-pending{color:var(--color-warning-dark)}.save-btn{align-self:flex-start}.submission{display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-3);padding:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card)}.submission h2{font-size:var(--text-md)}.content{white-space:pre-wrap;color:var(--text-secondary)}.criterion{display:grid;grid-template-columns:1fr 110px 2fr;gap:var(--space-2);align-items:center}@media(max-width:600px){.criterion{grid-template-columns:1fr}}</style>
