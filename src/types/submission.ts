export type SubmissionStatus = "submitted" | "graded";

export interface SubmissionRubricScore {
  criterion_id: string;
  score: number;
  feedback: string;
}

/** A file the student uploaded with their submission. */
export interface SubmissionAttachment {
  filename: string;
  /** Stored private-bucket value; not openable on its own. */
  url: string;
  /** Short-lived signed URL — this is what the browser opens. */
  view_url: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  user_id: string;
  user_name: string;
  content: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string;
  submitted_at: string;
  graded_at: string | null;
  rubric_scores: SubmissionRubricScore[];
  attachments: SubmissionAttachment[];
}
