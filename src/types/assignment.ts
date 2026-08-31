export interface Assignment {
  id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  description: string;
  due_at: string | null;
  max_score: number;
  created_at: string;
  weight: number;
  visible_group_id: string | null;
  unlock_after_type: "assignment" | "quiz" | null;
  unlock_after_id: string | null;
  locked: boolean;
  locked_reason?: string;
}
