import type * as THREE from "three";

export const VEHICLE_BOUNDS = {
  halfWidth: 0.95,
  height: 1.4,
  halfLength: 2.1,
};

export type ScreenBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function screenBounds(
  projected: THREE.Vector3[],
  width: number,
  height: number
): ScreenBox | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let validCount = 0;

  for (const p of projected) {
    // If point is behind the camera (z > 1 in NDC), skip
    if (p.z > 1 || p.z < -1) continue;
    validCount++;

    const sx = ((p.x + 1) / 2) * width;
    const sy = ((-p.y + 1) / 2) * height;

    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
  }

  // Need at least most corners in front of camera
  if (validCount < 4) return null;

  // Check if box is inside or overlaps canvas viewport
  if (maxX < 0 || minX > width || maxY < 0 || minY > height) return null;

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  // Filter out tiny or giant degenerate boxes
  if (boxW < 6 || boxH < 6 || boxW > width * 0.9 || boxH > height * 0.9) {
    return null;
  }

  return {
    left: Math.round(minX),
    top: Math.round(minY),
    width: Math.round(boxW),
    height: Math.round(boxH),
  };
}

