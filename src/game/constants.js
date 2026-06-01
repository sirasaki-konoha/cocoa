export const KEYS = ['A', 'W', 'E', 'F', 'J', 'I', 'O'];
export const LANE_COUNT = 7;
export const LANE_WIDTH = 0.72;
export const LANE_HEIGHT = 7.35;
export const JUDGE_LINE_Y = -3.2;
export const DEFAULT_SCROLL_SPEED = 2.4;

export function laneX(lane) {
  return (lane - 3) * LANE_WIDTH;
}
