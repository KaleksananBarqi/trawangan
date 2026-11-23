import type { PriceAlert } from '../types/market';

export type AlertLineTone = 'bull' | 'bear' | 'neutral';
export type AlertPlanRole = 'entry' | 'sl' | `tp${number}` | (string & {});

/**
 * Memetakan kondisi dan peran Price Alert ke tone warna tema ('bull', 'bear', 'neutral').
 */
export function resolveAlertLineTone(
  alert: Pick<PriceAlert, 'condition' | 'triggered'> & { planRole?: AlertPlanRole }
): AlertLineTone {
  if (alert.triggered) {
    return 'bear';
  }
  const role = typeof alert.planRole === 'string' ? alert.planRole.toLowerCase() : '';
  if (role === 'sl') {
    return 'bear';
  }
  if (role.startsWith('tp')) {
    return 'bull';
  }
  switch (alert.condition) {
    case 'crossing_up':
    case 'above':
    case 'greater_than':
      return 'bull';
    case 'crossing_down':
    case 'below':
    case 'less_than':
      return 'bear';
    case 'crossing':
    default:
      return 'neutral';
  }
}
