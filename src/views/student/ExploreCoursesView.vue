<script setup lang="ts">
import { onMounted, ref } from "vue";
import StudentLayout from "@/layouts/StudentLayout.vue";
import { useCourses } from "@/composables/useCourses";
import { useEnrollments } from "@/composables/useEnrollments";

const { courses, loading, loadCourses } = useCourses();
const { myEnrollments, loadMine, enrollSelf } = useEnrollments();
const enrolling = ref<string | null>(null);
onMounted(() => { loadCourses({ publishedOnly: true }); loadMine(); });
function enrolled(id: string) { return myEnrollments.value.some((e) => e.course_id === id && e.status === "active"); }
async function enroll(id: string) { if (enrolling.value) return; enrolling.value = id; try { await enrollSelf(id); } finally { enrolling.value = null; } }
</script>
<template><StudentLayout><div class="explore"><header><h1>Explorar cursos</h1><p>Cursos publicados disponibles para vos.</p></header><div v-if="loading" class="state-message">Cargando…</div><div v-else-if="!courses.length" class="state-message">No hay cursos publicados.</div><div v-else class="course-grid"><article v-for="course in courses" :key="course.id" class="course-card"><h2>{{ course.title }}</h2><p v-if="course.description">{{ course.description }}</p><Button v-if="enrolled(course.id)" label="Ya estás matriculado" disabled size="small" /><Button v-else label="Matricularme" size="small" :loading="enrolling === course.id" @click="enroll(course.id)" /></article></div></div></StudentLayout></template>
<style scoped>
.explore{max-width:960px}.explore header{margin-bottom:var(--space-6)}h1{font-size:20px;color:var(--text-heading)}header p{color:var(--text-secondary);font-size:var(--text-sm)}.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-4)}.course-card{padding:var(--space-5);border-radius:var(--radius-lg);background:var(--surface-card);box-shadow:var(--shadow-card)}h2{font-size:var(--text-md);color:var(--text-heading);margin-bottom:var(--space-2)}.course-card p{font-size:var(--text-sm);color:var(--text-secondary);min-height:40px}.state-message{padding:var(--space-6);background:var(--surface-card);border-radius:var(--radius-lg);color:var(--text-secondary)}
</style>
