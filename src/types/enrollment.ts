export type EnrollmentRole = "student" | "teaching_assistant" | "co_teacher";
export type EnrollmentStatus = "active" | "dropped" | "completed";

export interface Enrollment {
  id: string;
  course_id: string;
  user_id: string;
  user_name: string;
  enrollment_role: EnrollmentRole;
  status: EnrollmentStatus;
  enrolled_at: string;
}
