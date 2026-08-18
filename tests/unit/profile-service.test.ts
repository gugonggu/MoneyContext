import { describe, expect, it } from "vitest";

import { createProfileService } from "@/server/profile/service";

describe("profile service", () => {
  it("음수 비상금 기준액을 거부한다", async () => {
    const service = createProfileService({ updateEmergencyFund: async () => {} });
    await expect(service.updateEmergencyFund("user-1", -1)).rejects.toThrow();
  });

  it("null을 전달하면 비상금 설정을 해제한다", async () => {
    let received: number | null = 0;
    const service = createProfileService({ updateEmergencyFund: async (_userId, amount) => { received = amount; } });
    await service.updateEmergencyFund("user-1", null);
    expect(received).toBeNull();
  });

  it("정수가 아닌 금액을 거부한다", async () => {
    const service = createProfileService({ updateEmergencyFund: async () => {} });
    await expect(service.updateEmergencyFund("user-1", 1.5)).rejects.toThrow();
  });
});
