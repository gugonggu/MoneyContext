import { runRecurringTransactionCron } from "@/server/recurring/cron";

function todaySeoulDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const occurrences = await runRecurringTransactionCron(todaySeoulDate());
  return Response.json({ generated: occurrences.length });
}
