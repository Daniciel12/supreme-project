"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@/components/ui";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  filterFinanceTransactions,
  formatTransactionDate,
  localDateKey,
  summarizeTransactionsForMonth,
  transactionStatusRequest,
  type FinanceTransaction,
  type TransactionStatusFilter,
  type TransactionTypeFilter,
} from "@/lib/finance-view";
import styles from "./finances.module.css";

interface FinancialAccount {
  id: string;
  name: string;
  type: string;
  initialBalance?: number;
  balance: number;
}

interface Transaction extends FinanceTransaction {
  title: string;
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatBRL(value: number) {
  return brlFormatter.format(value);
}

async function fetchAccounts() {
  const response = await fetch("/api/finances/accounts");
  const data = await response.json();
  if (!response.ok) throw new Error("accounts");
  return data as FinancialAccount[];
}

async function fetchTransactions() {
  const response = await fetch("/api/finances/transactions");
  const data = await response.json();
  if (!response.ok) throw new Error("transactions");
  return data as Transaction[];
}

export default function FinancasPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [accountsLoadError, setAccountsLoadError] = useState(false);
  const [transactionsLoadError, setTransactionsLoadError] = useState(false);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("CHECKING");
  const [accountBalance, setAccountBalance] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionTitle, setTransactionTitle] = useState("");
  const [transactionType, setTransactionType] = useState<"INCOME" | "EXPENSE">(
    "EXPENSE"
  );
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionAccountId, setTransactionAccountId] = useState("");
  const [transactionDate, setTransactionDate] = useState(localDateKey);
  const [transactionStatus, setTransactionStatus] = useState<"PAID" | "PENDING">(
    "PENDING"
  );
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [updatingTransactionId, setUpdatingTransactionId] = useState<string | null>(
    null
  );
  const [statusError, setStatusError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] =
    useState<TransactionStatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([fetchAccounts(), fetchTransactions()]).then(
      ([accountsResult, transactionsResult]) => {
        if (cancelled) return;

        if (accountsResult.status === "fulfilled") {
          setAccounts(accountsResult.value);
        } else {
          setAccountsLoadError(true);
        }
        setLoadingAccounts(false);

        if (transactionsResult.status === "fulfilled") {
          setTransactions(transactionsResult.value);
        } else {
          setTransactionsLoadError(true);
        }
        setLoadingTransactions(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAccountId = transactionAccountId || accounts[0]?.id || "";
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  const currentMonthKey = localDateKey().slice(0, 7);
  const monthlySummary = useMemo(
    () => summarizeTransactionsForMonth(transactions, currentMonthKey),
    [currentMonthKey, transactions]
  );
  const monthlyNet = monthlySummary.income - monthlySummary.expense;

  const filteredTransactions = useMemo(
    () =>
      filterFinanceTransactions(transactions, {
        status: statusFilter,
        type: typeFilter,
        accountId: accountFilter,
      }),
    [accountFilter, statusFilter, transactions, typeFilter]
  );

  async function refreshAccounts() {
    try {
      const nextAccounts = await fetchAccounts();
      setAccounts(nextAccounts);
      setAccountsLoadError(false);
    } catch (error) {
      console.error("Erro ao recarregar contas", error);
      setAccountsLoadError(true);
    }
  }

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setAccountError(null);

    const balance = Number(accountBalance);
    if (
      !accountName.trim() ||
      accountBalance.trim() === "" ||
      Number.isNaN(balance)
    ) {
      setAccountError("Preencha nome e saldo inicial com valores válidos.");
      return;
    }

    setSavingAccount(true);
    try {
      const response = await fetch("/api/finances/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountName,
          type: accountType,
          balance,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setAccountError(data.error ?? "Erro ao criar conta.");
        return;
      }

      setAccounts((previous) => [...previous, data]);
      setAccountName("");
      setAccountType("CHECKING");
      setAccountBalance("");
      setShowAccountForm(false);
    } catch (error) {
      console.error("Erro ao criar conta", error);
      setAccountError("Erro ao criar conta.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleCreateTransaction(event: FormEvent) {
    event.preventDefault();
    setTransactionError(null);

    const amount = Number(transactionAmount);
    if (
      !transactionTitle.trim() ||
      !selectedAccountId ||
      !transactionDate ||
      transactionAmount.trim() === "" ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      setTransactionError("Preencha título, conta, data e valor válidos.");
      return;
    }

    setSavingTransaction(true);
    try {
      const response = await fetch("/api/finances/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: transactionTitle,
          type: transactionType,
          amount,
          accountId: selectedAccountId,
          date: transactionDate,
          isPaid: transactionStatus === "PAID",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setTransactionError(data.error ?? "Erro ao criar transação.");
        return;
      }

      setTransactions((previous) => [data, ...previous]);
      setTransactionTitle("");
      setTransactionAmount("");
      setTransactionDate(localDateKey());
      setTransactionStatus("PENDING");
      setShowTransactionForm(false);

      if (data.isPaid) {
        await refreshAccounts();
      }
    } catch (error) {
      console.error("Erro ao criar transação", error);
      setTransactionError("Erro ao criar transação.");
    } finally {
      setSavingTransaction(false);
    }
  }

  async function handleToggleTransactionStatus(transaction: Transaction) {
    setStatusError(null);
    setUpdatingTransactionId(transaction.id);

    try {
      const request = transactionStatusRequest(transaction);
      const response = await fetch(request.url, request.init);
      const data = await response.json();

      if (!response.ok) {
        setStatusError(data.error ?? "Erro ao atualizar lançamento.");
        return;
      }

      setTransactions((previous) =>
        previous.map((item) => (item.id === data.id ? data : item))
      );
      await refreshAccounts();
    } catch (error) {
      console.error("Erro ao atualizar transação", error);
      setStatusError("Erro ao atualizar lançamento.");
    } finally {
      setUpdatingTransactionId(null);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        <PageHeader
          eyebrow="Finanças"
          title="Seu caixa, sem misturar promessa com realidade"
          description="Saldos e métricas usam apenas movimentações realizadas. Pendências continuam visíveis para você saber o que ainda precisa entrar ou sair."
          actions={
            <div className={styles.headerActions}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAccountForm((visible) => !visible)}
              >
                {showAccountForm ? "Fechar conta" : "Nova conta"}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowTransactionForm((visible) => !visible)}
                disabled={accounts.length === 0}
              >
                {showTransactionForm ? "Fechar lançamento" : "Novo lançamento"}
              </Button>
            </div>
          }
        />

        <section
          className={styles.cashOverview}
          aria-labelledby="cash-overview-title"
        >
          <div className={styles.cashPrimary}>
            <span className={styles.overviewEyebrow}>Caixa realizado</span>
            <h2 id="cash-overview-title" className={styles.overviewTitle}>
              O que já aconteceu
            </h2>
            <strong className={styles.balanceValue}>
              {loadingAccounts || accountsLoadError ? "—" : formatBRL(totalBalance)}
            </strong>
            <p className={styles.balanceDescription}>
              Saldo somado das suas contas, considerando apenas valores que já
              entraram ou saíram.
            </p>
            {!loadingAccounts && !accountsLoadError && (
              <span className={styles.accountCount}>
                {accounts.length} {accounts.length === 1 ? "conta ativa" : "contas ativas"}
              </span>
            )}
          </div>

          <div className={styles.overviewSignals}>
            <div className={styles.signalBlock}>
              <div className={styles.signalHeading}>
                <span className={styles.signalLabel}>Fluxo do mês</span>
                <span className={styles.signalStatus}>Realizado</span>
              </div>
              <dl className={styles.flowList}>
                <div>
                  <dt>Entradas</dt>
                  <dd className={styles.success}>
                    {loadingTransactions || transactionsLoadError
                      ? "—"
                      : formatBRL(monthlySummary.income)}
                  </dd>
                </div>
                <div>
                  <dt>Saídas</dt>
                  <dd className={styles.danger}>
                    {loadingTransactions || transactionsLoadError
                      ? "—"
                      : formatBRL(monthlySummary.expense)}
                  </dd>
                </div>
                <div className={styles.flowResult}>
                  <dt>Resultado</dt>
                  <dd
                    className={monthlyNet >= 0 ? styles.success : styles.danger}
                  >
                    {loadingTransactions || transactionsLoadError
                      ? "—"
                      : formatBRL(monthlyNet)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className={`${styles.signalBlock} ${styles.pendingSignal}`}>
              <div className={styles.signalHeading}>
                <span className={styles.signalLabel}>Próximos movimentos</span>
                <span className={styles.pendingCount}>
                  {loadingTransactions || transactionsLoadError
                    ? "—"
                    : `${monthlySummary.pendingCount} pendentes`}
                </span>
              </div>
              <p className={styles.pendingDescription}>
                Acompanhamento separado do saldo, para promessa não parecer dinheiro
                disponível.
              </p>
              {!loadingTransactions && !transactionsLoadError && (
                <dl className={styles.pendingValues}>
                  <div>
                    <dt>A receber</dt>
                    <dd>{formatBRL(monthlySummary.pendingIncome)}</dd>
                  </div>
                  <div>
                    <dt>A pagar</dt>
                    <dd>{formatBRL(monthlySummary.pendingExpense)}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        </section>

        {(showAccountForm || showTransactionForm) && (
          <section className={styles.formsGrid} aria-label="Novos registros financeiros">
            {showAccountForm && (
              <Card>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Nova conta</h2>
                    <p className={styles.sectionDescription}>
                      O saldo inicial é o ponto de partida; o saldo atual será derivado dos lançamentos pagos.
                    </p>
                  </div>
                </div>
                <form className="form" onSubmit={handleCreateAccount}>
                  <FormField label="Nome da conta" htmlFor="account-name">
                    <Input
                      id="account-name"
                      value={accountName}
                      onChange={(event) => setAccountName(event.target.value)}
                      placeholder="Ex: Conta principal"
                      disabled={savingAccount}
                    />
                  </FormField>
                  <div className="form-row">
                    <FormField label="Tipo" htmlFor="account-type">
                      <Select
                        id="account-type"
                        value={accountType}
                        onChange={(event) => setAccountType(event.target.value)}
                        disabled={savingAccount}
                      >
                        {ACCOUNT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Saldo inicial (R$)" htmlFor="account-balance">
                      <Input
                        id="account-balance"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={accountBalance}
                        onChange={(event) => setAccountBalance(event.target.value)}
                        placeholder="0,00"
                        disabled={savingAccount}
                      />
                    </FormField>
                  </div>
                  {accountError && <p className="error-text">{accountError}</p>}
                  <Button
                    type="submit"
                    isLoading={savingAccount}
                    loadingLabel="Salvando conta..."
                  >
                    Salvar conta
                  </Button>
                </form>
              </Card>
            )}

            {showTransactionForm && (
              <Card>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Novo lançamento</h2>
                    <p className={styles.sectionDescription}>
                      Marque como pago apenas quando o valor realmente tiver entrado ou saído.
                    </p>
                  </div>
                </div>
                <form className="form" onSubmit={handleCreateTransaction}>
                  <FormField label="Título" htmlFor="transaction-title">
                    <Input
                      id="transaction-title"
                      value={transactionTitle}
                      onChange={(event) => setTransactionTitle(event.target.value)}
                      placeholder="Ex: Salário, aluguel"
                      disabled={savingTransaction}
                    />
                  </FormField>
                  <div className="form-row">
                    <FormField label="Tipo" htmlFor="transaction-type">
                      <Select
                        id="transaction-type"
                        value={transactionType}
                        onChange={(event) =>
                          setTransactionType(
                            event.target.value as "INCOME" | "EXPENSE"
                          )
                        }
                        disabled={savingTransaction}
                      >
                        <option value="EXPENSE">Despesa</option>
                        <option value="INCOME">Receita</option>
                      </Select>
                    </FormField>
                    <FormField label="Valor (R$)" htmlFor="transaction-amount">
                      <Input
                        id="transaction-amount"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={transactionAmount}
                        onChange={(event) => setTransactionAmount(event.target.value)}
                        placeholder="0,00"
                        disabled={savingTransaction}
                      />
                    </FormField>
                  </div>
                  <div className="form-row">
                    <FormField label="Data" htmlFor="transaction-date">
                      <Input
                        id="transaction-date"
                        type="date"
                        value={transactionDate}
                        onChange={(event) => setTransactionDate(event.target.value)}
                        disabled={savingTransaction}
                      />
                    </FormField>
                    <FormField label="Status" htmlFor="transaction-status">
                      <Select
                        id="transaction-status"
                        value={transactionStatus}
                        onChange={(event) =>
                          setTransactionStatus(
                            event.target.value as "PAID" | "PENDING"
                          )
                        }
                        disabled={savingTransaction}
                      >
                        <option value="PAID">Pago / realizado</option>
                        <option value="PENDING">Pendente</option>
                      </Select>
                    </FormField>
                  </div>
                  <FormField label="Conta" htmlFor="transaction-account">
                    <Select
                      id="transaction-account"
                      value={selectedAccountId}
                      onChange={(event) => setTransactionAccountId(event.target.value)}
                      disabled={savingTransaction || accounts.length === 0}
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  {transactionError && (
                    <p className="error-text">{transactionError}</p>
                  )}
                  <Button
                    type="submit"
                    disabled={accounts.length === 0}
                    isLoading={savingTransaction}
                    loadingLabel="Salvando lançamento..."
                  >
                    Salvar lançamento
                  </Button>
                </form>
              </Card>
            )}
          </section>
        )}

        <section className={styles.contentGrid}>
          <Card>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Carteira</h2>
                <p className={styles.sectionDescription}>
                  O saldo atual de cada conta acompanha apenas movimentações liquidadas.
                </p>
              </div>
              <Badge tone="accent">{accounts.length} contas</Badge>
            </div>

            {loadingAccounts ? (
              <LoadingState title="Carregando contas..." />
            ) : accountsLoadError ? (
              <ErrorState
                title="Não foi possível carregar as contas"
                description="Atualize a página para tentar novamente."
              />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="Nenhuma conta cadastrada"
                description="Crie a primeira conta para começar a acompanhar seu caixa."
                action={
                  <Button size="sm" onClick={() => setShowAccountForm(true)}>
                    Criar conta
                  </Button>
                }
              />
            ) : (
              <ul className={styles.accountsList}>
                {accounts.map((account) => (
                  <li key={account.id} className={styles.accountItem}>
                    <div className={styles.accountMeta}>
                      <strong>{account.name}</strong>
                      <Badge tone="accent">
                        {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                      </Badge>
                    </div>
                    <div className={styles.accountBalance}>
                      <strong>{formatBRL(account.balance)}</strong>
                      {account.initialBalance != null && (
                        <span>Inicial: {formatBRL(account.initialBalance)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className={styles.transactionsCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Movimentações</h2>
                <p className={styles.sectionDescription}>
                  Filtre o histórico e liquide pendências sem perder o vínculo com a conta.
                </p>
              </div>
              <Badge tone="accent">{filteredTransactions.length} exibidas</Badge>
            </div>

            <div className={styles.filters} aria-label="Filtros de movimentações">
              <FormField label="Status" htmlFor="filter-status">
                <Select
                  id="filter-status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as TransactionStatusFilter)
                  }
                >
                  <option value="ALL">Todos</option>
                  <option value="PAID">Pagas</option>
                  <option value="PENDING">Pendentes</option>
                </Select>
              </FormField>
              <FormField label="Tipo" htmlFor="filter-type">
                <Select
                  id="filter-type"
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as TransactionTypeFilter)
                  }
                >
                  <option value="ALL">Todos</option>
                  <option value="INCOME">Receitas</option>
                  <option value="EXPENSE">Despesas</option>
                </Select>
              </FormField>
              <FormField label="Conta" htmlFor="filter-account">
                <Select
                  id="filter-account"
                  value={accountFilter}
                  onChange={(event) => setAccountFilter(event.target.value)}
                >
                  <option value="ALL">Todas</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {statusError && <p className="error-text">{statusError}</p>}

            {loadingTransactions ? (
              <LoadingState title="Carregando movimentações..." />
            ) : transactionsLoadError ? (
              <ErrorState
                title="Não foi possível carregar as movimentações"
                description="Atualize a página para tentar novamente."
              />
            ) : transactions.length === 0 ? (
              <EmptyState
                title="Nenhum lançamento cadastrado"
                description="Registre sua primeira receita ou despesa."
                action={
                  accounts.length > 0 ? (
                    <Button size="sm" onClick={() => setShowTransactionForm(true)}>
                      Novo lançamento
                    </Button>
                  ) : undefined
                }
              />
            ) : filteredTransactions.length === 0 ? (
              <EmptyState
                title="Nenhuma movimentação nesses filtros"
                description="Ajuste status, tipo ou conta para ampliar o histórico exibido."
              />
            ) : (
              <ul className={styles.transactionList}>
                {filteredTransactions.map((transaction) => {
                  const account = accountById.get(transaction.accountId);
                  return (
                    <li key={transaction.id} className={styles.transactionItem}>
                      <div className={styles.transactionMain}>
                        <div className={styles.transactionBadges}>
                          <Badge
                            tone={
                              transaction.type === "INCOME" ? "success" : "danger"
                            }
                          >
                            {transaction.type === "INCOME" ? "Receita" : "Despesa"}
                          </Badge>
                          <Badge tone={transaction.isPaid ? "success" : "warning"}>
                            {transaction.isPaid ? "Pago" : "Pendente"}
                          </Badge>
                        </div>
                        <strong className={styles.transactionTitle}>
                          {transaction.title}
                        </strong>
                        <span className={styles.transactionMeta}>
                          {formatTransactionDate(transaction.date)} · {account?.name ?? "Conta removida"}
                        </span>
                      </div>
                      <div className={styles.transactionAside}>
                        <strong
                          className={
                            transaction.type === "INCOME"
                              ? styles.success
                              : styles.danger
                          }
                        >
                          {transaction.type === "INCOME" ? "+" : "-"} {formatBRL(
                            transaction.amount
                          )}
                        </strong>
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={updatingTransactionId === transaction.id}
                          disabled={updatingTransactionId !== null}
                          loadingLabel="Atualizando..."
                          onClick={() => handleToggleTransactionStatus(transaction)}
                        >
                          {transaction.isPaid
                            ? "Marcar como pendente"
                            : "Marcar como pago"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
