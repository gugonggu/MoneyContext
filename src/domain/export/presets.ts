export type ExportPreset = "SPENDING_REVIEW" | "BUDGET_REVIEW" | "FINANCIAL_HEALTH";
export type ExportSection = "BUDGETS" | "CATEGORY_SPENDING" | "TAG_SPENDING" | "PAYMENT_METHODS" | "EXTERNAL_FLOWS" | "EXPENSE_NATURE" | "CARDS" | "SAVINGS_GOALS" | "PLANNED_CASHFLOWS" | "TRANSACTIONS";

export const exportPresets: Readonly<Record<ExportPreset, Readonly<{ purpose: string; sections: readonly ExportSection[] }>>> = {
  SPENDING_REVIEW: {
    purpose: "소비 패턴 분석",
    sections: ["CATEGORY_SPENDING", "TAG_SPENDING", "PAYMENT_METHODS", "EXTERNAL_FLOWS", "EXPENSE_NATURE", "TRANSACTIONS"],
  },
  BUDGET_REVIEW: {
    purpose: "예산 점검",
    sections: ["BUDGETS", "CATEGORY_SPENDING", "PLANNED_CASHFLOWS"],
  },
  FINANCIAL_HEALTH: {
    purpose: "재정 건강 점검",
    sections: ["CATEGORY_SPENDING", "CARDS", "SAVINGS_GOALS", "PLANNED_CASHFLOWS"],
  },
};

export function isExportPreset(value: string): value is ExportPreset {
  return Object.hasOwn(exportPresets, value);
}
