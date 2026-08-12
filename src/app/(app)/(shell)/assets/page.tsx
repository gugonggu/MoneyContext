import { AssetOverview } from "@/components/assets/AssetOverview";
import { getAssetOverviewForCurrentUser, reconcileAccountForCurrentUser } from "@/server/assets";

async function reconcile(_previous: { status: "idle" | "success" | "error"; message?: string }, formData: FormData) {
  "use server";
  try {
    const raw = String(formData.get("actualBalance") ?? "");
    if (!/^-?\d+$/.test(raw)) throw new Error("정수로 입력해주세요");
    const result = await reconcileAccountForCurrentUser({ accountId: String(formData.get("accountId")), actualBalance: Number(raw), transactionAt: new Date().toISOString() });
    return { status: "success" as const, message: result.created ? "조정 내역이 생성되었습니다" : "이미 일치합니다" };
  } catch (error) {
    return { status: "error" as const, message: error instanceof Error ? error.message : "잔액 조정에 실패했습니다" };
  }
}

export default async function AssetsPage() {
  return <AssetOverview overview={await getAssetOverviewForCurrentUser()} action={reconcile} />;
}
