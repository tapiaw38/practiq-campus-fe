export interface ForumThread {
  id: string;
  course_id: string;
  author_id: string;
  title: string;
  description: string;
  created_at: string;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  parent_post_id?: string | null;
  author_id: string;
  author_name?: string;
  body: string;
  created_at: string;
}
