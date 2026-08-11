import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
describe("DashboardOverview", () => { it("renders spendable amounts before financial summaries", () => { render(<DashboardOverview overview={{ freeSpendable: 450_000, dailySpendable: 15_000, income: 3_000_000, expense: 800_000, budgetUsage: 800_000, liquidAssets: 1_000_000, netWorth: 700_000, cardOutstanding: 100_000, savingsGoals: 2, upcomingEvents: 3 }} />); expect(screen.getByText("Free spendable")).toBeTruthy(); expect(screen.getByText(/450,000/)).toBeTruthy(); expect(screen.getByText(/Upcoming events: 3/)).toBeTruthy(); }); });
