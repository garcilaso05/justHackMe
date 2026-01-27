export class TimerManager {
  constructor(onTick) {
    this.onTick = onTick;
    this.remaining = null;
    this.timerId = null;
  }

  start(limitSeconds) {
    this.stop();
    if (limitSeconds == null) {
      this.remaining = null;
      this.onTick?.(null);
      return;
    }
    this.remaining = limitSeconds;
    this.onTick?.(this.remaining);
    this.timerId = setInterval(() => {
      this.remaining -= 1;
      this.onTick?.(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
      }
    }, 1000);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
