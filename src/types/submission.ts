export type SubmissionStatus = "submitted" | "graded";

export interface SubmissionRubricScore {
    criterion_id: string;
    score: number;
    feedback: string;
}

export interface SubmissionAttachment {
    filename: string;
    url: string;
    view_url: string;
}

export interface Submission {
    id: string;
    assignment_id: string;
    version: number;
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
