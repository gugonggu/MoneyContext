"use client";

import { Button } from "@/components/ui/Button";

export function ConfirmTransactionButton({
  id,
  query,
  action,
}: Readonly<{ id: string; query: string; action: (formData: FormData) => Promise<void> }>) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="query" value={query} />
      <Button type="submit" variant="ghost">
        확정
      </Button>
    </form>
  );
}
