export interface GoogleButtonEmits {
  (e: "code", authCode: string): void;
}

export interface GoogleClient {
  requestCode: () => void;
}

export interface GoogleResponse {
  code: string;
}
