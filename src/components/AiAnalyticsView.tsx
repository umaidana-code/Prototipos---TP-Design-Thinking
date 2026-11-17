import {
  AlertCircle,
  BarChart3,
  Loader2,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import {
  BudgetRules,
  ExceptionRule,
  PurchaseOrder,
  Rubro,
} from '../types/budget';
import {
  formatARS,
  formatMillions,
  formatPercent,
  getRubroAvailable,
  getRubroConsumed,
} from '../utils/formatters';

interface AiAnalyticsViewProps {
  rubros: Rubro[];
  rules: BudgetRules;
  exceptions: ExceptionRule[];
  orders: PurchaseOrder[];
}

interface AiRecommendationResponse {
  resumenEjecutivo: string;
  recomendaciones: Array<{
    rubro: string;
    accion: string;
    detalle: string;
    montoSugeridoARS: number;
  }>;
  focosDemanda: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
}

const HISTORICAL_MONTHS = [
  { month: 'Junio', total: 168_000_000, autoPct: 74 },
  { month: 'Julio', total: 174_500_000, autoPct: 76 },
  { month: 'Agosto', total: 181_200_000, autoPct: 75 },
  { month: 'Septiembre', total: 186_000_000, autoPct: 77 },
  { month: 'Octubre', total: 194_400_000, autoPct: 78 },
];

const TOP_DEMAND_PRODUCTS = [
  {
    product: 'Fideos Secos Matarazzo / Lucchetti 500g',
    rubro: 'Comestibles / Fideos',
    volume: '142 pallets / mes',
    variation: '+18%',
    priority: 'Alta rotación',
  },
  {
    product: 'Cortes Vacunos Envasados al Vacío',
    rubro: 'Frigorífico / Carnes',
    volume: '34.500 kg / mes',
    variation: '+22%',
    priority: 'Riesgo de faltante',
  },
  {
    product: 'Leche UAT Larga Vida La Serenísima 1L',
    rubro: 'Lácteos',
    volume: '58.000 L / mes',
    variation: '+14%',
    priority: 'Demanda sostenida',
  },
  {
    product: 'Heladeras No Frost & Split Inverter',
    rubro: 'Electrodomésticos',
    volume: '310 unidades / mes',
    variation: '+29%',
    priority: 'Pico estacional',
  },
];

const QUICK_QUESTIONS = [
  '¿Qué rubro tiene mayor riesgo de agotarse este mes?',
  '¿Cómo conviene distribuir el Fondo Adicional de $25M?',
  '¿Conviene aprobar las órdenes pendientes en Gerencia?',
  'Resumí mi saldo pagado vs. comprometido actual.',
];

export function AiAnalyticsView({
  rubros,
  rules,
  exceptions,
  orders,
}: AiAnalyticsViewProps) {
  // AI Recommendations state
  const [aiReport, setAiReport] = useState<AiRecommendationResponse | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState('');

  // Assistant Q&A state
  const [questionInput, setQuestionInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const currentTotals = useMemo(() => {
    const budget = rubros.reduce((acc, r) => acc + r.limit, 0);
    const executed = rubros.reduce((acc, r) => acc + r.executed, 0);
    const committed = rubros.reduce((acc, r) => acc + r.committed, 0);
    const consumed = executed + committed;
    const available = Math.max(0, budget - consumed);
    const pendingCount = orders.filter((o) => o.status === 'pending_manager').length;
    return { budget, executed, committed, consumed, available, pendingCount };
  }, [rubros, orders]);

  const maxHistorical = useMemo(
    () =>
      Math.max(
        ...HISTORICAL_MONTHS.map((m) => m.total),
        currentTotals.consumed,
        1
      ),
    [currentTotals.consumed]
  );

  // Live deterministic budget distribution insights from actual data
  const liveInsights = useMemo(() => {
    return rubros.map((r) => {
      const consumed = getRubroConsumed(r);
      const available = getRubroAvailable(r);
      const pct = r.limit > 0 ? (consumed / r.limit) * 100 : 100;
      let recommendation = 'Presupuesto equilibrado para el ritmo de compra actual.';
      let badge = 'Mantener';
      let badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

      if (pct >= rules.highConsumptionPercent) {
        recommendation = `Superó el ${rules.highConsumptionPercent}% de uso. Se sugiere reforzar con Fondo Adicional para evitar frenos en reposición.`;
        badge = 'Reforzar saldo';
        badgeColor = 'text-red-700 bg-red-50 border-red-200';
      } else if (pct >= rules.preventivePercent) {
        recommendation = `Superó el ${rules.preventivePercent}% preventivo. Priorizar solo compras de alta rotación hasta fin de mes.`;
        badge = 'Monitorear';
        badgeColor = 'text-amber-800 bg-amber-50 border-amber-200';
      } else if (pct < 45) {
        recommendation = `Consumo moderado (${formatPercent(
          pct
        )}). Cuenta con margen disponible (${formatARS(available)}) ante oportunidades por volumen.`;
        badge = 'Con margen';
        badgeColor = 'text-blue-700 bg-blue-50 border-blue-200';
      }

      return { rubro: r, pct, available, recommendation, badge, badgeColor };
    });
  }, [rubros, rules]);

  const handleGenerateAiRecommendations = async () => {
    setAiReportLoading(true);
    setAiReportError('');
    try {
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubros: rubros.map((r) => ({
            nombre: r.name,
            limite: r.limit,
            pagadoEjecutado: r.executed,
            comprometidoSinPagar: r.committed,
            disponible: getRubroAvailable(r),
          })),
          rules,
          orders: orders.slice(0, 10),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo completar el análisis.');
      }
      setAiReport(data as AiRecommendationResponse);
    } catch (err: unknown) {
      setAiReportError(
        err instanceof Error
          ? err.message
          : 'Error al conectar con el servicio de análisis IA.'
      );
    } finally {
      setAiReportLoading(false);
    }
  };

  const submitQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestionInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          context: {
            resumenMes: currentTotals,
            rubros: rubros.map((r) => ({
              nombre: r.name,
              limiteMensual: r.limit,
              saldoPagadoEjecutado: r.executed,
              saldoComprometidoSinPagar: r.committed,
              saldoDisponible: getRubroAvailable(r),
              porcentajeUsado: formatPercent(
                r.limit > 0 ? (getRubroConsumed(r) / r.limit) * 100 : 100
              ),
            })),
            reglas: rules,
            excepcionesActivas: exceptions.filter((e) => e.active),
            ordenesPendientesGerencia: orders
              .filter((o) => o.status === 'pending_manager')
              .map((o) => ({
                id: o.id,
                proveedor: o.supplier,
                rubro: o.rubroId,
                monto: o.amount,
                motivo: o.derivationReason,
                justificacion: o.justification,
              })),
            productosMayorDemanda: TOP_DEMAND_PRODUCTS,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al consultar al asistente.');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.answer || 'No se recibió respuesta del asistente.',
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'No se pudo consultar al asistente inteligente.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuestion(questionInput);
  };

  return (
    <div className="space-y-8">
      {/* Nota clara de contexto: Segunda Evolución */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-950">
              Módulo 3 · Inteligencia Artificial y Análisis (Segunda Evolución)
            </p>
            <p className="mt-0.5 text-sm text-blue-900/80">
              Complementa el control presupuestario en tiempo real con histórico de
              compras, productos más demandados, recomendaciones de distribución y
              asistente inteligente.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Análisis de Compras Históricas + Productos de Mayor Demanda */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Compras Históricas */}
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-6">
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-6 py-4">
            <BarChart3 className="h-5 w-5 text-blue-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Análisis de Compras Históricas
              </h2>
              <p className="text-sm text-slate-500">
                Evolución mensual de consumo y porcentaje de aprobación automática
              </p>
            </div>
          </div>

          <div className="space-y-4 p-6">
            {HISTORICAL_MONTHS.map((item) => {
              const barPct = (item.total / maxHistorical) * 100;
              return (
                <div key={item.month} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{item.month} 2026</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatARS(item.total)}{' '}
                      <span className="font-sans text-xs font-normal text-slate-500">
                        ({item.autoPct}% auto)
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-400"
                      style={{ width: `${Math.min(100, barPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Mes actual en vivo */}
            <div className="space-y-1.5 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-blue-800">
                  Noviembre 2026 (En curso)
                </span>
                <span className="font-mono font-semibold text-blue-800 tabular-nums">
                  {formatARS(currentTotals.consumed)}{' '}
                  <span className="font-sans text-xs font-normal text-slate-500">
                    (Pagado {formatMillions(currentTotals.executed)} · Comp.{' '}
                    {formatMillions(currentTotals.committed)})
                  </span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-700 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (currentTotals.consumed / maxHistorical) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Identificación de Productos de Mayor Demanda */}
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-6">
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-6 py-4">
            <TrendingUp className="h-5 w-5 text-blue-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Productos de Mayor Demanda
              </h2>
              <p className="text-sm text-slate-500">
                Artículos con mayor rotación mensual en EscenaViva Entertainment
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {TOP_DEMAND_PRODUCTS.map((item) => (
              <div
                key={item.product}
                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.product}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.rubro} · {item.volume}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-emerald-700 tabular-nums">
                    {item.variation}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap">
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 2. Recomendaciones para Distribuir el Presupuesto */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recomendaciones para Distribuir el Presupuesto
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Sugerencias basadas en el consumo actual de cada rubro y análisis con IA
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateAiRecommendations}
            disabled={aiReportLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
          >
            {aiReportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>
              {aiReportLoading ? 'Analizando con IA...' : 'Generar análisis con IA'}
            </span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Vista inmediata por rubro */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {liveInsights.map((item) => (
              <div
                key={item.rubro.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.rubro.name} ({formatPercent(item.pct)})
                  </p>
                  <span
                    className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {item.recommendation}
                </p>
              </div>
            ))}
          </div>

          {/* Error de API si falta clave o falla Gemini */}
          {aiReportError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{aiReportError}</span>
            </div>
          )}

          {/* Respuesta estructurada de Gemini */}
          {aiReport && (
            <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-5">
              <div>
                <p className="text-sm font-semibold text-blue-950">
                  Diagnóstico de Inteligencia Artificial
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">
                  {aiReport.resumenEjecutivo}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {aiReport.recomendaciones.map((rec, idx) => (
                  <div
                    key={`${rec.rubro}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{rec.rubro}</p>
                      <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                        {rec.accion} · {formatARS(rec.montoSugeridoARS)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-700">{rec.detalle}</p>
                  </div>
                ))}
              </div>

              {aiReport.focosDemanda.length > 0 && (
                <div className="border-t border-blue-200/70 pt-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Focos de demanda detectados:
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                    {aiReport.focosDemanda.map((foco, idx) => (
                      <li key={idx}>· {foco}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. Asistente Inteligente para Consultas y Decisiones */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Asistente Inteligente para Consultas y Decisiones
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Preguntá sobre saldos disponibles, órdenes pendientes en Gerencia o criterios
            de compra
          </p>
        </div>

        <div className="space-y-5 p-6">
          {/* Preguntas rápidas claras y grandes */}
          <div>
            <p className="mb-2.5 text-sm font-medium text-slate-700">
              Consultas frecuentes
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={chatLoading}
                  onClick={() => submitQuestion(q)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50/60 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Historial de mensajes */}
          {messages.length > 0 && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'ml-auto max-w-2xl bg-blue-700 text-white'
                      : msg.role === 'error'
                      ? 'border border-red-200 bg-red-50 text-red-800'
                      : 'border border-slate-200 bg-white text-slate-800 whitespace-pre-line'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analizando datos del presupuesto...</span>
                </div>
              )}
            </div>
          )}

          {/* Formulario de consulta */}
          <form onSubmit={handleChatSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="Escribí tu consulta sobre presupuesto, saldos o compras..."
              aria-label="Consulta al asistente inteligente"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              disabled={chatLoading || !questionInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-4 w-4" />
              <span>Consultar</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
