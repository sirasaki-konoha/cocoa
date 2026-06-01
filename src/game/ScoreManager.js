const JUDGE_SCORE = {
  PERFECT: 1000,
  GREAT: 700,
  MISS: 0,
};

export class ScoreManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = {
      PERFECT: 0,
      GREAT: 0,
      MISS: 0,
      bonus: 0,
    };
  }

  applyJudge(judge, noteType) {
    this.counts[judge] += 1;

    if (judge === 'MISS') {
      this.combo = 0;
      return;
    }

    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += JUDGE_SCORE[judge];

    if (noteType === 'bonus') {
      this.score = Math.round(this.score * 1.2);
      this.counts.bonus += 1;
    }
  }

  getRank(totalNotes) {
    const maxScore = Math.max(1, totalNotes * JUDGE_SCORE.PERFECT);
    const rate = this.score / maxScore;

    if (rate >= 0.92 && this.counts.MISS <= 2) return 'S';
    if (rate >= 0.78) return 'A';
    if (rate >= 0.58) return 'B';
    if (rate >= 0.36) return 'C';
    return 'D';
  }
}
