import { OrderStatus, UserRole } from '@prisma/client';

/**
 * Әр кезеңнен қандай кезеңге өтуге болатынын анықтайды.
 * Және қай рөл сол ауысуды жасай алатынын.
 */
export const ORDER_TRANSITIONS: Record<
  OrderStatus,
  Array<{ to: OrderStatus; allowedRoles: UserRole[] }>
> = {
  NEW_TENDER: [
    { to: OrderStatus.REVIEW, allowedRoles: [UserRole.TENDER_DEPARTMENT, UserRole.ADMIN] },
    { to: OrderStatus.REJECTED, allowedRoles: [UserRole.TENDER_DEPARTMENT, UserRole.ADMIN] },
  ],
  REVIEW: [
    { to: OrderStatus.CONFIRMATION, allowedRoles: [UserRole.TENDER_DEPARTMENT, UserRole.ADMIN] },
    { to: OrderStatus.REJECTED, allowedRoles: [UserRole.TENDER_DEPARTMENT, UserRole.ADMIN] },
  ],
  CONFIRMATION: [
    // Цехта жасалады (қалыпты flow)
    { to: OrderStatus.PRODUCTION, allowedRoles: [UserRole.DIRECTOR, UserRole.ADMIN] },
    // Складтан алынады — цех аттап өтіледі
    { to: OrderStatus.PACKAGING,  allowedRoles: [UserRole.DIRECTOR, UserRole.ADMIN] },
    { to: OrderStatus.REJECTED,   allowedRoles: [UserRole.DIRECTOR, UserRole.ADMIN] },
  ],
  PRODUCTION: [
    { to: OrderStatus.PACKAGING, allowedRoles: [UserRole.PRODUCTION_HEAD, UserRole.ADMIN] },
  ],
  PACKAGING: [
    { to: OrderStatus.LOADING, allowedRoles: [UserRole.PACKAGING, UserRole.ADMIN] },
  ],
  LOADING: [
    { to: OrderStatus.LOGISTICS, allowedRoles: [UserRole.LOADING, UserRole.ADMIN] },
  ],
  LOGISTICS: [
    { to: OrderStatus.DELIVERY, allowedRoles: [UserRole.LOGISTICS, UserRole.ADMIN] },
  ],
  DELIVERY: [
    { to: OrderStatus.CLOSED, allowedRoles: [UserRole.LOGISTICS, UserRole.DIRECTOR, UserRole.ADMIN] },
  ],
  CLOSED: [],
  REJECTED: [],
};

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: UserRole,
): { ok: boolean; reason?: string } {
  const transitions = ORDER_TRANSITIONS[from];
  const target = transitions.find((t) => t.to === to);
  if (!target) {
    return { ok: false, reason: `"${from}" → "${to}" ауысуы мүмкін емес` };
  }
  if (!target.allowedRoles.includes(role)) {
    return { ok: false, reason: `"${role}" рөлінде бұл ауысуға рұқсат жоқ` };
  }
  return { ok: true };
}

/** Әр кезеңде кім жауапты болуы керек (автоматты тағайындау үшін) */
export const STATUS_DEFAULT_ROLE: Record<OrderStatus, UserRole | null> = {
  NEW_TENDER: UserRole.TENDER_DEPARTMENT,
  REVIEW: UserRole.TENDER_DEPARTMENT,
  CONFIRMATION: UserRole.DIRECTOR,
  PRODUCTION: UserRole.PRODUCTION_HEAD,
  PACKAGING: UserRole.PACKAGING,
  LOADING: UserRole.LOADING,
  LOGISTICS: UserRole.LOGISTICS,
  DELIVERY: UserRole.LOGISTICS,
  CLOSED: null,
  REJECTED: null,
};
