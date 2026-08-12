"use client";

import { Button } from "@/components/ui/Button";

export function DeleteTransactionButton({
  id,
  query,
  action,
}: Readonly<{ id: string; query: string; action: (formData: FormData) => Promise<void> }>) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("이 거래를 삭제할까요?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="query" value={query} />
      <Button type="submit" variant="ghost">
        삭제
      </Button>
    </form>
  );
}
