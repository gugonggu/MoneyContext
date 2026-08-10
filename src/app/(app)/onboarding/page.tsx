import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/server/supabase/server";

export default function OnboardingPage() {
  async function complete(formData: FormData) {
    "use server";
    const displayName = String(formData.get("displayName") ?? "").trim();
    const salaryCycleDay = Number(formData.get("salaryCycleDay"));
    const bankName = String(formData.get("bankName") ?? "").trim();
    const bankBalance = String(formData.get("bankBalance") ?? "0");
    const cashName = String(formData.get("cashName") ?? "").trim();
    const cashBalance = String(formData.get("cashBalance") ?? "0");
    const liabilityName = String(formData.get("liabilityName") ?? "").trim();
    const liabilityBalance = String(formData.get("liabilityBalance") ?? "0");
    const cardName = String(formData.get("cardName") ?? "").trim();
    const cardPaymentDay = String(formData.get("cardPaymentDay") ?? "");
    const cardLimit = String(formData.get("cardLimit") ?? "");
    if (!displayName || !bankName || !Number.isInteger(salaryCycleDay) || salaryCycleDay < 1 || salaryCycleDay > 31 || !/^\d+$/.test(bankBalance)) redirect("/onboarding?error=invalid");
    if ((cashName && !/^\d+$/.test(cashBalance)) || (liabilityName && !/^\d+$/.test(liabilityBalance)) || (cardName && (!/^(?:[1-9]|[12]\d|3[01])$/.test(cardPaymentDay) || (cardLimit && !/^\d+$/.test(cardLimit))))) redirect("/onboarding?error=invalid");
    const accounts = [
      { key: "primary_bank", name: bankName, type: "BANK", initial_balance: bankBalance },
      ...(cashName ? [{ key: "cash", name: cashName, type: "CASH", initial_balance: cashBalance }] : []),
      ...(liabilityName ? [{ key: "liability", name: liabilityName, type: "LIABILITY", initial_balance: liabilityBalance }] : []),
      ...(cardName ? [{ key: "credit_card", name: cardName, type: "CREDIT_CARD", initial_balance: "0" }] : []),
    ];
    const { error } = await (await createSupabaseServerClient()).rpc("complete_onboarding", {
      input_display_name: displayName,
      input_salary_cycle_day: salaryCycleDay,
      input_accounts: accounts,
      input_cards: cardName ? [{ account_key: "credit_card", payment_account_key: "primary_bank", payment_day: cardPaymentDay, credit_limit: cardLimit }] : [],
    });
    if (error) redirect("/onboarding?error=save");
    redirect("/");
  }
  return (
    <main><h1>초기 금융 설정</h1><form action={complete}><label>이름<input name="displayName" required /></label><label>급여일<input name="salaryCycleDay" type="number" min="1" max="31" required /></label><label>첫 은행 계좌<input name="bankName" required /></label><label>현재 잔액<input name="bankBalance" inputMode="numeric" defaultValue="0" required /></label><label>현금 이름 (선택)<input name="cashName" /></label><label>현금 잔액<input name="cashBalance" inputMode="numeric" defaultValue="0" /></label><label>부채 이름 (선택)<input name="liabilityName" /></label><label>부채 잔액<input name="liabilityBalance" inputMode="numeric" defaultValue="0" /></label><label>신용카드 이름 (선택)<input name="cardName" /></label><label>카드 결제일<input name="cardPaymentDay" type="number" min="1" max="31" /></label><label>카드 한도<input name="cardLimit" inputMode="numeric" /></label><button type="submit">시작하기</button></form></main>
  );
}
