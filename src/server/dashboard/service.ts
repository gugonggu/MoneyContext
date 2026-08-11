import "server-only";
export type DashboardData = Readonly<{ freeSpendable: number; dailySpendable: number; liquidAssets: number; netWorth: number; cardOutstanding: number; income: number; expense: number; budgetUsage: number; savingsGoals: number; upcomingEvents: number }>;
export interface DashboardRepository { getData(userId: string): Promise<DashboardData>; }
export function createDashboardService(repository: DashboardRepository) { return { getOverview: (userId: string) => repository.getData(userId) }; }
