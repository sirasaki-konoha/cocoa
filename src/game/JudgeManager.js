export class JudgeManager {
  constructor(noteManager, scoreManager, uiRenderer, laneRenderer, songManager) {
    this.noteManager = noteManager;
    this.scoreManager = scoreManager;
    this.uiRenderer = uiRenderer;
    this.laneRenderer = laneRenderer;
    this.songManager = songManager;
  }

  judgeLane(lane) {
    const songTime = this.songManager.getTime();
    const note = this.noteManager.findClosestNote(lane, songTime, 0.15);

    this.laneRenderer.flash(lane);

    if (!note) {
      this.uiRenderer.showJudge('MISS');
      return;
    }

    const diff = Math.abs(songTime - note.time);
    const judge = diff <= 0.05 ? 'PERFECT' : 'GREAT';

    this.noteManager.hit(note);
    this.scoreManager.applyJudge(judge, note.type);
    this.uiRenderer.showJudge(judge);

    if (note.type === 'bonus') {
      this.uiRenderer.showBonus();
    }
  }

  checkMisses(songTime) {
    const missedNotes = this.noteManager.collectMisses(songTime, 0.15);
    for (const note of missedNotes) {
      this.scoreManager.applyJudge('MISS', note.type);
      this.uiRenderer.showJudge('MISS');
    }
  }
}
