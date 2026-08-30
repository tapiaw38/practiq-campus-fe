export type CourseStatus = "draft" | "published" | "archived";

export interface Course {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  start_date: string | null;
  end_date: string | null;
  practiq_subject_id: string | null;
  labels: string[];
  created_at: string;
  updated_at: string;
}
