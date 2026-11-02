import type { ForumPost } from "@/types";

export interface Props {
  posts: ForumPost[];
  threadId: string;
  post: ForumPost;
  depth?: number;
}

export interface Emits {
  posted: [];
  updated: [];
  deleted: [];
}
