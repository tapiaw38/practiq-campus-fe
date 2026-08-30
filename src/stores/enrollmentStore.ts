import { defineStore } from "pinia";
import { ref } from "vue";
import type { Enrollment, EnrollmentRole } from "@/types";
import type { IEnrollmentService } from "@/services/enrollments/enrollmentService";

export const useEnrollmentStore = (service: IEnrollmentService) =>
  defineStore("campus-enrollments", () => {
    const myEnrollments = ref<Enrollment[]>([]);
    const courseEnrollments = ref<Enrollment[]>([]);
    const loading = ref(false);

    const fetchMine = async () => {
      loading.value = true;
      try {
        const result = await service.listMine();
        myEnrollments.value = result.data;
        return result.data;
      } finally {
        loading.value = false;
      }
    };

    const fetchByCourse = async (courseId: string) => {
      loading.value = true;
      try {
        const result = await service.listByCourse(courseId);
        courseEnrollments.value = result.data;
        return result.data;
      } finally {
        loading.value = false;
      }
    };

    const enroll = async (courseId: string, email: string, role?: EnrollmentRole) => {
      const result = await service.create(courseId, email, role);
      courseEnrollments.value = [result.data, ...courseEnrollments.value];
      return result.data;
    };

    const unenroll = async (id: string) => {
      await service.remove(id);
      courseEnrollments.value = courseEnrollments.value.filter((e) => e.id !== id);
    };

    const enrollSelf = async (courseId: string) => {
      const result = await service.enrollSelf(courseId);
      myEnrollments.value = [result.data, ...myEnrollments.value];
      return result.data;
    };

    return {
      myEnrollments,
      courseEnrollments,
      loading,
      fetchMine,
      fetchByCourse,
      enroll,
      unenroll,
      enrollSelf,
    };
  });
