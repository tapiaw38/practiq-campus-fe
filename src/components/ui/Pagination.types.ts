export interface Props {
  page: number;
  totalPages: number;
  total?: number;
  perPage?: number;
  itemLabel?: string;
}

export interface Emits {
  "update:page": [value: number];
}
