import { requireCurrentProfile } from "@/server/auth/require-profile";
import { generateAnalysisJsonExport } from "@/server/export";
import { exportFilename, resolveDownloadPeriod } from "@/server/export/download";

export async function GET(request: Request): Promise<Response> {
  const profile = await requireCurrentProfile();
  let download: ReturnType<typeof resolveDownloadPeriod>;
  try {
    download = resolveDownloadPeriod(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof RangeError) return new Response("Invalid export period", { status: 400 });
    throw error;
  }
  const data = await generateAnalysisJsonExport(profile.id, download.input);
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename("analysis", "json", download.period)}"`,
    },
  });
}
