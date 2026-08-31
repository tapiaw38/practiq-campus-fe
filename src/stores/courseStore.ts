import { defineStore } from "pinia";
import { ref } from "vue";
import type { Course } from "@/types";
import type {
  ICourseService,
  CreateCourseParams,
  UpdateCourseParams,
} from "@/services/courses/courseService";

export const useCourseStore = (service: ICourseService) =>
  defineStore("campus-courses", () => {
    const courses = ref<Course[]>([]);
    const currentCourse = ref<Course | null>(null);
    const loading = ref(false);

    const fetchCourses = async (params?: { publishedOnly?: boolean }) => {
      loading.value = true;
      try {
        const result = await service.list(params);
        courses.value = result.data;
        return result.data;
      } finally {
        loading.value = false;
      }
    };

    const fetchCourse = async (id: string) => {
      loading.value = true;
      try {
        const result = await service.get(id);
        currentCourse.value = result.data;
        return result.data;
      } finally {
        loading.value = false;
      }
    };

    const createCourse = async (params: CreateCourseParams) => {
      const result = await service.create(params);
      courses.value = [result.data, ...courses.value];
      return result.data;
    };

    const updateCourse = async (id: string, params: UpdateCourseParams) => {
      const result = await service.update(id, params);
      currentCourse.value = result.data;
      courses.value = courses.value.map((c) => (c.id === id ? result.data : c));
      return result.data;
    };

    const syncFromPractiq = async () => {
      loading.value = true;
      try {
        const result = await service.syncFromPractiq();
        courses.value = result.data;
        return result.data;
      } finally {
        loading.value = false;
      }
    };

    const duplicateCourse = async (id: string) => {
      const result = await service.duplicate(id);
      courses.value = [result.data, ...courses.value];
      return result.data;
    };

    const deleteCourse = async (id: string) => {
      await service.delete(id);
      courses.value = courses.value.filter((course) => course.id !== id);
      if (currentCourse.value?.id === id) currentCourse.value = null;
    };

    return {
      courses,
      currentCourse,
      loading,
      fetchCourses,
      fetchCourse,
      createCourse,
      updateCourse,
      duplicateCourse,
      deleteCourse,
      syncFromPractiq,
    };
  });
