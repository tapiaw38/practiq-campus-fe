import type { AxiosInstance } from "axios";

export interface PreferenceData<T extends Record<string, unknown> = Record<string, unknown>> {
  scope: string;
  settings: T;
}

export class PreferenceService {
  constructor(private readonly api: AxiosInstance) {}

  async get<T extends Record<string, unknown>>(scope: string): Promise<PreferenceData<T>> {
    const { data } = await this.api.get<{ data: PreferenceData<T> }>(`/me/preferences/${scope}`);
    return data.data;
  }

  async update<T extends Record<string, unknown>>(scope: string, settings: T): Promise<PreferenceData<T>> {
    const { data } = await this.api.put<{ data: PreferenceData<T> }>(`/me/preferences/${scope}`, { settings });
    return data.data;
  }
}
