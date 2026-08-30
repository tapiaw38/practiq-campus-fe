import type { AxiosInstance } from "axios";
import type { CourseMaterial, MaterialKind, UploadedFile } from "@/types";

export interface CreateMaterialParams {
	assignment_id?: string | null;
  section_id?: string | null;
  title: string;
  description?: string;
  kind: MaterialKind;
  url: string;
}

export class MaterialService {
  constructor(private readonly api: AxiosInstance) {}

  async list(courseId: string): Promise<CourseMaterial[]> {
    const { data } = await this.api.get<{ data: CourseMaterial[] }>(`/courses/${courseId}/materials`);
    return data.data;
  }

  async create(courseId: string, params: CreateMaterialParams): Promise<CourseMaterial> {
    const { data } = await this.api.post<{ data: CourseMaterial }>(`/courses/${courseId}/materials`, params);
    return data.data;
  }

  async remove(id: string): Promise<void> { await this.api.delete(`/materials/${id}`); }

  async upload(file: File): Promise<UploadedFile> {
    const body = new FormData();
    body.append("folder", "materials");
    body.append("file", file);
    const { data } = await this.api.post<{ data: UploadedFile }>("/uploads", body);
    return data.data;
  }
}
