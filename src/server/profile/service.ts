import "server-only";

export interface ProfileRepository {
  updateEmergencyFund(userId: string, amount: number | null): Promise<void>;
}

export function createProfileService(repository: ProfileRepository) {
  return {
    async updateEmergencyFund(userId: string, amount: number | null): Promise<void> {
      if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) {
        throw new Error("emergency fund amount must be a non-negative integer");
      }
      await repository.updateEmergencyFund(userId, amount);
    },
  };
}
