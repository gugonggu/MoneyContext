import { expect, it } from "vitest";
import { splitInstallmentPrincipal } from "@/domain/cards/installments";

it("allocates installment remainders deterministically", () => {
  expect(splitInstallmentPrincipal(1_000, 3)).toEqual([334, 333, 333]);
});
