import { MarkdownExport, type MarkdownExportRequest } from "@/components/export/MarkdownExport";
import { generateMarkdownExportForCurrentUser } from "@/server/export";

async function generateMarkdown(input: MarkdownExportRequest): Promise<string> {
  "use server";

  return generateMarkdownExportForCurrentUser(input);
}

export default async function ExportPage() {
  const initialMarkdown = await generateMarkdownExportForCurrentUser({ preset: "SPENDING_REVIEW" });

  return <MarkdownExport initialMarkdown={initialMarkdown} onGenerate={generateMarkdown} />;
}
