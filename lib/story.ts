export const story = {
  p: 0,
  target: 0,
  mouse: { x: 0, y: 0 },
};

export function stageOf(p: number): string {
  if (p < 0.2) return "intro";
  if (p < 0.45) return "detection";
  if (p < 0.7) return "congestion";
  return "optimization";
}

export function factors(p: number): {
  intel: number;
  jam: number;
  decision: number;
  solution: number;
} {
  const intel = Math.min(1, Math.max(0, (p - 0.15) / 0.15));
  const jam = p >= 0.2 && p <= 0.8 ? Math.sin(((p - 0.2) / 0.6) * Math.PI) : 0;
  const decision = Math.min(1, Math.max(0, (p - 0.48) / 0.15));
  const solution = Math.min(1, Math.max(0, (p - 0.7) / 0.18));
  return { intel, jam, decision, solution };
}

