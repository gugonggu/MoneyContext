import "server-only";

import { calculateAccountBalance, calculateLiquidAssets, type BalanceEvent } from "@/domain/accounts/balance";
import { calculateNetWorth } from "@/domain/accounts/net-worth";
import { calculateCreditCardOutstanding, type CardOutstandingEvent } from "@/domain/cards/outstanding";

export type AssetAccountType = "BANK" | "CASH" | "DEBIT" | "CREDIT_CARD" | "LIABILITY";
export type AssetTransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
export type AssetTransactionStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export type InstallmentPaymentStatus = "SCHEDULED" | "PAID" | "SKIPPED";

export type AssetAccountRecord = Readonly<{
  id: string;
  userId: string;
  name: string;
  type: AssetAccountType;
  initialBalance: number;
  linkedAccountId: string | null;
  sortOrder: number;
}>;

export type AssetTransactionRecord = Readonly<{
  id: string;
  userId: string;
  type: AssetTransactionType;
  status: AssetTransactionStatus;
  amount: number;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
}>;

export type AssetCardSettingsRecord = Readonly<{
  id: string;
  userId: string;
  accountId: string;
  paymentAccountId: string;
  paymentDay: number;
  creditLimit: number | null;
}>;

export type AssetInstallmentPaymentRecord = Readonly<{
  id: string;
  userId: string;
  cardAccountId: string;
  sequence: number;
  scheduledDate: string;
  principalAmount: number;
  feeAmount: number;
  status: InstallmentPaymentStatus;
}>;

export interface AssetReadRepository {
  listAccounts(userId: string): Promise<readonly AssetAccountRecord[]>;
  listTransactions(userId: string): Promise<readonly AssetTransactionRecord[]>;
  listCardSettings(userId: string): Promise<readonly AssetCardSettingsRecord[]>;
  listInstallmentPayments(userId: string): Promise<readonly AssetInstallmentPaymentRecord[]>;
}

export type AssetAccountModel = Readonly<{
  id: string;
  name: string;
  type: "BANK" | "CASH" | "DEBIT" | "LIABILITY";
  balance: number;
  linkedAccountId: string | null;
}>;

export type AssetAccountGroups = Readonly<{
  bank: readonly AssetAccountModel[];
  cash: readonly AssetAccountModel[];
  debit: readonly AssetAccountModel[];
  liability: readonly AssetAccountModel[];
}>;

export type AssetInstallmentScheduleItem = Readonly<{
  id: string;
  sequence: number;
  scheduledDate: string;
  principalAmount: number;
  feeAmount: number;
  status: InstallmentPaymentStatus;
}>;

export type AssetCardModel = Readonly<{
  id: string;
  name: string;
  outstanding: number;
  availableLimit: number | null;
  nextPaymentDate: string | null;
  installmentSchedule: readonly AssetInstallmentScheduleItem[];
}>;

export type AssetOverview = Readonly<{
  liquidAssets: number;
  liabilities: number;
  netWorth: number;
  accounts: AssetAccountGroups;
  cards: readonly AssetCardModel[];
}>;

function directBalanceEvent(transaction: AssetTransactionRecord): BalanceEvent | null {
  if (transaction.type === "TRANSFER") return null;
  return { type: transaction.type, amount: transaction.amount };
}

function accountBalanceEvents(
  account: AssetAccountRecord,
  transactions: readonly AssetTransactionRecord[],
  accountsById: ReadonlyMap<string, AssetAccountRecord>,
): BalanceEvent[] {
  const events: BalanceEvent[] = [];

  for (const transaction of transactions) {
    if (transaction.status !== "CONFIRMED") continue;

    if (transaction.type === "TRANSFER") {
      if (transaction.fromAccountId === account.id) events.push({ type: "TRANSFER_OUT", amount: transaction.amount });
      if (transaction.toAccountId === account.id) events.push({ type: "TRANSFER_IN", amount: transaction.amount });
      continue;
    }

    const directEvent = directBalanceEvent(transaction);
    if (!directEvent) continue;
    if (account.type !== "DEBIT" && transaction.accountId === account.id) events.push(directEvent);

    const paymentMethod = transaction.accountId ? accountsById.get(transaction.accountId) : undefined;
    if (paymentMethod?.type === "DEBIT" && paymentMethod.linkedAccountId === account.id) events.push(directEvent);
  }

  return events;
}

