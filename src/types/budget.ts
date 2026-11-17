export type UserRole = 'operator' | 'manager' | 'ai';

export type RubroId = 'comestibles' | 'lacteos' | 'frigorifico' | 'electrodomesticos';

export type BudgetHealth = 'ok' | 'preventive' | 'high' | 'exhausted';

export type OrderStatus =
  | 'approved_auto'
  | 'pending_manager'
  | 'approved_manager'
  | 'rejected_manager';

export type PaymentStatus = 'pending_approval' | 'committed' | 'paid' | 'cancelled';

export type DerivationReason =
  | 'large_purchase'
  | 'insufficient_balance'
  | 'exhausted_budget'
  | 'high_remaining_share'
  | 'multiple'
  | null;

export interface Rubro {
  id: RubroId;
  name: string;
  code: string;
  limit: number;
  extraAssigned: number;
  executed: number; // Dinero ya pagado
  committed: number; // OC emitidas/aprobadas aún no pagadas
  suggestedSuppliers: string[];
}

export interface PurchaseOrder {
  id: string;
  createdAt: string;
  requester: 'Santiago Morales' | 'Maximiliano Vega';
  supplier: string;
  rubroId: RubroId;
  detail: string;
  amount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  derivationReason: DerivationReason;
  appliedException?: string;
  justification?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ExceptionRule {
  id: string;
  title: string;
  rubroId: RubroId | 'all';
  supplier: string; // 'all' or exact supplier name
  maxAmount: number;
  active: boolean;
}

export interface BudgetRules {
  largePurchaseThreshold: number;
  preventivePercent: number; // 70%
  highConsumptionPercent: number; // 80%
  exhaustedPercent: number; // 100%
  highRemainingShareThreshold: number; // e.g. 60% of remaining balance
  requireManagerOnHighRemainingShare: boolean;
  additionalFundAvailable: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  category: 'emision' | 'aprobacion' | 'pago' | 'reglas' | 'fondo';
  summary: string;
  amount?: number;
}

export interface ToastNotification {
  id: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  message: string;
}
