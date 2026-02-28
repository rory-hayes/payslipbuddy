import type { MomDiff, PayslipBreakdown } from "@/lib/types/domain";
import type { PayslipLineItem } from "@/lib/types/domain";

const metricKeys = ["gross", "net", "tax", "pension", "niOrPrsi", "usc", "bonuses", "overtime"] as const;
type MetricKey = (typeof metricKeys)[number];

function computeDirection(delta: number): MomDiff["direction"] {
  if (delta > 0) {
    return "UP";
  }
  if (delta < 0) {
    return "DOWN";
  }
  return "UNCHANGED";
}

function toInsight(metric: MetricKey, delta: number): string {
  if (delta === 0) {
    return `${metric} stayed unchanged from the previous month.`;
  }

  const absolute = Math.abs(delta).toFixed(2);
  if (metric === "tax" || metric === "pension" || metric === "niOrPrsi" || metric === "usc") {
    return delta > 0
      ? `${metric} increased by ${absolute}; check if deductions changed.`
      : `${metric} decreased by ${absolute}; verify if deductions dropped as expected.`;
  }

  if (metric === "overtime" || metric === "bonuses") {
    return delta > 0
      ? `${metric} rose by ${absolute}; variable pay appears higher.`
      : `${metric} fell by ${absolute}; variable pay appears lower.`;
  }

  return delta > 0 ? `${metric} increased by ${absolute}.` : `${metric} decreased by ${absolute}.`;
}

function value(entry: PayslipBreakdown, metric: MetricKey): number {
  return entry[metric] ?? 0;
}

export function calculateMomDiff(current: PayslipBreakdown, previous: PayslipBreakdown): MomDiff[] {
  return metricKeys.map((metric) => {
    const currentValue = value(current, metric);
    const previousValue = value(previous, metric);
    const delta = Number((currentValue - previousValue).toFixed(2));

    return {
      metric,
      current: currentValue,
      previous: previousValue,
      delta,
      direction: computeDirection(delta),
      insight: toInsight(metric, delta)
    };
  });
}

export interface LineItemChange {
  label: string;
  type: PayslipLineItem["type"];
  currentAmount: number;
  previousAmount: number;
  delta: number;
  isNew: boolean;
  isIrregular: boolean;
}

export function detectLineItemChanges(current: PayslipLineItem[], previous: PayslipLineItem[]): LineItemChange[] {
  const previousMap = new Map(previous.map((item) => [`${item.type}:${item.label}`, item]));

  const directChanges = current.map((item) => {
    const key = `${item.type}:${item.label}`;
    const oldValue = previousMap.get(key);
    const previousAmount = oldValue?.amount ?? 0;
    const delta = Number((item.amount - previousAmount).toFixed(2));

    return {
      label: item.label,
      type: item.type,
      currentAmount: item.amount,
      previousAmount,
      delta,
      isNew: !oldValue,
      isIrregular: Math.abs(delta) >= 50
    };
  });

  const droppedItems = previous
    .filter((item) => !current.some((candidate) => candidate.type === item.type && candidate.label === item.label))
    .map((item) => ({
      label: item.label,
      type: item.type,
      currentAmount: 0,
      previousAmount: item.amount,
      delta: Number((0 - item.amount).toFixed(2)),
      isNew: false,
      isIrregular: Math.abs(item.amount) >= 50
    }));

  return [...directChanges, ...droppedItems].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
