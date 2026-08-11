import { StatisticsOverview } from "@/components/statistics/StatisticsOverview";
import { getStatisticsForCurrentUser } from "@/server/statistics";
export default async function StatisticsPage() { return <StatisticsOverview statistics={await getStatisticsForCurrentUser()} />; }
