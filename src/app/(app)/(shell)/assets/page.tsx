import { AssetOverview } from "@/components/assets/AssetOverview";
import { getAssetOverviewForCurrentUser, reconcileAccountForCurrentUser } from "@/server/assets";

async function reconcile(_previous: { status: "idle" | "success" | "error"; message?: string }, formData: FormData) {
  "use server";
  try {
    const raw = String(formData.get("actualBalance") ?? "");
    if (!/^-?\d+$/.test(raw)) throw new Error("Enter a whole-number balance");
    const result = await reconcileAccountForCurrentUser({ accountId: String(formData.get("accountId")), actualBalance: Number(raw), transactionAt: new Date().toISOString() });
    return { status: "success" as const, message: result.created ? "Adjustment created" : "Already reconciled" };
  } catch (error) {
    return { status: "error" as const, message: error instanceof Error ? error.message : "Unable to reconcile" };
  }
}

export default async function AssetsPage() {
  return <AssetOverview overview={await getAssetOverviewForCurrentUser()} action={reconcile} />;
}
