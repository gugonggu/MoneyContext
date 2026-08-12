import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/server/supabase/server";

export default async function HomePage() {
  const { data: { user } } = await (await createSupabaseServerClient()).auth.getUser();
  if (user) redirect("/home");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <Image src="/logo.png" alt="" width={72} height={72} priority className="mx-auto mb-6 rounded-2xl shadow-lg shadow-brand-600/20" />
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Money Context</h1>
        <p className="mt-4 text-lg text-slate-600">개인 재정 기록과 분석을 안전하게 시작하세요.</p>
        <Link
          href="/invite"
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          시작하기
        </Link>
      </div>
    </main>
  );
}
