import type { AxiosInstance } from "axios";
import type { Submission } from "@/types";

export interface GradeRubricScore { criterion_id: string; score: number; feedback: string }

export interface ISubmissionService {
  create(assignmentId: string, content: string): Promise<{ data: Submission }>;
  getMine(assignmentId: string): Promise<{ data: Submission | null }>;
  listByAssignment(assignmentId: string): Promise<{ data: Submission[] }>;
  grade(submissionId: string, score: number, feedback: string, rubricScores?: GradeRubricScore[], version?: number): Promise<{ data: Submission }>;
}

export class SubmissionService implements ISubmissionService {
  constructor(private readonly api: AxiosInstance) {}

  async create(assignmentId: string, content: string): Promise<{ data: Submission }> {
    const { data } = await this.api.post(`/assignments/${assignmentId}/submissions`, { content });
    return data;
  }

  async getMine(assignmentId: string): Promise<{ data: Submission | null }> {
    const { data } = await this.api.get(`/assignments/${assignmentId}/submissions/me`);
    return data;
  }

  async listByAssignment(assignmentId: string): Promise<{ data: Submission[] }> {
    const { data } = await this.api.get(`/assignments/${assignmentId}/submissions`);
    return data;
  }

  async grade(submissionId: string, score: number, feedback: string, rubricScores?: GradeRubricScore[], version?: number): Promise<{ data: Submission }> {
    // version is what the teacher reviewed; the server refuses if the
    // student resubmitted in the meantime.
    const { data } = await this.api.put(`/submissions/${submissionId}/grade`, { score, feedback, rubric_scores: rubricScores, version });
    return data;
  }
}
