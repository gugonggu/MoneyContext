import type { ReactNode } from "react";

import { requireCurrentProfile } from "@/server/auth/require-profile";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireCurrentProfile();
  return children;
}
