export class ScoreManager {
  constructor() {
    this.score = 0;
    this.attempts = 0;
  }

  registerAttempt() {
    this.attempts += 1;
  }

  calculatePoints(timeBonus = 0) {
    const base = 100;
    const penalty = this.attempts * 10;
    return Math.max(10, base + timeBonus - penalty);
  }

  add(points) {
    this.score += points;
    this.attempts = 0;
  }
}
