export interface Props {
  variant?: "loading" | "empty" | "error";
  loadingLabel?: string;
  icon?: string;
  title?: string;
  description?: string;
  rows?: number;
  dense?: boolean;
}
