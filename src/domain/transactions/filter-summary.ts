export type FilterValues = Readonly<{
  from?: string;
  to?: string;
  type?: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  accountId?: string;
  categoryId?: string;
  tagId?: string;
  minAmount?: number;
  maxAmount?: number;
  memo?: string;
}>;

export type NamedOption = Readonly<{ id: string; name: string }>;

export type FilterLookups = Readonly<{
  accounts: readonly NamedOption[];
  categories: readonly NamedOption[];
  tags: readonly NamedOption[];
}>;

export type FilterChip = Readonly<{ key: string; label: string }>;

const TYPE_LABELS = { INCOME: "수입", EXPENSE: "지출", TRANSFER: "이체", ADJUSTMENT: "조정" } as const;
const STATUS_LABELS = { PENDING: "대기", CONFIRMED: "확정", CANCELLED: "취소" } as const;

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const nameOf = (options: readonly NamedOption[], id: string, fallback: string) =>
  options.find((option) => option.id === id)?.name ?? fallback;

/** 적용 중인 필터를 사람이 읽을 수 있는 칩 목록으로 바꾼다. */
export function describeActiveFilters(values: FilterValues, lookups: FilterLookups): FilterChip[] {
  const chips: FilterChip[] = [];

  if (values.from && values.to) chips.push({ key: "period", label: `${values.from} ~ ${values.to}` });
  else if (values.from) chips.push({ key: "period", label: `${values.from} 이후` });
  else if (values.to) chips.push({ key: "period", label: `${values.to} 이전` });

  if (values.type) chips.push({ key: "type", label: TYPE_LABELS[values.type] });
  if (values.status) chips.push({ key: "status", label: STATUS_LABELS[values.status] });
  if (values.accountId) chips.push({ key: "accountId", label: nameOf(lookups.accounts, values.accountId, "계좌/카드") });
  if (values.categoryId) chips.push({ key: "categoryId", label: nameOf(lookups.categories, values.categoryId, "카테고리") });
  if (values.tagId) chips.push({ key: "tagId", label: nameOf(lookups.tags, values.tagId, "태그") });

  if (values.minAmount !== undefined && values.maxAmount !== undefined) {
    chips.push({ key: "amount", label: `${won(values.minAmount)} ~ ${won(values.maxAmount)}` });
  } else if (values.minAmount !== undefined) {
    chips.push({ key: "amount", label: `${won(values.minAmount)} 이상` });
  } else if (values.maxAmount !== undefined) {
    chips.push({ key: "amount", label: `${won(values.maxAmount)} 이하` });
  }

  if (values.memo) chips.push({ key: "memo", label: `메모 "${values.memo}"` });

  return chips;
}
