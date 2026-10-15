export const SHORTAGE_LEVEL = 20;
export const supplyMoodEffect = (resources: number) => resources < SHORTAGE_LEVEL ? -.2 : .015;

/** Pressure fades gradually; scarcity remains a stronger continuing stressor. */
export function tensionFlow(resources: number, tension: number) {
  return { scarcity: resources < SHORTAGE_LEVEL ? .06 : 0, easing: tension * .00015 };
}
