"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";

interface FinancialAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface Transaction {
  id: string;
  title: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  date: string;
  isPaid: boolean;
  accountId: string;
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatBRL(value: number): string {
  return brlFormatter.format(value);
}

export default function FinancasPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // --- Nova conta ---
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountBalance, setAccountBalance] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // --- Nova transação ---
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionTitle, setTransactionTitle] = useState("");
  const [transactionType, setTransactionType] = useState<"INCOME" | "EXPENSE">(
    "EXPENSE"
  );
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionAccountId, setTransactionAccountId] = useState("");
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/finances/accounts");
        const data = await res.json();
        if (res.ok) setAccounts(data);
      } catch (err) {
        console.error("Erro ao carregar contas", err);
      } finally {
        setLoadingAccounts(false);
      }
    }

    async function loadTransactions() {
      try {
        const res = await fetch("/api/finances/transactions");
        const data = await res.json();
        if (res.ok) setTransactions(data);
      } catch (err) {
        console.error("Erro ao carregar transações", err);
      } finally {
        setLoadingTransactions(false);
      }
    }

    loadAccounts();
    loadTransactions();
  }, []);

  // Conta selecionada no formulário de transação: usa o valor escolhido
  // pelo usuário ou cai para a primeira conta da lista (derivado no render,
  // sem precisar sincronizar estado em um efeito).
  const selectedAccountId = transactionAccountId || accounts[0]?.id || "";

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  const { monthlyIncome, monthlyExpense } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions.reduce(
      (acc, tx) => {
        const txDate = new Date(tx.date);
        if (
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear
        ) {
          if (tx.type === "INCOME") acc.monthlyIncome += tx.amount;
          if (tx.type === "EXPENSE") acc.monthlyExpense += tx.amount;
        }
        return acc;
      },
      { monthlyIncome: 0, monthlyExpense: 0 }
    );
  }, [transactions]);

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setAccountError(null);

    const balanceNum = Number(accountBalance);

    if (!accountName.trim() || !accountType.trim() || Number.isNaN(balanceNum)) {
      setAccountError("Preencha nome, tipo e um saldo válido.");
      return;
    }

    setSavingAccount(true);
    try {
      const res = await fetch("/api/finances/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountName,
          type: accountType,
          balance: balanceNum,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAccountError(data.error ?? "Erro ao criar conta.");
        return;
      }

      setAccounts((prev) => [...prev, data]);
      setAccountName("");
      setAccountType("");
      setAccountBalance("");
      setShowAccountForm(false);
    } catch (err) {
      console.error("Erro ao criar conta", err);
      setAccountError("Erro ao criar conta.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleCreateTransaction(event: FormEvent) {
    event.preventDefault();
    setTransactionError(null);

    const amountNum = Number(transactionAmount);

    if (
      !transactionTitle.trim() ||
      !selectedAccountId ||
      Number.isNaN(amountNum)
    ) {
      setTransactionError("Preencha título, conta e um valor válido.");
      return;
    }

    setSavingTransaction(true);
    try {
      const res = await fetch("/api/finances/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: transactionTitle,
          type: transactionType,
          amount: amountNum,
          accountId: selectedAccountId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTransactionError(data.error ?? "Erro ao criar transação.");
        return;
      }

      setTransactions((prev) => [data, ...prev]);
      setTransactionTitle("");
      setTransactionAmount("");
      setShowTransactionForm(false);
    } catch (err) {
      console.error("Erro ao criar transação", err);
      setTransactionError("Erro ao criar transação.");
    } finally {
      setSavingTransaction(false);
    }
  }

  return (
    <main className="main-content">
      <div className="container">
        {/* Seção 1 — Visão Geral */}
        <div className="finance-overview">
          <div className="card stat-card">
            <span className="stat-label">Saldo Total</span>
            <span className="stat-value">
              {loadingAccounts ? "—" : formatBRL(totalBalance)}
            </span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Receitas do Mês</span>
            <span className="stat-value text-success">
              {loadingTransactions ? "—" : formatBRL(monthlyIncome)}
            </span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Despesas do Mês</span>
            <span className="stat-value text-danger">
              {loadingTransactions ? "—" : formatBRL(monthlyExpense)}
            </span>
          </div>
        </div>

        {/* Seção 2 — Gestão */}
        <div className="finance-section-grid">
          {/* Minha Carteira */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Minha Carteira</h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowAccountForm((v) => !v)}
              >
                {showAccountForm ? "Fechar" : "+ Nova conta"}
              </button>
            </div>

            {loadingAccounts ? (
              <p className="empty-state">Carregando contas...</p>
            ) : accounts.length === 0 ? (
              <p className="empty-state">
                Nenhuma conta cadastrada ainda. Crie a primeira abaixo.
              </p>
            ) : (
              <ul className="wallet-list">
                {accounts.map((account) => (
                  <li key={account.id} className="wallet-item">
                    <div>
                      <div className="wallet-item-name">{account.name}</div>
                      <span className="badge badge--accent">
                        {account.type}
                      </span>
                    </div>
                    <span className="wallet-item-balance">
                      {formatBRL(account.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {showAccountForm && (
              <div className="inline-toggle-panel">
                <form className="form" onSubmit={handleCreateAccount}>
                  <div className="form-row">
                    <input
                      type="text"
                      className="input"
                      placeholder="Nome da conta"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="Tipo (ex: Corrente)"
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                    />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="Saldo inicial (R$)"
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(e.target.value)}
                  />
                  {accountError && (
                    <p className="error-text">{accountError}</p>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingAccount}
                  >
                    {savingAccount ? "Salvando..." : "Salvar conta"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Últimas Transações */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Últimas Transações</h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowTransactionForm((v) => !v)}
              >
                {showTransactionForm ? "Fechar" : "+ Nova transação"}
              </button>
            </div>

            {loadingTransactions ? (
              <p className="empty-state">Carregando transações...</p>
            ) : transactions.length === 0 ? (
              <p className="empty-state">
                Nenhuma transação lançada ainda. Crie a primeira abaixo.
              </p>
            ) : (
              <ul className="transaction-list">
                {transactions.map((tx) => (
                  <li key={tx.id} className="transaction-item">
                    <div>
                      <div className="transaction-item-title">{tx.title}</div>
                      <div className="transaction-item-meta">
                        {new Date(tx.date).toLocaleDateString("pt-BR")}
                        {tx.isPaid ? " · Pago" : " · Pendente"}
                      </div>
                    </div>
                    <span
                      className={`transaction-item-amount ${
                        tx.type === "INCOME" ? "text-success" : "text-danger"
                      }`}
                    >
                      {tx.type === "INCOME" ? "+ " : "- "}
                      {formatBRL(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {showTransactionForm && (
              <div className="inline-toggle-panel">
                <form className="form" onSubmit={handleCreateTransaction}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Título (ex: Salário, Aluguel)"
                    value={transactionTitle}
                    onChange={(e) => setTransactionTitle(e.target.value)}
                  />
                  <div className="form-row">
                    <select
                      className="input"
                      value={transactionType}
                      onChange={(e) =>
                        setTransactionType(
                          e.target.value as "INCOME" | "EXPENSE"
                        )
                      }
                    >
                      <option value="EXPENSE">Despesa</option>
                      <option value="INCOME">Receita</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="Valor (R$)"
                      value={transactionAmount}
                      onChange={(e) => setTransactionAmount(e.target.value)}
                    />
                  </div>
                  <select
                    className="input"
                    value={selectedAccountId}
                    onChange={(e) => setTransactionAccountId(e.target.value)}
                    disabled={accounts.length === 0}
                  >
                    {accounts.length === 0 ? (
                      <option value="">Cadastre uma conta primeiro</option>
                    ) : (
                      accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))
                    )}
                  </select>
                  {transactionError && (
                    <p className="error-text">{transactionError}</p>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingTransaction || accounts.length === 0}
                  >
                    {savingTransaction ? "Salvando..." : "Lançar transação"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
