import { JUDGE_LINE_Y } from './constants.js';

export class NoteManager {
  constructor(noteRenderer) {
    this.noteRenderer = noteRenderer;
    this.spawnAheadTime = 3.2;
    this.notes = [];
    this.activeNotes = [];
    this.nextIndex = 0;
  }

  load(chart) {
    this.notes = chart.notes
      .map((note, index) => ({ ...note, id: index, rendered: null, judged: false }))
      .sort((a, b) => a.time - b.time);
    this.reset();
  }

  reset() {
    for (const note of this.activeNotes) {
      this.noteRenderer.remove(note.rendered);
      note.rendered = null;
    }

    this.activeNotes = [];
    this.nextIndex = 0;
    for (const note of this.notes) {
      note.judged = false;
      note.rendered = null;
    }
  }

  update(songTime, scrollSpeed) {
    while (
      this.nextIndex < this.notes.length &&
      this.notes[this.nextIndex].time <= songTime + this.spawnAheadTime
    ) {
      const note = this.notes[this.nextIndex];
      note.rendered = this.noteRenderer.create(note);
      this.activeNotes.push(note);
      this.nextIndex += 1;
    }

    for (const note of this.activeNotes) {
      const remain = note.time - songTime;
      const y = JUDGE_LINE_Y + remain * scrollSpeed;
      this.noteRenderer.update(note.rendered, y, songTime);
    }
  }

  findClosestNote(lane, songTime, judgeWindow) {
    let closest = null;
    let closestDiff = Infinity;

    for (const note of this.activeNotes) {
      if (note.judged || note.lane !== lane) continue;

      const diff = Math.abs(songTime - note.time);
      if (diff <= judgeWindow && diff < closestDiff) {
        closest = note;
        closestDiff = diff;
      }
    }

    return closest;
  }

  hit(note) {
    note.judged = true;
    this.removeActive(note);
  }

  collectMisses(songTime, missWindow) {
    const missed = [];

    for (const note of [...this.activeNotes]) {
      if (!note.judged && songTime - note.time > missWindow) {
        note.judged = true;
        missed.push(note);
        this.removeActive(note);
      }
    }

    return missed;
  }

  isComplete() {
    return this.nextIndex >= this.notes.length && this.activeNotes.length === 0;
  }

  removeActive(note) {
    const index = this.activeNotes.indexOf(note);
    if (index >= 0) {
      this.activeNotes.splice(index, 1);
    }

    if (note.rendered) {
      this.noteRenderer.remove(note.rendered);
      note.rendered = null;
    }
  }
}
