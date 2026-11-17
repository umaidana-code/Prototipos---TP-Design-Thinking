import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BudgetRules,
  DerivationReason,
  ExceptionRule,
  PurchaseOrder,
  Rubro,
  RubroId,
} from '../types/budget';
import {
  formatARS,
  formatMillions,
  formatPercent,
  getRubroAvailable,
  getRubroConsumed,
} from '../utils/formatters';

interface ManagerViewProps {
  rubros: Rubro[];
  rules: BudgetRules;
  exceptions: ExceptionRule[];
  orders: PurchaseOrder[];
  onApproveOrder: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
  onSaveRules: (
    nextRubroLimits: Record<RubroId, number>,
    nextRules: BudgetRules
  ) => void;
  onToggleException: (exceptionId: string) => void;
  onAddException: (payload: Omit<ExceptionRule, 'id'>) => void;
  onAssignAdditionalFund: (rubroId: RubroId, amount: number) => void;
  onUpdateAdditionalFundPool: (newTotal: number) => void;
}

export function ManagerView({
  rubros,
  rules,
  exceptions,
  orders,
  onApproveOrder,
  onRejectOrder,
  onSaveRules,
  onToggleException,
  onAddException,
  onAssignAdditionalFund,
  onUpdateAdditionalFundPool,
}: ManagerViewProps) {
  // Clean 3-tab structure so Carlos sees one task at a time
  const [managerSection, setManagerSection] = useState<
    'inbox' | 'rules' | 'exceptions'
  >('inbox');

  // Inbox state
  const [inboxTab, setInboxTab] = useState<'pending' | 'resolved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Draft rules state
  const [draftLimits, setDraftLimits] = useState<Record<RubroId, number>>(() => {
    const map = {} as Record<RubroId, number>;
    for (const r of rubros) map[r.id] = r.limit;
    return map;
  });
  const [draftTotalInput, setDraftTotalInput] = useState<string>(() =>
    String(rubros.reduce((acc, r) => acc + r.limit, 0))
  );
  const [draftThreshold, setDraftThreshold] = useState<number>(
    rules.largePurchaseThreshold
  );
  const [draftPreventivePct, setDraftPreventivePct] = useState<number>(
    rules.preventivePercent
  );
  const [draftHighPct, setDraftHighPct] = useState<number>(
    rules.highConsumptionPercent
  );
  const [draftExhaustedPct, setDraftExhaustedPct] = useState<number>(
    rules.exhaustedPercent
  );
  const [draftRequireHighShare, setDraftRequireHighShare] = useState<boolean>(
    rules.requireManagerOnHighRemainingShare
  );

  // Exception creation state
  const [newExTitle, setNewExTitle] = useState('');
  const [newExRubro, setNewExRubro] = useState<RubroId | 'all'>('lacteos');
  const [newExSupplier, setNewExSupplier] = useState('all');
  const [newExMaxAmount, setNewExMaxAmount] = useState('12000000');

  // Additional fund allocation state
  const [fundTargetRubro, setFundTargetRubro] = useState<RubroId>('frigorifico');
  const [fundTransferAmount, setFundTransferAmount] = useState('5000000');
  const [fundPoolInput, setFundPoolInput] = useState(
    String(rules.additionalFundAvailable)
  );

  useEffect(() => {
    const map = {} as Record<RubroId, number>;
    let sum = 0;
    for (const r of rubros) {
      map[r.id] = r.limit;
      sum += r.limit;
    }
    setDraftLimits(map);
    setDraftTotalInput(String(sum));
  }, [rubros]);

  useEffect(() => {
    setDraftThreshold(rules.largePurchaseThreshold);
    setDraftPreventivePct(rules.preventivePercent);
    setDraftHighPct(rules.highConsumptionPercent);
    setDraftExhaustedPct(rules.exhaustedPercent);
    setDraftRequireHighShare(rules.requireManagerOnHighRemainingShare);
    setFundPoolInput(String(rules.additionalFundAvailable));
  }, [rules]);

  const currentTotalBudget = useMemo(
    () => rubros.reduce((acc, r) => acc + r.limit, 0),
    [rubros]
  );

  const draftSumOfRubros = useMemo(
    () => Object.values(draftLimits).reduce((acc, val) => acc + val, 0),
    [draftLimits]
  );

  const hasUnsavedRuleChanges = useMemo(() => {
    const limitsChanged = rubros.some((r) => draftLimits[r.id] !== r.limit);
    const rulesChanged =
      draftThreshold !== rules.largePurchaseThreshold ||
      draftPreventivePct !== rules.preventivePercent ||
      draftHighPct !== rules.highConsumptionPercent ||
      draftExhaustedPct !== rules.exhaustedPercent ||
      draftRequireHighShare !== rules.requireManagerOnHighRemainingShare;
    return limitsChanged || rulesChanged;
  }, [
    rubros,
    draftLimits,
    draftThreshold,
    draftPreventivePct,
    draftHighPct,
    draftExhaustedPct,
    draftRequireHighShare,
    rules,
  ]);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending_manager'),
    [orders]
  );

  const resolvedOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === 'approved_manager' || o.status === 'rejected_manager'
      ),
    [orders]
  );

  const pendingTotalAmount = useMemo(
    () => pendingOrders.reduce((acc, o) => acc + o.amount, 0),
    [pendingOrders]
  );

  const displayedOrders = useMemo(() => {
    const base = inboxTab === 'pending' ? pendingOrders : resolvedOrders;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (order) =>
        order.id.toLowerCase().includes(q) ||
        order.supplier.toLowerCase().includes(q) ||
        order.requester.toLowerCase().includes(q) ||
        order.detail.toLowerCase().includes(q)
    );
  }, [inboxTab, pendingOrders, resolvedOrders, searchQuery]);

  const allKnownSuppliers = useMemo(() => {
    const set = new Set<string>();
    rubros.forEach((r) => r.suggestedSuppliers.forEach((s) => set.add(s)));
    return Array.from(set);
  }, [rubros]);

  const handleUpdateRubroLimit = (rubroId: RubroId, rawValue: string) => {
    const cleaned = rawValue.replace(/[^\d]/g, '');
    const numeric = cleaned ? Number(cleaned) : 0;
    const next = { ...draftLimits, [rubroId]: numeric };
    setDraftLimits(next);
    const newSum = Object.values(next).reduce((acc, v) => acc + v, 0);
    setDraftTotalInput(String(newSum));
  };

  const handleApplyGlobalBudgetProportionally = () => {
    const desiredTotal = Number(draftTotalInput.replace(/[^\d]/g, '')) || 0;
    if (desiredTotal <= 0 || draftSumOfRubros <= 0) return;

    const next = {} as Record<RubroId, number>;
    let runningSum = 0;

    rubros.forEach((rubro, idx) => {
      if (idx === rubros.length - 1) {
        next[rubro.id] = Math.max(0, desiredTotal - runningSum);
      } else {
        const share = draftLimits[rubro.id] / draftSumOfRubros;
        const allocated = Math.round((desiredTotal * share) / 100_000) * 100_000;
        next[rubro.id] = allocated;
        runningSum += allocated;
      }
    });

    setDraftLimits(next);
  };

  const handleResetDrafts = () => {
    const map = {} as Record<RubroId, number>;
    let sum = 0;
    for (const r of rubros) {
      map[r.id] = r.limit;
      sum += r.limit;
    }
    setDraftLimits(map);
    setDraftTotalInput(String(sum));
    setDraftThreshold(rules.largePurchaseThreshold);
    setDraftPreventivePct(rules.preventivePercent);
    setDraftHighPct(rules.highConsumptionPercent);
    setDraftExhaustedPct(rules.exhaustedPercent);
    setDraftRequireHighShare(rules.requireManagerOnHighRemainingShare);
  };

  const handleSaveConfiguration = () => {
    const safePreventive = Math.min(Math.max(draftPreventivePct, 30), 90);
    const safeHigh = Math.min(Math.max(draftHighPct, safePreventive + 5), 98);
    const safeExhausted = Math.min(Math.max(draftExhaustedPct, safeHigh + 2), 100);

    onSaveRules(draftLimits, {
      ...rules,
      largePurchaseThreshold: Math.max(1_000_000, draftThreshold),
      preventivePercent: safePreventive,
      highConsumptionPercent: safeHigh,
      exhaustedPercent: safeExhausted,
      requireManagerOnHighRemainingShare: draftRequireHighShare,
    });
  };

  const handleCreateException = (e: FormEvent) => {
    e.preventDefault();
    const maxAmt = Number(newExMaxAmount.replace(/[^\d]/g, '')) || 0;
    if (!newExTitle.trim() || maxAmt <= 0) return;

    onAddException({
      title: newExTitle.trim(),
      rubroId: newExRubro,
      supplier: newExSupplier,
      maxAmount: maxAmt,
      active: true,
    });
    setNewExTitle('');
  };

  const handleTransferFund = (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(fundTransferAmount.replace(/[^\d]/g, '')) || 0;
    if (amt <= 0 || amt > rules.additionalFundAvailable) return;
    onAssignAdditionalFund(fundTargetRubro, amt);
  };

  const formatReasonText = (reason: DerivationReason) => {
    if (reason === 'large_purchase') {
      return `Supera umbral (${formatMillions(rules.largePurchaseThreshold)})`;
    }
    if (reason === 'insufficient_balance') {
      return 'Sin saldo suficiente';
    }
    if (reason === 'exhausted_budget') {
      return 'Rubro agotado (100%)';
    }
    if (reason === 'high_remaining_share') {
      return 'Consumo elevado del saldo';
    }
    if (reason === 'multiple') {
      return 'Supera umbral y saldo';
    }
    return 'Excepción';
  };

  const desiredTotalNumeric = Number(draftTotalInput.replace(/[^\d]/g, '')) || 0;
  const totalMismatch = desiredTotalNumeric !== draftSumOfRubros;

  return (
    <div className="space-y-6">
      {/* 1. Resumen Ejecutivo Simple */}
      <section aria-label="Resumen de gerencia">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">Por Aprobar</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {pendingOrders.length} órdenes
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {formatARS(pendingTotalAmount)} en revisión
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">Umbral Compra Grande</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
              {formatARS(rules.largePurchaseThreshold)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Aprobación auto por debajo</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">Presupuesto del Mes</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {formatARS(currentTotalBudget)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {exceptions.filter((e) => e.active).length} excepción(es) activa(s)
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">Fondo Adicional</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
              {formatARS(rules.additionalFundAvailable)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Disponible para refuerzos</p>
          </div>
        </div>
      </section>

      {/* 2. Navegación simple por tarea para Gerencia */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 w-fit">
        <button
          type="button"
          onClick={() => setManagerSection('inbox')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
            managerSection === 'inbox'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          1. Solicitudes Pendientes ({pendingOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setManagerSection('rules')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
            managerSection === 'rules'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          2. Límites y Reglas
        </button>
        <button
          type="button"
          onClick={() => setManagerSection('exceptions')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
            managerSection === 'exceptions'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          3. Excepciones y Fondo Adicional
        </button>
      </div>

      {/* TAB 1: Bandeja de Solicitudes Pendientes */}
      {managerSection === 'inbox' && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
              <button
                type="button"
                onClick={() => setInboxTab('pending')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  inboxTab === 'pending'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({pendingOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setInboxTab('resolved')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  inboxTab === 'resolved'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Resueltas ({resolvedOrders.length})
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar OC, operario o proveedor..."
                aria-label="Buscar solicitudes pendientes"
                className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {displayedOrders.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {inboxTab === 'pending'
                    ? 'No hay solicitudes pendientes de aprobación'
                    : 'Todavía no resolviste solicitudes en esta sesión'}
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                    <th className="px-6 py-3 font-medium">OC y Solicitante</th>
                    <th className="px-4 py-3 font-medium">Proveedor y Rubro</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Motivo</th>
                    <th className="px-6 py-3 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {displayedOrders.map((order) => {
                    const rubro = rubros.find((r) => r.id === order.rubroId);
                    const rubroAvailable = rubro ? getRubroAvailable(rubro) : 0;

                    return (
                      <tr key={order.id} className="align-top hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-6 py-4">
                          <p className="font-mono font-semibold text-slate-900">
                            {order.id}
                          </p>
                          <p className="mt-0.5 text-slate-700">{order.requester}</p>
                          <p className="mt-0.5 text-slate-400">{order.createdAt}</p>
                        </td>

                        <td className="max-w-xs px-4 py-4">
                          <p className="font-semibold text-slate-900">
                            {order.supplier}
                          </p>
                          <p className="mt-0.5 text-slate-600">{order.detail}</p>
                          <p className="mt-1 text-slate-500 tabular-nums">
                            {rubro?.name ?? order.rubroId} · Libre:{' '}
                            {formatARS(rubroAvailable)}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums">
                          {formatARS(order.amount)}
                        </td>

                        <td className="max-w-xs px-4 py-4">
                          <div className="flex items-center gap-1.5 font-semibold">
                            {order.derivationReason === 'insufficient_balance' ||
                            order.derivationReason === 'exhausted_budget' ||
                            order.derivationReason === 'multiple' ? (
                              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                            )}
                            <span
                              className={
                                order.derivationReason === 'insufficient_balance' ||
                                order.derivationReason === 'exhausted_budget' ||
                                order.derivationReason === 'multiple'
                                  ? 'text-red-700'
                                  : 'text-amber-800'
                              }
                            >
                              {formatReasonText(order.derivationReason)}
                            </span>
                          </div>
                          {order.justification && (
                            <p className="mt-1 text-slate-600">“{order.justification}”</p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          {inboxTab === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onApproveOrder(order.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Aprobar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectOrder(order.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 whitespace-nowrap"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Rechazar</span>
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                order.status === 'approved_manager'
                                  ? 'text-emerald-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {order.status === 'approved_manager' ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>Aprobada</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4" />
                                  <span>Rechazada</span>
                                </>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: Configuración de Límites y Reglas */}
      {managerSection === 'rules' && (
        <section
          id="rules-config"
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Límites Mensuales y Reglas de Control
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Ajustá el presupuesto mensual, el umbral de firma y los avisos preventivos
              </p>
            </div>

            <div className="flex items-center gap-2">
              {hasUnsavedRuleChanges && (
                <button
                  type="button"
                  onClick={handleResetDrafts}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Descartar</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveConfiguration}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
            {/* Presupuesto total, umbral y alertas */}
            <div className="space-y-6 p-6 lg:col-span-5">
              <div>
                <label
                  htmlFor="rule-total-budget"
                  className="block text-sm font-medium text-slate-700"
                >
                  Presupuesto Mensual Total ($ ARS)
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-slate-500">
                      $
                    </span>
                    <input
                      id="rule-total-budget"
                      type="text"
                      inputMode="numeric"
                      value={draftTotalInput}
                      onChange={(e) =>
                        setDraftTotalInput(e.target.value.replace(/[^\d]/g, ''))
                      }
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 font-mono text-sm font-medium text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyGlobalBudgetProportionally}
                    disabled={!totalMismatch || desiredTotalNumeric <= 0}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
                  >
                    Distribuir
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                  Suma de rubros: {formatARS(draftSumOfRubros)}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="rule-threshold"
                    className="text-sm font-medium text-slate-700"
                  >
                    Umbral de Compra Grande
                  </label>
                  <span className="font-mono text-sm font-semibold text-blue-700 tabular-nums">
                    {formatARS(draftThreshold)}
                  </span>
                </div>
                <input
                  id="rule-threshold"
                  type="range"
                  min={5_000_000}
                  max={25_000_000}
                  step={500_000}
                  value={Math.min(25_000_000, Math.max(5_000_000, draftThreshold))}
                  onChange={(e) => setDraftThreshold(Number(e.target.value))}
                  className="mt-3 w-full accent-blue-700"
                />
                <div className="mt-2 flex gap-2">
                  {[10_000_000, 12_500_000, 15_000_000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDraftThreshold(preset)}
                      className={`rounded-md border px-2.5 py-1 font-mono text-xs font-medium ${
                        draftThreshold === preset
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {formatMillions(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <p className="text-sm font-medium text-slate-700">
                  Porcentajes de Alerta (%)
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="rule-preventive-pct"
                      className="block text-xs text-slate-500"
                    >
                      Aviso
                    </label>
                    <input
                      id="rule-preventive-pct"
                      type="number"
                      min={30}
                      max={90}
                      value={draftPreventivePct}
                      onChange={(e) => setDraftPreventivePct(Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm font-semibold text-amber-700 tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rule-high-pct"
                      className="block text-xs text-slate-500"
                    >
                      Elevado
                    </label>
                    <input
                      id="rule-high-pct"
                      type="number"
                      min={40}
                      max={98}
                      value={draftHighPct}
                      onChange={(e) => setDraftHighPct(Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm font-semibold text-orange-700 tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rule-exhausted-pct"
                      className="block text-xs text-slate-500"
                    >
                      Agotado
                    </label>
                    <input
                      id="rule-exhausted-pct"
                      type="number"
                      min={50}
                      max={100}
                      value={draftExhaustedPct}
                      onChange={(e) => setDraftExhaustedPct(Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm font-semibold text-red-700 tabular-nums"
                    />
                  </div>
                </div>

                <label className="mt-4 flex items-center gap-2.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draftRequireHighShare}
                    onChange={(e) => setDraftRequireHighShare(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  <span>
                    Derivar si una OC consume ≥ {rules.highRemainingShareThreshold}% del
                    saldo restante
                  </span>
                </label>
              </div>
            </div>

            {/* Límites por rubro */}
            <div className="p-6 lg:col-span-7">
              <h3 className="text-sm font-medium text-slate-700">
                Límites por Rubro
              </h3>
              <div className="mt-4 divide-y divide-slate-200">
                {rubros.map((rubro) => {
                  const consumed = getRubroConsumed(rubro);
                  const draftLimit = draftLimits[rubro.id] ?? rubro.limit;
                  const pct = draftLimit > 0 ? (consumed / draftLimit) * 100 : 100;

                  return (
                    <div
                      key={rubro.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-3.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {rubro.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                          Consumido: {formatARS(consumed)} ({formatPercent(pct)})
                        </p>
                      </div>

                      <div className="relative w-48">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-slate-500">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Límite para ${rubro.name}`}
                          value={String(draftLimit)}
                          onChange={(e) =>
                            handleUpdateRubroLimit(rubro.id, e.target.value)
                          }
                          className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: Excepciones, Fondo Adicional y Evolución Fase 2 */}
      {managerSection === 'exceptions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Excepciones */}
            <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Excepciones Autorizadas
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Habilitá proveedores o rubros con tope de auto-aprobación ampliado
                </p>
              </div>

              <div className="divide-y divide-slate-200">
                {exceptions.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 text-xs"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{ex.title}</p>
                      <p className="mt-0.5 text-slate-500 tabular-nums">
                        {ex.supplier === 'all' ? 'Todos los proveedores' : ex.supplier} ·
                        Hasta <strong className="text-slate-800">{formatARS(ex.maxAmount)}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleException(ex.id)}
                      className={`rounded-lg border px-3 py-1.5 font-semibold whitespace-nowrap ${
                        ex.active
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {ex.active ? 'Activa' : 'Pausada'}
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleCreateException}
                className="space-y-3 border-t border-slate-200 bg-slate-50/70 p-6"
              >
                <p className="text-xs font-semibold text-slate-800">
                  Agregar nueva excepción
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input
                    type="text"
                    value={newExTitle}
                    onChange={(e) => setNewExTitle(e.target.value)}
                    placeholder="Nombre del acuerdo o excepción"
                    aria-label="Descripción de excepción"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                  <select
                    value={newExRubro}
                    onChange={(e) => setNewExRubro(e.target.value as RubroId | 'all')}
                    aria-label="Rubro"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="all">Todos los rubros</option>
                    {rubros.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newExSupplier}
                    onChange={(e) => setNewExSupplier(e.target.value)}
                    aria-label="Proveedor"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="all">Cualquier proveedor</option>
                    {allKnownSuppliers.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newExMaxAmount}
                    onChange={(e) =>
                      setNewExMaxAmount(e.target.value.replace(/[^\d]/g, ''))
                    }
                    aria-label="Monto máximo"
                    placeholder="Tope ($)"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Agregar Excepción</span>
                </button>
              </form>
            </section>

            {/* Fondo Adicional */}
            <section className="rounded-xl border border-slate-200 bg-white lg:col-span-5">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Fondo Adicional de Contingencia
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Ampliá el presupuesto de un rubro cuando sea necesario
                </p>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Disponible en Fondo Adicional</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatARS(rules.additionalFundAvailable)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Saldo del fondo adicional"
                      value={fundPoolInput}
                      onChange={(e) =>
                        setFundPoolInput(e.target.value.replace(/[^\d]/g, ''))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateAdditionalFundPool(
                          Number(fundPoolInput.replace(/[^\d]/g, '')) || 0
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                    >
                      Actualizar
                    </button>
                  </div>
                </div>

                <form onSubmit={handleTransferFund} className="space-y-3">
                  <div>
                    <label
                      htmlFor="fund-rubro"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Rubro a reforzar
                    </label>
                    <select
                      id="fund-rubro"
                      value={fundTargetRubro}
                      onChange={(e) => setFundTargetRubro(e.target.value as RubroId)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {rubros.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="fund-amount"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Monto a transferir ($ ARS)
                    </label>
                    <input
                      id="fund-amount"
                      type="text"
                      inputMode="numeric"
                      value={fundTransferAmount}
                      onChange={(e) =>
                        setFundTransferAmount(e.target.value.replace(/[^\d]/g, ''))
                      }
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      (Number(fundTransferAmount.replace(/[^\d]/g, '')) || 0) <= 0 ||
                      (Number(fundTransferAmount.replace(/[^\d]/g, '')) || 0) >
                        rules.additionalFundAvailable
                    }
                    className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    Asignar Refuerzo al Rubro
                  </button>
                </form>
              </div>
            </section>
          </div>

          {/* Nota discreta sobre Fase 2 */}
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-xs text-slate-600">
            <strong className="font-semibold text-slate-900">
              Segunda Evolución (Fase 2 · IA y Analítica):
            </strong>{' '}
            Análisis de compras históricas, recomendaciones de distribución presupuestaria,
            detección de productos de mayor demanda y asistente de decisiones quedan
            planificados para la siguiente etapa del módulo.
          </div>
        </div>
      )}
    </div>
  );
}
