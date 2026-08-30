export interface Assignment {
  id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  description: string;
  due_at: string | null;
  max_score: number;
  created_at: string;
}
