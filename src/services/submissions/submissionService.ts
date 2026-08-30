import type { AxiosInstance } from "axios";
import type { Submission } from "@/types";

export interface GradeRubricScore { criterion_id: string; score: number; feedback: string }

export interface ISubmissionService {
  create(assignmentId: string, content: string): Promise<{ data: Submission }>;
  getMine(assignmentId: string): Promise<{ data: Submission | null }>;
  listByAssignment(assignmentId: string): Promise<{ data: Submission[] }>;
  grade(submissionId: string, score: number, feedback: string, rubricScores?: GradeRubricScore[]): Promise<{ data: Submission }>;
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

  async grade(submissionId: string, score: number, feedback: string, rubricScores?: GradeRubricScore[]): Promise<{ data: Submission }> {
    const { data } = await this.api.put(`/submissions/${submissionId}/grade`, { score, feedback, rubric_scores: rubricScores });
    return data;
  }
}
