export type SubmissionStatus = "submitted" | "graded";

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
}
