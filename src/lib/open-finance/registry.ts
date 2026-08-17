import "server-only";

import type { OpenFinanceProviderDescriptor } from "@/lib/open-finance/contracts";
import type { ValidatedOpenFinanceProvider } from "@/lib/open-finance/provider";

export class OpenFinanceProviderRegistry {
  readonly #providers: ReadonlyMap<string, ValidatedOpenFinanceProvider>;

  constructor(providers: readonly ValidatedOpenFinanceProvider[]) {
    const entries = new Map<string, ValidatedOpenFinanceProvider>();

    for (const provider of providers) {
      if (entries.has(provider.id)) {
        throw new Error("Open Finance provider is registered more than once.");
      }
      entries.set(provider.id, provider);
    }

    this.#providers = entries;
  }

  get(providerId: string) {
    const provider = this.#providers.get(providerId);
    if (!provider) throw new Error("Open Finance provider is unavailable.");
    return provider;
  }

  list(): readonly OpenFinanceProviderDescriptor[] {
    return Object.freeze(
      [...this.#providers.values()]
        .map(({ id, label }) => Object.freeze({ id, label }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"))
    );
  }
}
