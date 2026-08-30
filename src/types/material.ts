export type MaterialKind = "file" | "link";

export interface CourseMaterial {
  id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  description: string;
  kind: MaterialKind;
  url: string;
  view_url: string;
  created_at: string;
}

export interface UploadedFile {
  url: string;
  preview_url?: string;
  filename: string;
  content_type: string;
  kind: string;
  size: number;
}
