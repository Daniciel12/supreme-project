-- Finance Data Model v2
-- Preserve existing data while moving money to decimal-safe storage and
-- constraining closed financial domain values.

-- Transaction semantics cannot be inferred safely from an unknown value.
-- Abort before changing any columns instead of silently reclassifying data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "transactions"
    WHERE UPPER(TRIM("type")) NOT IN ('INCOME', 'EXPENSE')
  ) THEN
    RAISE EXCEPTION 'Cannot migrate unknown transaction type to TransactionType';
  END IF;
END
$$;

CREATE TYPE "FinancialAccountType" AS ENUM (
  'CHECKING',
  'SAVINGS',
  'CASH',
  'INVESTMENT',
  'CREDIT',
  'OTHER'
);

CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE "financial_accounts"
  ALTER COLUMN "balance" TYPE DECIMAL(19,2)
  USING ROUND("balance"::numeric, 2);

ALTER TABLE "transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(19,2)
  USING ROUND("amount"::numeric, 2);

ALTER TABLE "financial_accounts"
  ALTER COLUMN "type" TYPE "FinancialAccountType"
  USING (
    CASE
      WHEN UPPER(TRIM("type")) IN ('CHECKING', 'CORRENTE', 'CONTA CORRENTE') THEN 'CHECKING'
      WHEN UPPER(TRIM("type")) IN ('SAVINGS', 'POUPANCA', 'POUPANÇA') THEN 'SAVINGS'
      WHEN UPPER(TRIM("type")) IN ('CASH', 'DINHEIRO', 'CARTEIRA') THEN 'CASH'
      WHEN UPPER(TRIM("type")) IN ('INVESTMENT', 'INVESTIMENTO', 'INVESTIMENTOS') THEN 'INVESTMENT'
      WHEN UPPER(TRIM("type")) IN ('CREDIT', 'CREDITO', 'CRÉDITO', 'CARTAO', 'CARTÃO', 'CARTAO DE CREDITO', 'CARTÃO DE CRÉDITO') THEN 'CREDIT'
      ELSE 'OTHER'
    END
  )::"FinancialAccountType";

ALTER TABLE "transactions"
  ALTER COLUMN "type" TYPE "TransactionType"
  USING (
    CASE
      WHEN UPPER(TRIM("type")) = 'INCOME' THEN 'INCOME'
      WHEN UPPER(TRIM("type")) = 'EXPENSE' THEN 'EXPENSE'
    END
  )::"TransactionType";
