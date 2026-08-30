import type { AxiosInstance } from "axios";
export interface RubricCriterion { id?: string; title: string; description: string; max_score: number }
export class RubricService { constructor(private api: AxiosInstance) {} async list(id:string){return (await this.api.get<{data:RubricCriterion[]}>(`/assignments/${id}/rubric`)).data.data} async replace(id:string,criteria:RubricCriterion[]){await this.api.put(`/assignments/${id}/rubric`,{criteria})} }
