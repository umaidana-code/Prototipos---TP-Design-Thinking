import {
  AuditEvent,
  BudgetRules,
  ExceptionRule,
  PurchaseOrder,
  Rubro,
} from '../types/budget';

export const INITIAL_RULES: BudgetRules = {
  largePurchaseThreshold: 10_000_000,
  preventivePercent: 70,
  highConsumptionPercent: 80,
  exhaustedPercent: 100,
  highRemainingShareThreshold: 60,
  requireManagerOnHighRemainingShare: false,
  additionalFundAvailable: 25_000_000,
};

export const INITIAL_EXCEPTIONS: ExceptionRule[] = [
  {
    id: 'EX-01',
    title: 'Acuerdo comercial Molinos Río de la Plata',
    rubroId: 'comestibles',
    supplier: 'Molinos Río de la Plata S.A.',
    maxAmount: 13_000_000,
    active: true,
  },
  {
    id: 'EX-02',
    title: 'Reposición programada La Serenísima',
    rubroId: 'lacteos',
    supplier: 'Mastellone Hnos. S.A. (La Serenísima)',
    maxAmount: 11_500_000,
    active: false,
  },
];

export const INITIAL_RUBROS: Rubro[] = [
  {
    id: 'comestibles',
    name: 'Comestibles / Fideos',
    code: 'RUB-101',
    limit: 85_000_000, // 42.5% del presupuesto total
    extraAssigned: 0,
    executed: 24_300_000, // Pagado
    committed: 12_250_000, // Comprometido (OC emitidas sin pagar) -> 43.0% OK
    suggestedSuppliers: [
      'Molinos Río de la Plata S.A.',
      'Arcor S.A.I.C.',
      'Lucchetti Argentina S.A.',
      'Aceitera General Deheza S.A.',
    ],
  },
  {
    id: 'lacteos',
    name: 'Lácteos',
    code: 'RUB-102',
    limit: 35_000_000, // 17.5% del presupuesto total
    extraAssigned: 0,
    executed: 18_100_000,
    committed: 7_100_000, // 25.2M = 72.0% -> Aviso preventivo (>=70%)
    suggestedSuppliers: [
      'Mastellone Hnos. S.A. (La Serenísima)',
      'Sancor Cooperativas Unidas',
      'Ilolay · Sucesores de Alfredo Williner',
      'Milkaut S.A.',
    ],
  },
  {
    id: 'frigorifico',
    name: 'Frigorífico / Carnes',
    code: 'RUB-103',
    limit: 45_000_000, // 22.5% del presupuesto total
    extraAssigned: 0,
    executed: 27_500_000,
    committed: 10_300_000, // 37.8M = 84.0% -> Advertencia consumo elevado (>=80%)
    suggestedSuppliers: [
      'Frigorífico Gorina S.A.',
      'Swift Argentina S.A.',
      'Frigorífico Rioplatense',
      'Granja Tres Arroyos S.A.',
    ],
  },
  {
    id: 'electrodomesticos',
    name: 'Electrodomésticos',
    code: 'RUB-201',
    limit: 35_000_000, // 17.5% del presupuesto total
    extraAssigned: 0,
    executed: 9_500_000,
    committed: 4_500_000, // 14.0M = 40.0% -> OK
    suggestedSuppliers: [
      'Newsan S.A. (Noblex / Philco)',
      'BGH S.A.',
      'Mirgor S.A.',
      'Whirlpool Argentina S.R.L.',
    ],
  },
];

