import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/server/supabase/server";

export default async function HomePage() {
  const { data: { user } } = await (await createSupabaseServerClient()).auth.getUser();
  if (user) redirect("/home");

  return (
    <main>
      <h1>Money Context</h1>
      <p>개인 재정 기록과 분석을 안전하게 시작하세요.</p>
      <Link href="/invite">시작하기</Link>
    </main>
  );
}
