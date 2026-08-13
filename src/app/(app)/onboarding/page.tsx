import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { createSupabaseServerClient } from "@/server/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "입력값을 다시 확인해주세요. 필수 항목과 숫자 형식을 확인하세요.",
  save: "설정을 저장하는 중 문제가 발생했습니다. 다시 시도해주세요.",
};

export default async function OnboardingPage({ searchParams }: Readonly<{ searchParams: Promise<{ error?: string }> }>) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "문제가 발생했습니다. 다시 시도해주세요." : null;

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
    const { error: rpcError } = await (await createSupabaseServerClient()).rpc("complete_onboarding", {
      input_display_name: displayName,
      input_salary_cycle_day: salaryCycleDay,
      input_accounts: accounts,
      input_cards: cardName ? [{ account_key: "credit_card", payment_account_key: "primary_bank", payment_day: cardPaymentDay, credit_limit: cardLimit }] : [],
    });
    if (rpcError) redirect("/onboarding?error=save");
    redirect("/home");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader title="초기 금융 설정" description="기본 정보와 계좌를 등록하면 바로 시작할 수 있어요." />

      {errorMessage ? (
        <div className="mb-6">
          <Alert kind="error" role="alert">
            {errorMessage}
          </Alert>
        </div>
      ) : null}

      <form action={complete} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">기본 정보</h2>
          <TextField label="이름" name="displayName" required />
          <TextField label="급여일" name="salaryCycleDay" type="number" min="1" max="31" required hint="매월 급여를 받는 날짜 (1~31)" />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">첫 은행 계좌</h2>
          <TextField label="첫 은행 계좌" name="bankName" required />
          <TextField label="현재 잔액" name="bankBalance" inputMode="numeric" defaultValue="0" required />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">현금 (선택)</h2>
          <TextField label="현금 이름 (선택)" name="cashName" />
          <TextField label="현금 잔액" name="cashBalance" inputMode="numeric" defaultValue="0" />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">부채 (선택)</h2>
          <TextField label="부채 이름 (선택)" name="liabilityName" />
          <TextField label="부채 잔액" name="liabilityBalance" inputMode="numeric" defaultValue="0" />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-content-primary">신용카드 (선택)</h2>
          <TextField label="신용카드 이름 (선택)" name="cardName" />
          <TextField label="카드 결제일" name="cardPaymentDay" type="number" min="1" max="31" hint="매월 결제일 (1~31)" />
          <TextField label="카드 한도" name="cardLimit" inputMode="numeric" />
        </Card>

        <Button type="submit" className="w-full">
          시작하기
        </Button>
      </form>
    </main>
  );
}
