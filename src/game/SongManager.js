export class SongManager {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.volume = 0.72;
    this.volumeScale = 1;
    this.chartDuration = 0;
    this.offset = 0;
    this.objectUrl = null;
    this.isPreviewing = false;
    this.previewStart = 0;
    this.previewEnd = 0;
    this.fadeFrame = 0;
    this.fadeResolve = null;
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
  }

  async prepare(chart) {
    this.stop();
    this.offset = chart.offset ?? 0;
    this.chartDuration = chart.duration ?? 0;

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    if (chart.audioFile?.startsWith('generated:')) {
      const blob = createDemoSongBlob(this.chartDuration || 42, chart.notes);
      this.objectUrl = URL.createObjectURL(blob);
      this.audio.src = this.objectUrl;
    } else {
      this.audio.src = chart.audioFile;
    }

    this.audio.load?.();
    await waitForMetadata(this.audio);
    this.safeSetCurrentTime(0);
  }

  async start() {
    this.cancelFade();
    this.isPreviewing = false;
    this.audio.volume = 0.72 * this.volumeScale;
    this.safeSetCurrentTime(0);
    await this.audio.play();
  }

  stop() {
    this.cancelFade();
    this.isPreviewing = false;
    this.audio.pause();
    this.audio.volume = 0.72 * this.volumeScale;
    this.safeSetCurrentTime(0);
  }

  async playPreview() {
    const duration = this.getDuration();
    if (!duration || duration <= 1) return false;

    this.isPreviewing = true;
    this.previewStart = Math.max(0, Math.min(duration * 0.45, Math.max(0, duration - 12)));
    this.previewEnd = Math.min(duration - 0.5, this.previewStart + 18);
    this.cancelFade();
    this.audio.volume = 0;
    this.safeSetCurrentTime(this.previewStart);

    try {
      await this.audio.play();
      await this.fadeVolume(0.38 * this.volumeScale, 650);
      return true;
    } catch {
      this.isPreviewing = false;
      return false;
    }
  }

  stopPreview() {
    if (!this.isPreviewing) return;
    this.cancelFade();
    this.isPreviewing = false;
    this.audio.pause();
    this.audio.volume = 0.72 * this.volumeScale;
  }

  async fadeOutPreview(duration = 360) {
    if (!this.isPreviewing) return;

    await this.fadeVolume(0, duration);
    this.isPreviewing = false;
    this.audio.pause();
    this.audio.volume = 0.72 * this.volumeScale;
  }

  getTime() {
    return this.audio.currentTime + this.offset;
  }

  getRawTime() {
    return this.audio.currentTime;
  }

  getDuration() {
    return Number.isFinite(this.audio.duration) && this.audio.duration > 0
      ? this.audio.duration
      : this.chartDuration;
  }

  isEnded() {
    const duration = this.getDuration();
    return this.audio.ended || (duration > 0 && this.audio.currentTime >= duration - 0.02);
  }

  setOffset(offset) {
    this.offset = offset;
  }

  setVolumeScale(volumeScale) {
    this.volumeScale = Math.max(0, Math.min(1, Number(volumeScale) || 0));
    if (!this.isPreviewing) {
      this.audio.volume = 0.72 * this.volumeScale;
    }
  }

  handleTimeUpdate() {
    if (!this.isPreviewing || this.previewEnd <= this.previewStart) return;

    if (this.audio.currentTime >= this.previewEnd) {
      this.safeSetCurrentTime(this.previewStart);
    }
  }

  safeSetCurrentTime(time) {
    try {
      this.audio.currentTime = time;
    } catch {
      // Some browsers reject seeking before metadata is ready; the next prepare/play call will retry.
    }
  }

  fadeVolume(targetVolume, duration) {
    this.cancelFade();

    const startVolume = this.audio.volume;
    const startTime = performance.now();

    return new Promise((resolve) => {
      this.fadeResolve = resolve;
      const step = (now) => {
        const progress = duration <= 0 ? 1 : Math.min(1, (now - startTime) / duration);
        const eased = 1 - (1 - progress) * (1 - progress);
        this.audio.volume = startVolume + (targetVolume - startVolume) * eased;

        if (progress >= 1) {
          this.fadeFrame = 0;
          this.fadeResolve = null;
          resolve();
          return;
        }

        this.fadeFrame = window.requestAnimationFrame(step);
      };

      this.fadeFrame = window.requestAnimationFrame(step);
    });
  }

  cancelFade() {
    if (this.fadeFrame) {
      window.cancelAnimationFrame(this.fadeFrame);
      this.fadeFrame = 0;
    }

    if (this.fadeResolve) {
      this.fadeResolve();
      this.fadeResolve = null;
    }
  }
}

function waitForMetadata(audio) {
  if (audio.readyState >= 1) return Promise.resolve();

  return new Promise((resolve) => {
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', handleDone);
      audio.removeEventListener('canplay', handleDone);
      audio.removeEventListener('error', handleDone);
      window.clearTimeout(timeoutId);
    };
    const handleDone = () => {
      cleanup();
      resolve();
    };
    const timeoutId = window.setTimeout(handleDone, 1500);
    audio.addEventListener('loadedmetadata', handleDone, { once: true });
    audio.addEventListener('canplay', handleDone, { once: true });
    audio.addEventListener('error', handleDone, { once: true });
  });
}

function createDemoSongBlob(duration, notes) {
  const sampleRate = 44100;
  const sampleCount = Math.ceil(duration * sampleRate);
  const samples = new Float32Array(sampleCount);

  for (let beat = 0; beat < duration; beat += 0.6) {
    addTone(samples, sampleRate, beat, 0.12, 82, 0.55);
    addTone(samples, sampleRate, beat + 0.3, 0.04, 960, 0.18);
  }

  for (const note of notes) {
    addTone(samples, sampleRate, note.time, note.type === 'bonus' ? 0.12 : 0.055, 360 + note.lane * 55, note.type === 'bonus' ? 0.34 : 0.22);
  }

  const wavBytes = encodeWav(samples, sampleRate);
  return new Blob([wavBytes], { type: 'audio/wav' });
}

function addTone(samples, sampleRate, startTime, length, frequency, volume) {
  const start = Math.max(0, Math.floor(startTime * sampleRate));
  const end = Math.min(samples.length, start + Math.floor(length * sampleRate));

  for (let i = start; i < end; i += 1) {
    const t = (i - start) / sampleRate;
    const env = Math.exp(-t * 28);
    samples[i] += Math.sin(t * frequency * Math.PI * 2) * volume * env;
  }
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  let offset = 0;

  writeString(view, offset, 'RIFF');
  offset += 4;
  view.setUint32(offset, 36 + samples.length * bytesPerSample, true);
  offset += 4;
  writeString(view, offset, 'WAVE');
  offset += 4;
  writeString(view, offset, 'fmt ');
  offset += 4;
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString(view, offset, 'data');
  offset += 4;
  view.setUint32(offset, samples.length * bytesPerSample, true);
  offset += 4;

  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