export const INITIAL_ORDERS: PurchaseOrder[] = [
  {
    id: 'OC-2026-4821',
    createdAt: 'Hoy · 09:42',
    requester: 'Santiago Morales',
    supplier: 'Newsan S.A. (Noblex / Philco)',
    rubroId: 'electrodomesticos',
    detail: '180 Heladeras No Frost 360L · Reposición campaña verano',
    amount: 14_850_000,
    status: 'pending_manager',
    paymentStatus: 'pending_approval',
    derivationReason: 'large_purchase',
    justification:
      'Stock crítico en depósito Zona Norte; bonificación del 8% por volumen cerrada hoy.',
  },
  {
    id: 'OC-2026-4819',
    createdAt: 'Hoy · 09:18',
    requester: 'Maximiliano Vega',
    supplier: 'Frigorífico Gorina S.A.',
    rubroId: 'frigorifico',
    detail: '8.500 kg Cortes Vacunos envasados al vacío · Cadena supermercados',
    amount: 9_400_000,
    status: 'pending_manager',
    paymentStatus: 'pending_approval',
    derivationReason: 'insufficient_balance',
    justification:
      'Pedido comprometido para entrega semanal en sucursales CABA y GBA.',
  },
  {
    id: 'OC-2026-4815',
    createdAt: 'Hoy · 08:55',
    requester: 'Santiago Morales',
    supplier: 'Arcor S.A.I.C.',
    rubroId: 'comestibles',
    detail: '24 pallets Conservas, Polenta y Fideos surtidos',
    amount: 11_400_000,
    status: 'pending_manager',
    paymentStatus: 'pending_approval',
    derivationReason: 'large_purchase',
    justification:
      'Compra quincenal consolidada para optimizar flete troncal desde planta.',
  },
  {
    id: 'OC-2026-4812',
    createdAt: 'Hoy · 08:30',
    requester: 'Maximiliano Vega',
    supplier: 'Mastellone Hnos. S.A. (La Serenísima)',
    rubroId: 'lacteos',
    detail: '14.000 L Leche UAT Larga Vida + Yogures bebible pack x12',
    amount: 10_600_000,
    status: 'pending_manager',
    paymentStatus: 'pending_approval',
    derivationReason: 'multiple',
    justification:
      'Cobertura de quiebre de stock por promoción semanal en canal mayorista.',
  },
  {
    id: 'OC-2026-4808',
    createdAt: 'Ayer · 17:45',
    requester: 'Santiago Morales',
    supplier: 'BGH S.A.',
    rubroId: 'electrodomesticos',
    detail: '110 Aires Acondicionados Split Inverter 3200W',
    amount: 16_200_000,
    status: 'pending_manager',
    paymentStatus: 'pending_approval',
    derivationReason: 'large_purchase',
    justification: 'Pre-compra estacional acordada con área comercial.',
  },
  {
    id: 'OC-2026-4804',
    createdAt: 'Ayer · 16:50',
    requester: 'Santiago Morales',
    supplier: 'Arcor S.A.I.C.',
    rubroId: 'comestibles',
    detail: '6.000 cajas Galletitas y Conservas surtidas',
    amount: 5_850_000,
    status: 'approved_auto',
    paymentStatus: 'committed',
    derivationReason: null,
  },
  {
    id: 'OC-2026-4801',
    createdAt: 'Ayer · 16:12',
    requester: 'Maximiliano Vega',
    supplier: 'Milkaut S.A.',
    rubroId: 'lacteos',
    detail: '2.400 kg Queso Cremoso horma x 4 kg',
    amount: 4_120_000,
    status: 'approved_auto',
    paymentStatus: 'committed',
    derivationReason: null,
  },
  {
    id: 'OC-2026-4798',
    createdAt: 'Ayer · 15:20',
    requester: 'Santiago Morales',
    supplier: 'Lucchetti Argentina S.A.',
    rubroId: 'comestibles',
    detail: '12 pallets Fideos Tallarín 500g',
    amount: 3_900_000,
    status: 'approved_auto',
    paymentStatus: 'paid',
    derivationReason: null,
  },
];

export const INITIAL_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'EV-105',
    timestamp: 'Hoy · 09:42',
    actor: 'Santiago Morales',
    category: 'emision',
    summary: 'OC-2026-4821 derivada a Gerencia (supera umbral $10M)',
    amount: 14_850_000,
  },
  {
    id: 'EV-104',
    timestamp: 'Hoy · 09:18',
    actor: 'Maximiliano Vega',
    category: 'emision',
    summary: 'OC-2026-4819 derivada a Gerencia (saldo insuficiente en Frigorífico / Carnes)',
    amount: 9_400_000,
  },
  {
    id: 'EV-103',
    timestamp: 'Ayer · 16:50',
    actor: 'Santiago Morales',
    category: 'emision',
    summary: 'OC-2026-4804 aprobada automáticamente (saldo comprometido)',
    amount: 5_850_000,
  },
  {
    id: 'EV-102',
    timestamp: 'Ayer · 15:20',
    actor: 'Tesorería / Compras',
    category: 'pago',
    summary: 'Pago liquidado sobre OC-2026-4798 (pasó de comprometido a ejecutado)',
    amount: 3_900_000,
  },
];
