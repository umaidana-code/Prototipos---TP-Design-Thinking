import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import {
  AuditEvent,
  BudgetRules,
  ExceptionRule,
  OrderStatus,
  PurchaseOrder,
  Rubro,
  RubroId,
} from '../types/budget';
import {
  evaluateOrderValidation,
  formatARS,
  formatMillions,
  formatPercent,
  getRubroAvailable,
  getRubroConsumed,
  getRubroHealth,
} from '../utils/formatters';

interface OperatorViewProps {
  rubros: Rubro[];
  rules: BudgetRules;
  exceptions: ExceptionRule[];
  orders: PurchaseOrder[];
  auditEvents: AuditEvent[];
  onEmitOrder: (payload: {
    requester: 'Santiago Morales' | 'Maximiliano Vega';
    supplier: string;
    rubroId: RubroId;
    detail: string;
    amount: number;
    justification?: string;
  }) => void;
  onRegisterPayment: (orderId: string) => void;
}

type OperatorTab = 'budget' | 'new_order' | 'orders' | 'movements';

export function OperatorView({
  rubros,
  rules,
  exceptions,
  orders,
  auditEvents,
  onEmitOrder,
  onRegisterPayment,
}: OperatorViewProps) {
  const [activeTab, setActiveTab] = useState<OperatorTab>('budget');

  const [requester, setRequester] = useState<'Santiago Morales' | 'Maximiliano Vega'>(
    'Santiago Morales'
  );
  const [selectedRubroId, setSelectedRubroId] = useState<RubroId>('comestibles');
  const [supplierChoice, setSupplierChoice] = useState<string>(
    rubros[0]?.suggestedSuppliers[0] ?? ''
  );
  const [customSupplier, setCustomSupplier] = useState('');
  const [detail, setDetail] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [justification, setJustification] = useState('');
  const [formError, setFormError] = useState('');
  const [activeScenario, setActiveScenario] = useState<
    'auto' | 'exception' | 'large' | 'exhausted' | null
  >(null);

  // Orders filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');

  const totals = useMemo(() => {
    const totalBudget = rubros.reduce((acc, r) => acc + r.limit, 0);
    const totalExecuted = rubros.reduce((acc, r) => acc + r.executed, 0);
    const totalCommitted = rubros.reduce((acc, r) => acc + r.committed, 0);
    const totalConsumed = totalExecuted + totalCommitted;
    const available = Math.max(0, totalBudget - totalConsumed);
    const executedPct = totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0;
    const committedPct = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;
    const usedPct = executedPct + committedPct;

    return {
      totalBudget,
      totalExecuted,
      totalCommitted,
      totalConsumed,
      available,
      executedPct,
      committedPct,
      usedPct,
    };
  }, [rubros]);

  const selectedRubro = useMemo(
    () => rubros.find((r) => r.id === selectedRubroId) ?? rubros[0],
    [rubros, selectedRubroId]
  );

  const selectedRubroAvailable = getRubroAvailable(selectedRubro);

  const activeSupplier =
    supplierChoice === '__custom__' ? customSupplier.trim() : supplierChoice.trim();

  const parsedAmount = useMemo(() => {
    const digits = amountInput.replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }, [amountInput]);

  const validation = useMemo(
    () =>
      evaluateOrderValidation(
        parsedAmount,
        selectedRubro,
        activeSupplier,
        rules,
        exceptions
      ),
    [parsedAmount, selectedRubro, activeSupplier, rules, exceptions]
  );

  const handleSelectRubro = (rubroId: RubroId, goToOrderTab = false) => {
    setSelectedRubroId(rubroId);
    const target = rubros.find((r) => r.id === rubroId);
    if (target && target.suggestedSuppliers.length > 0) {
      setSupplierChoice(target.suggestedSuppliers[0]);
      setCustomSupplier('');
    }
    setFormError('');
    if (goToOrderTab) {
      setActiveTab('new_order');
    }
  };

  const applyDemoScenario = (
    scenario: 'auto' | 'exception' | 'large' | 'exhausted'
  ) => {
    setFormError('');
    setActiveScenario(scenario);
    if (scenario === 'auto') {
      handleSelectRubro('comestibles');
      setSupplierChoice('Arcor S.A.I.C.');
      setDetail('16 pallets Fideos Matarazzo y Tallarín 500g');
      setAmountInput('4200000');
      setJustification('');
    } else if (scenario === 'exception') {
      handleSelectRubro('comestibles');
      setSupplierChoice('Molinos Río de la Plata S.A.');
      setDetail('28 pallets Fideos secos · Acuerdo comercial vigente');
      setAmountInput('11800000');
      setJustification('');
    } else if (scenario === 'large') {
      handleSelectRubro('electrodomesticos');
      setSupplierChoice('Newsan S.A. (Noblex / Philco)');
      setDetail('140 Heladeras Inverter No Frost · Reposición estacional');
      setAmountInput(String(rules.largePurchaseThreshold + 4_500_000));
      setJustification('Bonificación mayorista del 7% válida hasta hoy.');
    } else {
      handleSelectRubro('frigorifico');
      setSupplierChoice('Frigorífico Gorina S.A.');
      setDetail('7.800 kg Cortes vacunos al vacío · Reposición semanal');
      const overAmount = Math.max(getRubroAvailable(rubros[2]) + 1_600_000, 8_800_000);
      setAmountInput(String(Math.min(overAmount, rules.largePurchaseThreshold - 400_000)));
      setJustification('Demanda extraordinaria de sucursales por fin de semana largo.');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!activeSupplier) {
      setFormError('Seleccioná o ingresá un proveedor válido.');
      return;
    }
    if (!detail.trim()) {
      setFormError('Ingresá el detalle del producto.');
      return;
    }
    if (!validation.isValidAmount) {
      setFormError('Ingresá un monto mayor a $0.');
      return;
    }

    onEmitOrder({
      requester,
      supplier: activeSupplier,
      rubroId: selectedRubro.id,
      detail: detail.trim(),
      amount: parsedAmount,
      justification: validation.requiresManager
        ? justification.trim() ||
          'Solicitud derivada automáticamente por control presupuestario.'
        : undefined,
    });

    setDetail('');
    setAmountInput('');
    setJustification('');
    setFormError('');
    setActiveScenario(null);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === 'all' ? true : order.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.supplier.toLowerCase().includes(q) ||
        order.detail.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Solapas principales del Operario */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 w-fit"
        role="tablist"
        aria-label="Secciones de la vista operario"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'budget'}
          onClick={() => setActiveTab('budget')}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'budget'
              ? 'bg-blue-700 text-white'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          1. Presupuesto y Saldos
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'new_order'}
          onClick={() => setActiveTab('new_order')}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'new_order'
              ? 'bg-blue-700 text-white'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          2. Nueva Orden de Compra
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'orders'}
          onClick={() => setActiveTab('orders')}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-blue-700 text-white'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          3. Órdenes Emitidas ({orders.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'movements'}
          onClick={() => setActiveTab('movements')}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'movements'
              ? 'bg-blue-700 text-white'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          4. Historial de Movimientos ({auditEvents.length})
        </button>
      </div>

      {/* SOLAPA 1: Presupuesto y Saldos por Rubro */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          {/* KPI Cards: clara distinción entre Presupuesto, Ejecutado (Pagado), Comprometido y Disponible */}
          <section aria-label="Resumen presupuestario del mes">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-600">
                  Presupuesto del Mes
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {formatARS(totals.totalBudget)}
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  Asignado a {rubros.length} rubros
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-xs bg-blue-700" />
                  <p className="text-sm font-medium text-slate-600">
                    Saldo Ejecutado (Pagado)
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-semibold text-blue-800 tabular-nums">
                  {formatARS(totals.totalExecuted)}
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  Compras ya abonadas
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" />
                  <p className="text-sm font-medium text-slate-600">
                    Saldo Comprometido
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-semibold text-sky-700 tabular-nums">
                  {formatARS(totals.totalCommitted)}
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  OC emitidas sin pagar
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-600">
                    Saldo Disponible
                  </p>
                  <span className="font-mono text-sm font-semibold text-slate-700 tabular-nums">
                    {formatPercent(totals.usedPct)} usado
                  </span>
                </div>
                <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                  {formatARS(totals.available)}
                </p>
                {/* Barra segmentada Ejecutado + Comprometido */}
                <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-blue-700 transition-all duration-300"
                    style={{ width: `${Math.min(100, totals.executedPct)}%` }}
                  />
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        Math.max(0, 100 - totals.executedPct),
                        totals.committedPct
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Estado del Presupuesto por Rubro
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-xs bg-blue-700" />
                    Ejecutado (Pagado)
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" />
                    Comprometido (OC sin pagar)
                  </span>
                  <span className="text-slate-500">
                    Alertas: {rules.preventivePercent}% · {rules.highConsumptionPercent}% ·{' '}
                    {rules.exhaustedPercent}%
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('new_order')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
              >
                <span>Nueva Orden de Compra</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {rubros.map((rubro) => {
                const rubroConsumed = getRubroConsumed(rubro);
                const rubroAvailable = getRubroAvailable(rubro);
                const usedPct =
                  rubro.limit > 0 ? (rubroConsumed / rubro.limit) * 100 : 100;
                const executedPct =
                  rubro.limit > 0 ? (rubro.executed / rubro.limit) * 100 : 0;
                const committedPct =
                  rubro.limit > 0 ? (rubro.committed / rubro.limit) * 100 : 0;

                const health = getRubroHealth(
                  rubroConsumed,
                  rubro.limit,
                  rules.preventivePercent,
                  rules.highConsumptionPercent,
                  rules.exhaustedPercent
                );

                const statusMeta = {
                  ok: {
                    label: 'Estado OK',
                    textClass: 'text-emerald-700',
                    Icon: CheckCircle2,
                  },
                  preventive: {
                    label: `Aviso preventivo (${rules.preventivePercent}%)`,
                    textClass: 'text-amber-700',
                    Icon: AlertTriangle,
                  },
                  high: {
                    label: `Consumo elevado (${rules.highConsumptionPercent}%)`,
                    textClass: 'text-orange-700',
                    Icon: ShieldAlert,
                  },
                  exhausted: {
                    label: 'Presupuesto agotado (100%)',
                    textClass: 'text-red-700',
                    Icon: AlertOctagon,
                  },
                }[health];

                const StatusIcon = statusMeta.Icon;

                return (
                  <div
                    key={rubro.id}
                    className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-display text-base font-semibold text-slate-900">
                          {rubro.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${statusMeta.textClass}`}
                        >
                          <StatusIcon className="h-4 w-4 shrink-0" />
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>

                      {/* Barra segmentada Ejecutado + Comprometido */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            title={`Ejecutado (pagado): ${formatARS(rubro.executed)}`}
                            className="h-full bg-blue-700 transition-all duration-300"
                            style={{ width: `${Math.min(100, executedPct)}%` }}
                          />
                          <div
                            title={`Comprometido (sin pagar): ${formatARS(rubro.committed)}`}
                            className="h-full bg-sky-400 transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                Math.max(0, 100 - executedPct),
                                committedPct
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-16 text-right font-mono text-sm font-semibold text-slate-800 tabular-nums">
                          {formatPercent(usedPct)}
                        </span>
                      </div>

                      {/* 4 columnas claras para que Pagado y Comprometido se vean al instante */}
                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Presupuesto asignado
                          </span>
                          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                            {formatARS(rubro.limit)}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Ejecutado (Pagado)
                          </span>
                          <p className="mt-0.5 font-mono text-sm font-semibold text-blue-800">
                            {formatARS(rubro.executed)}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Comprometido (Sin pagar)
                          </span>
                          <p className="mt-0.5 font-mono text-sm font-semibold text-sky-700">
                            {formatARS(rubro.committed)}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500">
                            Saldo disponible
                          </span>
                          <p
                            className={`mt-0.5 font-mono text-base font-semibold ${
                              rubroAvailable === 0 || health === 'exhausted'
                                ? 'text-red-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatARS(rubroAvailable)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectRubro(rubro.id, true)}
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
                    >
                      Emitir OC aquí
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* SOLAPA 2: Nueva Orden de Compra */}
      {activeTab === 'new_order' && (
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Escenarios rápidos claros, grandes y bien presentados */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">
              Cargar un ejemplo rápido de prueba
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              Elegí una situación para completar el formulario y ver la validación en vivo
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => applyDemoScenario('auto')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  activeScenario === 'auto'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">Compra estándar</p>
                <p className="mt-1 text-xs text-slate-600">
                  $4,2M · Aprobación automática
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyDemoScenario('exception')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  activeScenario === 'exception'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">Excepción Molinos</p>
                <p className="mt-1 text-xs text-slate-600">
                  $11,8M · Acuerdo habilitado
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyDemoScenario('large')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  activeScenario === 'large'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">
                  Mayor a {formatMillions(rules.largePurchaseThreshold)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Supera umbral · Pide firma
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyDemoScenario('exhausted')}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  activeScenario === 'exhausted'
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">Agota rubro</p>
                <p className="mt-1 text-xs text-slate-600">
                  Llega al 100% · Deriva a Carlos
                </p>
              </button>
            </div>
          </section>

          {/* Formulario principal */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Datos de la Orden de Compra
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Aprobación automática por debajo de{' '}
                {formatMillions(rules.largePurchaseThreshold)} si hay saldo disponible
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {/* Contexto rápido del rubro elegido */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 tabular-nums">
                <div>
                  <span className="text-xs font-medium text-slate-500">
                    Rubro seleccionado
                  </span>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {selectedRubro.name}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500">
                    Disponible en rubro
                  </span>
                  <p
                    className={`mt-0.5 font-mono text-base font-semibold ${
                      selectedRubroAvailable === 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatARS(selectedRubroAvailable)}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500">
                    Disponible global del mes
                  </span>
                  <p className="mt-0.5 font-mono text-base font-semibold text-slate-900">
                    {formatARS(totals.available)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="oc-requester"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Operario
                  </label>
                  <select
                    id="oc-requester"
                    value={requester}
                    onChange={(e) =>
                      setRequester(
                        e.target.value as 'Santiago Morales' | 'Maximiliano Vega'
                      )
                    }
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="Santiago Morales">Santiago Morales</option>
                    <option value="Maximiliano Vega">Maximiliano Vega</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="oc-rubro"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Rubro
                  </label>
                  <select
                    id="oc-rubro"
                    value={selectedRubro.id}
                    onChange={(e) => handleSelectRubro(e.target.value as RubroId)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {rubros.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="oc-supplier"
                  className="block text-sm font-medium text-slate-700"
                >
                  Proveedor
                </label>
                <select
                  id="oc-supplier"
                  value={supplierChoice}
                  onChange={(e) => {
                    setSupplierChoice(e.target.value);
                    setFormError('');
                  }}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                >
                  {selectedRubro.suggestedSuppliers.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                  <option value="__custom__">Otro proveedor...</option>
                </select>

                {supplierChoice === '__custom__' && (
                  <input
                    type="text"
                    value={customSupplier}
                    onChange={(e) => setCustomSupplier(e.target.value)}
                    placeholder="Escribí el nombre del proveedor"
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor="oc-detail"
                  className="block text-sm font-medium text-slate-700"
                >
                  Detalle del producto
                </label>
                <input
                  id="oc-detail"
                  type="text"
                  value={detail}
                  onChange={(e) => {
                    setDetail(e.target.value);
                    setFormError('');
                  }}
                  placeholder="Ej.: 18 pallets Fideos Tirabuzón 500g"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="oc-amount"
                  className="block text-sm font-medium text-slate-700"
                >
                  Monto ($ ARS)
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-base text-slate-500">
                    $
                  </span>
                  <input
                    id="oc-amount"
                    type="text"
                    inputMode="numeric"
                    value={amountInput}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^\d]/g, '');
                      setAmountInput(cleaned);
                      setFormError('');
                      setActiveScenario(null);
                    }}
                    placeholder="Ej.: 4200000"
                    className="block w-full rounded-lg border border-slate-300 bg-white py-3 pl-9 pr-4 font-mono text-base font-semibold text-slate-900 tabular-nums placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                {parsedAmount > 0 && (
                  <p className="mt-1.5 text-right font-mono text-sm text-slate-600 tabular-nums">
                    Importe ingresado: <strong>{formatARS(parsedAmount)}</strong>
                  </p>
                )}
              </div>

              {/* Validación Automática */}
              {validation.isValidAmount && (
                <div
                  role="status"
                  className={`rounded-xl border p-4 ${
                    validation.requiresManager
                      ? 'border-amber-300 bg-amber-50/70'
                      : 'border-emerald-300 bg-emerald-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {validation.requiresManager ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    ) : validation.matchedException ? (
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-base font-semibold ${
                          validation.requiresManager
                            ? 'text-amber-950'
                            : 'text-emerald-950'
                        }`}
                      >
                        {validation.requiresManager
                          ? 'Requiere autorización de Gerencia (Carlos)'
                          : validation.matchedException
                          ? `Aprobación Automática (${validation.matchedException.title})`
                          : 'Aprobación Automática'}
                      </p>

                      <p className="mt-1 text-sm text-slate-700 tabular-nums">
                        Saldo disponible después de esta compra:{' '}
                        <strong
                          className={
                            validation.postPurchaseAvailable < 0
                              ? 'text-red-700'
                              : 'text-slate-900'
                          }
                        >
                          {formatARS(validation.postPurchaseAvailable)}
                        </strong>{' '}
                        ({formatPercent(validation.postPurchasePct)} usado)
                      </p>

                      {validation.postPurchaseHealth !== 'ok' && (
                        <p
                          className={`mt-1 text-sm font-medium ${
                            validation.postPurchaseHealth === 'exhausted'
                              ? 'text-red-700'
                              : validation.postPurchaseHealth === 'high'
                              ? 'text-orange-700'
                              : 'text-amber-800'
                          }`}
                        >
                          {validation.postPurchaseHealth === 'exhausted'
                            ? 'Alerta 100%: El presupuesto del rubro queda agotado.'
                            : validation.postPurchaseHealth === 'high'
                            ? `Advertencia ${rules.highConsumptionPercent}%: Consumo elevado del rubro.`
                            : `Aviso preventivo ${rules.preventivePercent}%: Próximo al límite del rubro.`}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-900/10 pt-2.5 text-sm text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          {validation.hasAvailableBudget ? (
                            <Check className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          Presupuesto
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {validation.withinRubroLimit ? (
                            <Check className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          Límite rubro
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {validation.withinManagerThreshold ? (
                            <Check className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                          )}
                          Umbral {formatMillions(rules.largePurchaseThreshold)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {!validation.highRemainingShare ? (
                            <Check className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                          )}
                          Usa {Math.round(Math.min(100, validation.remainingSharePct))}% del
                          saldo libre
                        </span>
                      </div>
                    </div>
                  </div>

                  {validation.requiresManager && (
                    <div className="mt-3 border-t border-amber-200 pt-3">
                      <label
                        htmlFor="oc-justification"
                        className="block text-sm font-medium text-amber-950"
                      >
                        Nota o justificación para Carlos
                      </label>
                      <input
                        id="oc-justification"
                        type="text"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="Ej.: Reposición urgente o descuento por volumen"
                        className="mt-1.5 block w-full rounded-lg border border-amber-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  validation.requiresManager
                    ? 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600'
                    : 'bg-blue-700 hover:bg-blue-800 focus-visible:ring-blue-600'
                }`}
              >
                {validation.requiresManager ? (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Enviar a Carlos para Aprobación</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Emitir Orden de Compra</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* SOLAPA 3: Órdenes Emitidas */}
      {activeTab === 'orders' && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Órdenes de Compra Emitidas
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Registrá el pago de una OC para pasar su importe de Comprometido a
                Ejecutado
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar OC o proveedor..."
                  aria-label="Buscar órdenes de compra"
                  className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <select
                aria-label="Filtrar por estado"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | OrderStatus)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">Todas</option>
                <option value="approved_auto">Aprobadas Auto</option>
                <option value="pending_manager">En Gerencia</option>
                <option value="approved_manager">Aprobadas por Carlos</option>
                <option value="rejected_manager">Rechazadas</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredOrders.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No hay órdenes que coincidan con tu búsqueda.
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                    <th className="px-6 py-3.5 font-medium">Orden</th>
                    <th className="px-4 py-3.5 font-medium">Proveedor y Rubro</th>
                    <th className="px-4 py-3.5 text-right font-medium">Monto</th>
                    <th className="px-4 py-3.5 font-medium">Estado</th>
                    <th className="px-6 py-3.5 text-right font-medium">
                      Saldo / Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.map((order) => {
                    const rubroName =
                      rubros.find((r) => r.id === order.rubroId)?.name ?? order.rubroId;

                    const statusDisplay = {
                      approved_auto: {
                        label: order.appliedException
                          ? 'Auto (Excepción)'
                          : 'Aprobada Auto',
                        color: 'text-emerald-700',
                        Icon: CheckCircle2,
                      },
                      pending_manager: {
                        label: 'Pendiente Carlos',
                        color: 'text-amber-700',
                        Icon: Clock,
                      },
                      approved_manager: {
                        label: 'Aprobada Carlos',
                        color: 'text-emerald-700',
                        Icon: CheckCircle2,
                      },
                      rejected_manager: {
                        label: 'Rechazada',
                        color: 'text-red-700',
                        Icon: XCircle,
                      },
                    }[order.status];

                    const StatusIcon = statusDisplay.Icon;

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-6 py-4">
                          <p className="font-mono font-semibold text-slate-900">
                            {order.id}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {order.requester} · {order.createdAt}
                          </p>
                        </td>
                        <td className="max-w-sm px-4 py-4">
                          <p className="truncate font-medium text-slate-900">
                            {order.supplier}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {rubroName} · {order.detail}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatARS(order.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusDisplay.color}`}
                          >
                            <StatusIcon className="h-4 w-4 shrink-0" />
                            <span>{statusDisplay.label}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          {order.paymentStatus === 'committed' ? (
                            <div className="inline-flex items-center gap-3">
                              <span className="text-xs font-semibold text-sky-700">
                                Comprometido
                              </span>
                              <button
                                type="button"
                                onClick={() => onRegisterPayment(order.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>Registrar pago</span>
                              </button>
                            </div>
                          ) : order.paymentStatus === 'paid' ? (
                            <span className="text-xs font-semibold text-blue-800">
                              Ejecutado (Pagado)
                            </span>
                          ) : order.paymentStatus === 'pending_approval' ? (
                            <span className="text-xs text-slate-500">En revisión</span>
                          ) : (
                            <span className="text-xs text-slate-500">Anulada</span>
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

      {/* SOLAPA 4: Historial de Movimientos */}
      {activeTab === 'movements' && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Historial de Movimientos Presupuestarios
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Registro cronológico de emisiones, aprobaciones, pagos, ajustes de reglas y
              refuerzos de presupuesto
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {auditEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{ev.summary}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {ev.timestamp} · {ev.actor}
                  </p>
                </div>
                {typeof ev.amount === 'number' && (
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    {formatARS(ev.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
