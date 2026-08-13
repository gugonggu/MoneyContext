export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type CalendarTransaction = Readonly<{
  id: string;
  type: "INCOME" | "EXPENSE";
  baseAmount: number;
  memo?: string;
  categoryName?: string;
  accountName?: string;
}>;

export type UpcomingKind = "PLANNED" | "CARD_PAYMENT" | "RECURRING";

export type UpcomingMarker = Readonly<{
  kind: UpcomingKind;
  label: string;
  /** Display only. Never included in summary or cell income/expense totals. */
  amount?: number;
  direction: "INCOME" | "EXPENSE";
}>;

export type CalendarCell = Readonly<{
  date: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  /** 0=Sunday .. 6=Saturday. */
  weekday: number;
  income: number;
  expense: number;
  heatLevel: HeatLevel;
  transactions: readonly CalendarTransaction[];
  upcoming: readonly UpcomingMarker[];
}>;

export type CalendarMonth = Readonly<{
  year: number;
  month: number;
  /** Always 42 cells (6 weeks). */
  cells: readonly CalendarCell[];
  summary: Readonly<{ income: number; expense: number; net: number }>;
}>;

/** One day in the dashboard's recent 14-day heat strip. */
export type DashboardDay = Readonly<{
  date: string;
  income: number;
  expense: number;
  heatLevel: HeatLevel;
}>;
