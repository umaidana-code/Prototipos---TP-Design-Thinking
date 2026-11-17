import {
  BudgetHealth,
  BudgetRules,
  DerivationReason,
  ExceptionRule,
  Rubro,
} from '../types/budget';

export function formatARS(amount: number): string {
  const rounded = Math.round(amount);
  const absFormatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Math.abs(rounded));
  return rounded < 0 ? `-${absFormatted}` : absFormatted;
}

export function formatMillions(amount: number): string {
  const millions = amount / 1_000_000;
  return `$${millions.toLocaleString('es-AR', {
    minimumFractionDigits: millions % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })}M`;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function getRubroConsumed(rubro: Rubro): number {
  return rubro.executed + rubro.committed;
}

export function getRubroAvailable(rubro: Rubro): number {
  return Math.max(0, rubro.limit - getRubroConsumed(rubro));
}

export function getRubroHealth(
  consumed: number,
  limit: number,
  preventivePercent = 70,
  highPercent = 80,
  exhaustedPercent = 100
): BudgetHealth {
  if (limit <= 0) return 'exhausted';
  const pct = (consumed / limit) * 100;
  if (pct >= exhaustedPercent) return 'exhausted';
  if (pct >= highPercent) return 'high';
  if (pct >= preventivePercent) return 'preventive';
  return 'ok';
}

export interface OrderValidationResult {
  isValidAmount: boolean;
  requiresManager: boolean;
  reason: DerivationReason;
  hasAvailableBudget: boolean;
  withinRubroLimit: boolean;
  withinManagerThreshold: boolean;
  highRemainingShare: boolean;
  remainingSharePct: number;
  postPurchaseAvailable: number;
  postPurchasePct: number;
  postPurchaseHealth: BudgetHealth;
  matchedException: ExceptionRule | null;
}

export function evaluateOrderValidation(
  amount: number,
  rubro: Rubro,
  supplier: string,
  rules: BudgetRules,
  exceptions: ExceptionRule[]
): OrderValidationResult {
  const consumed = getRubroConsumed(rubro);
  const available = Math.max(0, rubro.limit - consumed);
  const currentPct = rubro.limit > 0 ? (consumed / rubro.limit) * 100 : 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      isValidAmount: false,
      requiresManager: false,
      reason: null,
      hasAvailableBudget: available > 0,
      withinRubroLimit: true,
      withinManagerThreshold: true,
      highRemainingShare: false,
      remainingSharePct: 0,
      postPurchaseAvailable: available,
      postPurchasePct: currentPct,
      postPurchaseHealth: getRubroHealth(
        consumed,
        rubro.limit,
        rules.preventivePercent,
        rules.highConsumptionPercent,
        rules.exhaustedPercent
      ),
      matchedException: null,
    };
  }

  const hasAvailableBudget = available > 0 && amount <= available;
  const withinRubroLimit = consumed + amount <= rubro.limit;
  const exceedsLargeThreshold = amount >= rules.largePurchaseThreshold;
  const remainingSharePct = available > 0 ? (amount / available) * 100 : 100;
  const highRemainingShare =
    available > 0 && remainingSharePct >= rules.highRemainingShareThreshold;

  // Check if an active manager exception covers a large purchase within balance
  const matchedException =
    exceptions.find(
      (ex) =>
        ex.active &&
        (ex.rubroId === 'all' || ex.rubroId === rubro.id) &&
        (ex.supplier === 'all' ||
          ex.supplier.toLowerCase() === supplier.trim().toLowerCase()) &&
        amount <= ex.maxAmount
    ) ?? null;

  const effectiveThresholdExceeded = exceedsLargeThreshold && !matchedException;
  const isBudgetExhausted = currentPct >= rules.exhaustedPercent || !hasAvailableBudget;
  const highShareRequiresManager =
    rules.requireManagerOnHighRemainingShare && highRemainingShare;

  const triggeredChecks: DerivationReason[] = [];
  if (isBudgetExhausted && !withinRubroLimit) {
    triggeredChecks.push(
      available === 0 ? 'exhausted_budget' : 'insufficient_balance'
    );
  }
  if (effectiveThresholdExceeded) {
    triggeredChecks.push('large_purchase');
  }
  if (highShareRequiresManager) {
    triggeredChecks.push('high_remaining_share');
  }

  let reason: DerivationReason = null;
  if (triggeredChecks.length > 1) {
    reason = 'multiple';
  } else if (triggeredChecks.length === 1) {
    reason = triggeredChecks[0];
  }

  const postPurchaseAvailable = rubro.limit - (consumed + amount);
  const postPurchasePct =
    rubro.limit > 0 ? ((consumed + amount) / rubro.limit) * 100 : 100;
  const postPurchaseHealth = getRubroHealth(
    consumed + amount,
    rubro.limit,
    rules.preventivePercent,
    rules.highConsumptionPercent,
    rules.exhaustedPercent
  );

  return {
    isValidAmount: true,
    requiresManager: triggeredChecks.length > 0,
    reason,
    hasAvailableBudget,
    withinRubroLimit,
    withinManagerThreshold: !effectiveThresholdExceeded,
    highRemainingShare,
    remainingSharePct,
    postPurchaseAvailable,
    postPurchasePct,
    postPurchaseHealth,
    matchedException: exceedsLargeThreshold ? matchedException : null,
  };
}
