import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { getDashboardOverviewForCurrentUser } from "@/server/dashboard";
export default async function HomePage() { return <DashboardOverview overview={await getDashboardOverviewForCurrentUser()} />; }
