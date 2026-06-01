const KEY_TO_LANE = {
  KeyA: 0,
  KeyW: 1,
  KeyE: 2,
  KeyF: 3,
  KeyJ: 4,
  KeyI: 5,
  KeyO: 6,
};

export class InputManager {
  constructor(onLanePress) {
    this.onLanePress = onLanePress;
    this.enabled = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  start() {
    if (this.enabled) return;
    this.enabled = true;
    window.addEventListener('keydown', this.handleKeyDown);
  }

  stop() {
    if (!this.enabled) return;
    this.enabled = false;
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(event) {
    const lane = KEY_TO_LANE[event.code];
    if (lane === undefined || event.repeat) return;

    event.preventDefault();
    this.onLanePress(lane);
  }
}
