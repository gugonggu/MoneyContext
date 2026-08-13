import { revalidatePath } from "next/cache";

import type { AddAccountActionState } from "@/components/assets/AddAccountForm";
import { AssetOverview } from "@/components/assets/AssetOverview";
import type { EditAccountActionState } from "@/components/assets/EditAccountForm";
import type { EditCreditCardActionState } from "@/components/assets/EditCreditCardForm";
import {
  createAccountForCurrentUser,
  createCreditCardSettingsForCurrentUser,
  listAccountsForCurrentUser,
  updateAccountForCurrentUser,
  updateCreditCardSettingsForCurrentUser,
} from "@/server/accounts";
import type { AccountType } from "@/server/accounts/service";
import { getAssetOverviewForCurrentUser, reconcileAccountForCurrentUser } from "@/server/assets";

const SIMPLE_ACCOUNT_TYPES = new Set<AccountType>(["BANK", "CASH", "LIABILITY"]);

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

async function addAccount(_previous: AddAccountActionState, formData: FormData): Promise<AddAccountActionState> {
  "use server";
  try {
    const type = String(formData.get("type") ?? "") as AccountType;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("이름을 입력해주세요");

    if (type === "DEBIT") {
      const linkedAccountId = String(formData.get("linkedAccountId") ?? "");
      if (!linkedAccountId) throw new Error("연결할 은행 계좌를 선택해주세요");
      await createAccountForCurrentUser({ name, type: "DEBIT", initialBalance: 0, linkedAccountId });
    } else if (type === "CREDIT_CARD") {
      const paymentAccountId = String(formData.get("paymentAccountId") ?? "");
      const paymentDayRaw = String(formData.get("paymentDay") ?? "");
      const creditLimitRaw = String(formData.get("creditLimit") ?? "").trim();
      const firstPaymentDateRaw = String(formData.get("firstPaymentDate") ?? "").trim();
      if (!paymentAccountId) throw new Error("결제 계좌를 선택해주세요");
      if (!/^\d+$/.test(paymentDayRaw)) throw new Error("결제일을 입력해주세요");
      if (creditLimitRaw && !/^\d+$/.test(creditLimitRaw)) throw new Error("한도는 숫자로 입력해주세요");

      const account = await createAccountForCurrentUser({ name, type: "CREDIT_CARD", initialBalance: 0 });
      await createCreditCardSettingsForCurrentUser({
        accountId: account.id,
        paymentAccountId,
        paymentDay: Number(paymentDayRaw),
        creditLimit: creditLimitRaw ? Number(creditLimitRaw) : undefined,
        firstPaymentDate: firstPaymentDateRaw || undefined,
      });
    } else if (SIMPLE_ACCOUNT_TYPES.has(type)) {
      const initialBalanceRaw = String(formData.get("initialBalance") ?? "0");
      if (!/^\d+$/.test(initialBalanceRaw)) throw new Error("잔액은 숫자로 입력해주세요");
      await createAccountForCurrentUser({ name, type, initialBalance: Number(initialBalanceRaw) });
    } else {
      throw new Error("계좌 종류를 선택해주세요");
    }

    revalidatePath("/assets");
    return { status: "success" as const, message: "추가했습니다" };
  } catch (error) {
    return { status: "error" as const, message: error instanceof Error ? error.message : "추가에 실패했습니다" };
  }
}

async function editAccount(_previous: EditAccountActionState, formData: FormData): Promise<EditAccountActionState> {
  "use server";
  try {
    const accountId = String(formData.get("accountId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!accountId) throw new Error("계좌를 찾을 수 없습니다");
    if (!name) throw new Error("이름을 입력해주세요");

    const linkedAccountIdRaw = formData.get("linkedAccountId");
    const linkedAccountId = typeof linkedAccountIdRaw === "string" && linkedAccountIdRaw ? linkedAccountIdRaw : undefined;
    if (linkedAccountIdRaw !== null && !linkedAccountId) throw new Error("연결할 은행 계좌를 선택해주세요");

    // "잔액 직접 변경" sets the raw initial_balance to whatever value makes the
    // account's currently-displayed (computed) balance equal the requested
    // number, with no ADJUSTMENT transaction recorded - unlike reconciliation.
    const balanceRaw = formData.get("balance");
    let initialBalance: number | undefined;
    if (typeof balanceRaw === "string" && balanceRaw !== "") {
      if (!/^\d+$/.test(balanceRaw)) throw new Error("잔액은 숫자로 입력해주세요");
      const desiredBalance = Number(balanceRaw);
      const [accounts, overview] = await Promise.all([listAccountsForCurrentUser(), getAssetOverviewForCurrentUser()]);
      const rawAccount = accounts.find((account) => account.id === accountId);
      const currentBalance = [...overview.accounts.bank, ...overview.accounts.cash, ...overview.accounts.liability].find(
        (account) => account.id === accountId,
      )?.balance;
      if (!rawAccount || currentBalance === undefined) throw new Error("계좌를 찾을 수 없습니다");
      initialBalance = desiredBalance - currentBalance + rawAccount.initialBalance;
    }

    await updateAccountForCurrentUser(accountId, {
      name,
      ...(linkedAccountId ? { linkedAccountId } : {}),
      ...(initialBalance !== undefined ? { initialBalance } : {}),
    });

    revalidatePath("/assets");
    return { status: "success" as const, message: "저장했습니다" };
  } catch (error) {
    return { status: "error" as const, message: error instanceof Error ? error.message : "저장에 실패했습니다" };
  }
}

async function editCreditCard(_previous: EditCreditCardActionState, formData: FormData): Promise<EditCreditCardActionState> {
  "use server";
  try {
    const accountId = String(formData.get("accountId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const paymentAccountId = String(formData.get("paymentAccountId") ?? "");
    const paymentDayRaw = String(formData.get("paymentDay") ?? "");
    const creditLimitRaw = String(formData.get("creditLimit") ?? "").trim();
    const firstPaymentDateRaw = String(formData.get("firstPaymentDate") ?? "").trim();
    if (!accountId) throw new Error("카드를 찾을 수 없습니다");
    if (!name) throw new Error("이름을 입력해주세요");
    if (!paymentAccountId) throw new Error("결제 계좌를 선택해주세요");
    if (!/^\d+$/.test(paymentDayRaw)) throw new Error("결제일을 입력해주세요");
    if (creditLimitRaw && !/^\d+$/.test(creditLimitRaw)) throw new Error("한도는 숫자로 입력해주세요");

    await updateAccountForCurrentUser(accountId, { name });
    await updateCreditCardSettingsForCurrentUser(accountId, {
      paymentAccountId,
      paymentDay: Number(paymentDayRaw),
      creditLimit: creditLimitRaw ? Number(creditLimitRaw) : undefined,
      firstPaymentDate: firstPaymentDateRaw || undefined,
    });

    revalidatePath("/assets");
    return { status: "success" as const, message: "저장했습니다" };
  } catch (error) {
    return { status: "error" as const, message: error instanceof Error ? error.message : "저장에 실패했습니다" };
  }
}

export default async function AssetsPage() {
  return (
    <AssetOverview
      overview={await getAssetOverviewForCurrentUser()}
      action={reconcile}
      addAccountAction={addAccount}
      editAccountAction={editAccount}
      editCreditCardAction={editCreditCard}
    />
  );
}
