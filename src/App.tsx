import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AiAnalyticsView } from './components/AiAnalyticsView';
import { ManagerView } from './components/ManagerView';
import { OperatorView } from './components/OperatorView';
import { ToastBanner } from './components/ToastBanner';
import {
  INITIAL_AUDIT_EVENTS,
  INITIAL_EXCEPTIONS,
  INITIAL_ORDERS,
  INITIAL_RUBROS,
  INITIAL_RULES,
} from './data/initialData';
import {
  AuditEvent,
  BudgetRules,
  ExceptionRule,
  PurchaseOrder,
  Rubro,
  RubroId,
  ToastNotification,
  UserRole,
} from './types/budget';
import {
  evaluateOrderValidation,
  formatARS,
  formatPercent,
  getRubroConsumed,
} from './utils/formatters';

export default function App() {
  const [activeRole, setActiveRole] = useState<UserRole>('operator');
  const [rubros, setRubros] = useState<Rubro[]>(INITIAL_RUBROS);
  const [rules, setRules] = useState<BudgetRules>(INITIAL_RULES);
  const [exceptions, setExceptions] = useState<ExceptionRule[]>(INITIAL_EXCEPTIONS);
  const [orders, setOrders] = useState<PurchaseOrder[]>(INITIAL_ORDERS);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(INITIAL_AUDIT_EVENTS);
  const [nextOrderNumber, setNextOrderNumber] = useState<number>(4822);
  const [nextEventNumber, setNextEventNumber] = useState<number>(106);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((nextToast: Omit<ToastNotification, 'id'>) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = String(Date.now());
    setToast({ id, ...nextToast });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const getNowLabel = () => {
    const time = new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
    return `Hoy · ${time}`;
  };

  const pushAuditEvent = useCallback(
    (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
      setNextEventNumber((n) => {
        const id = `EV-${n}`;
        setAuditEvents((prev) => [
          { id, timestamp: getNowLabel(), ...event },
          ...prev,
        ]);
        return n + 1;
      });
    },
    []
  );

  const pendingCount = orders.filter((o) => o.status === 'pending_manager').length;

  const handleEmitOrder = (payload: {
    requester: 'Santiago Morales' | 'Maximiliano Vega';
    supplier: string;
    rubroId: RubroId;
    detail: string;
    amount: number;
    justification?: string;
  }) => {
    const targetRubro = rubros.find((r) => r.id === payload.rubroId);
    if (!targetRubro) return;

    const validation = evaluateOrderValidation(
      payload.amount,
      targetRubro,
      payload.supplier,
      rules,
      exceptions
    );

    const ocId = `OC-2026-${nextOrderNumber}`;
    setNextOrderNumber((n) => n + 1);
    const nowLabel = getNowLabel();

    if (!validation.requiresManager) {
      setRubros((prev) =>
        prev.map((r) =>
          r.id === payload.rubroId
            ? { ...r, committed: r.committed + payload.amount }
            : r
        )
      );

      const approvedOrder: PurchaseOrder = {
        id: ocId,
        createdAt: nowLabel,
        requester: payload.requester,
        supplier: payload.supplier,
        rubroId: payload.rubroId,
        detail: payload.detail,
        amount: payload.amount,
        status: 'approved_auto',
        paymentStatus: 'committed',
        derivationReason: null,
        appliedException: validation.matchedException?.title,
      };

      setOrders((prev) => [approvedOrder, ...prev]);

      pushAuditEvent({
        actor: payload.requester,
        category: 'emision',
        summary: validation.matchedException
          ? `${ocId} aprobada automáticamente por excepción (${validation.matchedException.title})`
          : `${ocId} aprobada automáticamente en ${targetRubro.name}`,
        amount: payload.amount,
      });

      const alertSuffix =
        validation.postPurchaseHealth === 'exhausted'
          ? ` El rubro alcanzó ${formatPercent(validation.postPurchasePct)}.`
          : validation.postPurchaseHealth === 'high'
          ? ` Consumo elevado (${formatPercent(validation.postPurchasePct)}).`
          : validation.postPurchaseHealth === 'preventive'
          ? ` Aviso preventivo (${formatPercent(validation.postPurchasePct)}).`
          : ` Saldo libre: ${formatARS(validation.postPurchaseAvailable)}.`;

      showToast({
        tone: validation.postPurchaseHealth === 'high' ? 'warning' : 'success',
        title: `${ocId} Aprobada Automáticamente`,
        message: `${formatARS(payload.amount)} imputados como comprometido en ${
          targetRubro.name
        }.${alertSuffix}`,
      });
    } else {
      const pendingOrder: PurchaseOrder = {
        id: ocId,
        createdAt: nowLabel,
        requester: payload.requester,
        supplier: payload.supplier,
        rubroId: payload.rubroId,
        detail: payload.detail,
        amount: payload.amount,
        status: 'pending_manager',
        paymentStatus: 'pending_approval',
        derivationReason: validation.reason,
        justification: payload.justification,
      };

      setOrders((prev) => [pendingOrder, ...prev]);

      pushAuditEvent({
        actor: payload.requester,
        category: 'emision',
        summary: `${ocId} enviada a Carlos Méndez para aprobación`,
        amount: payload.amount,
      });

      showToast({
        tone: 'warning',
        title: `${ocId} Derivada a Carlos`,
        message: `La orden de ${formatARS(payload.amount)} quedó pendiente de aprobación en Gerencia.`,
      });
    }
  };

  const handleRegisterPayment = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.paymentStatus !== 'committed') return;

    const targetRubro = rubros.find((r) => r.id === order.rubroId);

    setRubros((prev) =>
      prev.map((r) => {
        if (r.id !== order.rubroId) return r;
        return {
          ...r,
          committed: Math.max(0, r.committed - order.amount),
          executed: r.executed + order.amount,
        };
      })
    );

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, paymentStatus: 'paid' } : o))
    );

    pushAuditEvent({
      actor: 'Tesorería / Compras',
      category: 'pago',
      summary: `Pago registrado sobre ${order.id} en ${targetRubro?.name ?? order.rubroId}`,
      amount: order.amount,
    });

    showToast({
      tone: 'info',
      title: `Pago registrado · ${order.id}`,
      message: `${formatARS(order.amount)} pasaron de Saldo Comprometido a Saldo Ejecutado.`,
    });
  };

  const handleApproveOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'pending_manager') return;

    const targetRubro = rubros.find((r) => r.id === order.rubroId);
    const nowLabel = getNowLabel();

    setRubros((prev) =>
      prev.map((r) =>
        r.id === order.rubroId
          ? { ...r, committed: r.committed + order.amount }
          : r
      )
    );

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'approved_manager',
              paymentStatus: 'committed',
              resolvedAt: nowLabel,
              resolvedBy: 'Carlos Méndez',
            }
          : o
      )
    );

    pushAuditEvent({
      actor: 'Carlos Méndez',
      category: 'aprobacion',
      summary: `${order.id} aprobada en ${targetRubro?.name ?? order.rubroId}`,
      amount: order.amount,
    });

    showToast({
      tone: 'success',
      title: `${order.id} Aprobada`,
      message: `Se imputaron ${formatARS(order.amount)} en ${
        targetRubro?.name ?? order.rubroId
      }.`,
    });
  };

  const handleRejectOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'pending_manager') return;

    const nowLabel = getNowLabel();

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'rejected_manager',
              paymentStatus: 'cancelled',
              resolvedAt: nowLabel,
              resolvedBy: 'Carlos Méndez',
            }
          : o
      )
    );

    pushAuditEvent({
      actor: 'Carlos Méndez',
      category: 'aprobacion',
      summary: `${order.id} rechazada por Gerencia`,
      amount: order.amount,
    });

    showToast({
      tone: 'danger',
      title: `${order.id} Rechazada`,
      message: `La solicitud por ${formatARS(order.amount)} fue rechazada.`,
    });
  };

  const handleSaveRules = (
    nextRubroLimits: Record<RubroId, number>,
    nextRules: BudgetRules
  ) => {
    setRubros((prev) =>
      prev.map((r) => ({
        ...r,
        limit: nextRubroLimits[r.id] ?? r.limit,
      }))
    );
    setRules(nextRules);

    const newTotal = Object.values(nextRubroLimits).reduce((acc, v) => acc + v, 0);

    pushAuditEvent({
      actor: 'Carlos Méndez',
      category: 'reglas',
      summary: `Reglas actualizadas · Presupuesto ${formatARS(newTotal)}`,
      amount: newTotal,
    });

    showToast({
      tone: 'info',
      title: 'Reglas guardadas',
      message: `Presupuesto mensual en ${formatARS(newTotal)} y umbral en ${formatARS(
        nextRules.largePurchaseThreshold
      )}.`,
    });
  };

  const handleToggleException = (exceptionId: string) => {
    setExceptions((prev) =>
      prev.map((ex) => (ex.id === exceptionId ? { ...ex, active: !ex.active } : ex))
    );
  };

  const handleAddException = (payload: Omit<ExceptionRule, 'id'>) => {
    const id = `EX-0${exceptions.length + 1}`;
    setExceptions((prev) => [{ id, ...payload }, ...prev]);

    showToast({
      tone: 'info',
      title: 'Excepción agregada',
      message: `"${payload.title}" activa hasta ${formatARS(payload.maxAmount)}.`,
    });
  };

  const handleAssignAdditionalFund = (rubroId: RubroId, amount: number) => {
    if (amount <= 0 || amount > rules.additionalFundAvailable) return;
    const target = rubros.find((r) => r.id === rubroId);
    if (!target) return;

    setRubros((prev) =>
      prev.map((r) =>
        r.id === rubroId
          ? {
              ...r,
              limit: r.limit + amount,
              extraAssigned: r.extraAssigned + amount,
            }
          : r
      )
    );

    setRules((prev) => ({
      ...prev,
      additionalFundAvailable: Math.max(0, prev.additionalFundAvailable - amount),
    }));

    const newLimit = target.limit + amount;
    const newUsedPct =
      newLimit > 0 ? (getRubroConsumed(target) / newLimit) * 100 : 100;

    pushAuditEvent({
      actor: 'Carlos Méndez',
      category: 'fondo',
      summary: `Refuerzo asignado a ${target.name} (uso actual: ${formatPercent(
        newUsedPct
      )})`,
      amount,
    });

    showToast({
      tone: 'success',
      title: `Refuerzo asignado a ${target.name}`,
      message: `Nuevo límite del rubro: ${formatARS(newLimit)}.`,
    });
  };

  const handleUpdateAdditionalFundPool = (newTotal: number) => {
    setRules((prev) => ({ ...prev, additionalFundAvailable: Math.max(0, newTotal) }));
    showToast({
      tone: 'info',
      title: 'Fondo Adicional actualizado',
      message: `Disponible: ${formatARS(newTotal)}.`,
    });
  };

  const handleResetDemo = () => {
    setRubros(INITIAL_RUBROS);
    setRules(INITIAL_RULES);
    setExceptions(INITIAL_EXCEPTIONS);
    setOrders(INITIAL_ORDERS);
    setAuditEvents(INITIAL_AUDIT_EVENTS);
    setNextOrderNumber(4822);
    setNextEventNumber(106);
    showToast({
      tone: 'info',
      title: 'Demo reiniciada',
      message: 'Se restauraron los datos iniciales de EscenaViva.',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Simple 3-zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveRole('operator')}
            className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            EscenaViva ERP
          </button>

          <nav
            className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600"
            aria-label="Vistas principales"
          >
            <button
              type="button"
              onClick={() => setActiveRole('operator')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                activeRole === 'operator'
                  ? 'text-blue-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Operario
            </button>
            <button
              type="button"
              onClick={() => setActiveRole('manager')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                activeRole === 'manager'
                  ? 'text-blue-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Gerencia ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveRole('ai')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                activeRole === 'ai'
                  ? 'text-blue-700 underline underline-offset-4'
                  : ''
              }`}
            >
              IA y Análisis
            </button>
          </nav>

          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reiniciar demo</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Clean Page Header & Role Switcher */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {activeRole === 'operator'
                ? 'Control Presupuestario · Operario'
                : activeRole === 'manager'
                ? 'Control Presupuestario · Gerencia'
                : 'Inteligencia Artificial y Análisis'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {activeRole === 'operator'
                ? 'Consultá saldos pagados y comprometidos al instante y emití órdenes sin esperas.'
                : activeRole === 'manager'
                ? 'Autorizá excepciones en 1 clic y ajustá las reglas presupuestarias.'
                : 'Histórico de compras, productos de mayor demanda, recomendaciones y asistente IA.'}
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1 self-start rounded-xl border border-slate-200 bg-white p-1"
            role="tablist"
            aria-label="Cambiar entre vista de operario, gerente e IA"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'operator'}
              onClick={() => setActiveRole('operator')}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeRole === 'operator'
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              Santiago (Operario)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'manager'}
              onClick={() => setActiveRole('manager')}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeRole === 'manager'
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              Carlos (Gerente · {pendingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'ai'}
              onClick={() => setActiveRole('ai')}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeRole === 'ai'
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              IA y Análisis (Fase 2)
            </button>
          </div>
        </div>

        {activeRole === 'operator' ? (
          <OperatorView
            rubros={rubros}
            rules={rules}
            exceptions={exceptions}
            orders={orders}
            auditEvents={auditEvents}
            onEmitOrder={handleEmitOrder}
            onRegisterPayment={handleRegisterPayment}
          />
        ) : activeRole === 'manager' ? (
          <ManagerView
            rubros={rubros}
            rules={rules}
            exceptions={exceptions}
            orders={orders}
            onApproveOrder={handleApproveOrder}
            onRejectOrder={handleRejectOrder}
            onSaveRules={handleSaveRules}
            onToggleException={handleToggleException}
            onAddException={handleAddException}
            onAssignAdditionalFund={handleAssignAdditionalFund}
            onUpdateAdditionalFundPool={handleUpdateAdditionalFundPool}
          />
        ) : (
          <AiAnalyticsView
            rubros={rubros}
            rules={rules}
            exceptions={exceptions}
            orders={orders}
          />
        )}
      </main>

      <ToastBanner toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