function cardOutstandingEvents(cardId: string, transactions: readonly AssetTransactionRecord[]): CardOutstandingEvent[] {
  return transactions.flatMap<CardOutstandingEvent>((transaction) => {
    if (transaction.status !== "CONFIRMED") return [];
    if (transaction.type === "EXPENSE" && transaction.accountId === cardId) {
      return [{ kind: "PURCHASE" as const, amount: transaction.amount }];
    }
    if (transaction.type === "TRANSFER" && transaction.toAccountId === cardId) {
      return [{ kind: "SETTLEMENT" as const, amount: transaction.amount }];
    }
    return [];
  });
}

function sortSchedule(payments: readonly AssetInstallmentPaymentRecord[]): AssetInstallmentScheduleItem[] {
  return payments
    .map(({ id, sequence, scheduledDate, principalAmount, feeAmount, status }) => ({
      id,
      sequence,
      scheduledDate,
      principalAmount,
      feeAmount,
      status,
    }))
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.sequence - right.sequence);
}

function emptyGroups(): { bank: AssetAccountModel[]; cash: AssetAccountModel[]; debit: AssetAccountModel[]; liability: AssetAccountModel[] } {
  return { bank: [], cash: [], debit: [], liability: [] };
}

export function createAssetReadService(repository: AssetReadRepository) {
  return {
    async getOverview(userId: string): Promise<AssetOverview> {
      const [allAccounts, allTransactions, allCardSettings, allPayments] = await Promise.all([
        repository.listAccounts(userId),
        repository.listTransactions(userId),
        repository.listCardSettings(userId),
        repository.listInstallmentPayments(userId),
      ]);
      const accounts = allAccounts.filter((account) => account.userId === userId);
      const transactions = allTransactions.filter((transaction) => transaction.userId === userId);
      const cardSettings = allCardSettings.filter((setting) => setting.userId === userId);
      const payments = allPayments.filter((payment) => payment.userId === userId);
      const accountsById = new Map(accounts.map((account) => [account.id, account]));
      const groups = emptyGroups();

      for (const account of accounts) {
        if (account.type === "CREDIT_CARD") continue;
        const balance = calculateAccountBalance(account.initialBalance, accountBalanceEvents(account, transactions, accountsById));
        const model: AssetAccountModel = {
          id: account.id,
          name: account.name,
          type: account.type,
          balance,
          linkedAccountId: account.linkedAccountId,
        };
        if (account.type === "BANK") groups.bank.push(model);
        if (account.type === "CASH") groups.cash.push(model);
        if (account.type === "DEBIT") groups.debit.push(model);
        if (account.type === "LIABILITY") groups.liability.push(model);
      }

      const liquidAssetAccounts = [...groups.bank, ...groups.cash, ...groups.debit].filter(
        (account): account is AssetAccountModel & { type: "BANK" | "CASH" | "DEBIT" } => account.type !== "LIABILITY",
      );
      const liquidAssets = calculateLiquidAssets(liquidAssetAccounts.map((account) => ({
        id: account.id,
        type: account.type,
        balance: account.balance,
        ...(account.linkedAccountId === null ? {} : { linkedAccountId: account.linkedAccountId }),
      })));
      const liabilities = groups.liability.reduce((total, account) => total + account.balance, 0);
      const settingsByCardId = new Map(cardSettings.map((setting) => [setting.accountId, setting]));
      const cards = accounts
        .filter((account) => account.type === "CREDIT_CARD")
        .map((card) => {
          const outstanding = calculateCreditCardOutstanding(cardOutstandingEvents(card.id, transactions));
          const schedule = sortSchedule(payments.filter((payment) => payment.cardAccountId === card.id));
          const settings = settingsByCardId.get(card.id);
          return {
            id: card.id,
            name: card.name,
            outstanding,
            availableLimit: settings?.creditLimit === null || settings === undefined ? null : settings.creditLimit - outstanding,
            nextPaymentDate: schedule.find((payment) => payment.status === "SCHEDULED")?.scheduledDate ?? null,
            installmentSchedule: schedule,
          };
        });

      return {
        liquidAssets,
        liabilities,
        netWorth: calculateNetWorth({
          liquidAssets,
          liabilities,
          creditCardOutstanding: cards.reduce((total, card) => total + card.outstanding, 0),
        }),
        accounts: groups,
        cards,
      };
    },
  };
}
