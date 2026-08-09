export interface FinanceTransaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  date: string;
  isPaid: boolean;
  accountId: string;
}

export type TransactionStatusFilter = "ALL" | "PAID" | "PENDING";
export type TransactionTypeFilter = "ALL" | "INCOME" | "EXPENSE";

export const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Conta corrente" },
  { value: "SAVINGS", label: "Poupança" },
  { value: "CASH", label: "Dinheiro" },
  { value: "INVESTMENT", label: "Investimento" },
  { value: "CREDIT", label: "Crédito" },
  { value: "OTHER", label: "Outro" },
] as const;

export const ACCOUNT_TYPE_LABELS = Object.fromEntries(
  ACCOUNT_TYPES.map((type) => [type.value, type.label])
) as Record<string, string>;

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const transactionDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
});

export function formatTransactionDate(value: string) {
  return transactionDateFormatter.format(new Date(value));
}

export function summarizeTransactionsForMonth(
  transactions: FinanceTransaction[],
  monthKey: string
) {
  const currentMonthTransactions = transactions.filter(
    (transaction) => transaction.date.slice(0, 7) === monthKey
  );
  const paid = currentMonthTransactions.filter((transaction) => transaction.isPaid);
  const pending = currentMonthTransactions.filter(
    (transaction) => !transaction.isPaid
  );

  return {
    income: paid
      .filter((transaction) => transaction.type === "INCOME")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    expense: paid
      .filter((transaction) => transaction.type === "EXPENSE")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    pendingCount: pending.length,
    pendingIncome: pending
      .filter((transaction) => transaction.type === "INCOME")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    pendingExpense: pending
      .filter((transaction) => transaction.type === "EXPENSE")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  };
}

export function filterFinanceTransactions<T extends FinanceTransaction>(
  transactions: T[],
  filters: {
    status: TransactionStatusFilter;
    type: TransactionTypeFilter;
    accountId: string;
  }
): T[] {
  return transactions.filter((transaction) => {
    const statusMatches =
      filters.status === "ALL" ||
      (filters.status === "PAID" && transaction.isPaid) ||
      (filters.status === "PENDING" && !transaction.isPaid);
    const typeMatches =
      filters.type === "ALL" || transaction.type === filters.type;
    const accountMatches =
      filters.accountId === "ALL" || transaction.accountId === filters.accountId;

    return statusMatches && typeMatches && accountMatches;
  });
}

export function transactionStatusRequest(
  transaction: Pick<FinanceTransaction, "id" | "isPaid">
) {
  return {
    url: `/api/finances/transactions/${transaction.id}`,
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: !transaction.isPaid }),
    },
  };
}
