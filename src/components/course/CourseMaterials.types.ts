import type { CourseSection } from "@/types";

export interface Props {
  courseId: string;
  assignmentId?: string | null;
  sections?: CourseSection[];
  canManage?: boolean;
}
