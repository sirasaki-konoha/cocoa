const STORAGE_KEY = 'cocoa-audio-settings';
const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.8,
  sfx: 0.8,
};

export class AudioManager {
  constructor() {
    this.settings = loadSettings();
    this.homeBgm = new Audio('./audio/home-cafe-loop.mp3');
    this.homeBgm.loop = true;
    this.homeBgm.preload = 'auto';
    this.buttonSfx = new Audio('./audio/button-click.mp3');
    this.buttonSfx.preload = 'auto';
    this.escapeSfx = new Audio('./audio/escape-cancel.mp3');
    this.escapeSfx.preload = 'auto';
    this.wantsHomeBgm = false;
    this.applyVolumes();
    this.handleFirstGesture = this.handleFirstGesture.bind(this);
    window.addEventListener('pointerdown', this.handleFirstGesture, { passive: true });
    window.addEventListener('keydown', this.handleFirstGesture);
  }

  getSettings() {
    return { ...this.settings };
  }

  setSetting(key, value) {
    if (!(key in this.settings)) return;
    this.settings[key] = clamp01(value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.applyVolumes();
  }

  getMusicVolume() {
    return this.settings.master * this.settings.music;
  }

  getSfxVolume() {
    return this.settings.master * this.settings.sfx;
  }

  playHomeBgm() {
    this.wantsHomeBgm = true;
    this.homeBgm.volume = this.getMusicVolume() * 0.42;
    this.homeBgm.play().catch(() => {});
  }

  stopHomeBgm() {
    this.wantsHomeBgm = false;
    this.homeBgm.pause();
  }

  playButton() {
    this.playSfx(this.buttonSfx);
  }

  playEscape() {
    this.playSfx(this.escapeSfx);
  }

  bindButtonSounds() {
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('button')) return;
      this.playButton();
    }, true);
  }

  applyVolumes() {
    this.homeBgm.volume = this.getMusicVolume() * 0.42;
    this.buttonSfx.volume = this.getSfxVolume() * 0.75;
    this.escapeSfx.volume = this.getSfxVolume() * 0.9;

    if (this.wantsHomeBgm && this.homeBgm.paused) {
      this.homeBgm.play().catch(() => {});
    }
  }

  playSfx(audio) {
    const sound = audio.cloneNode();
    sound.volume = audio.volume;
    sound.play().catch(() => {});
  }

  handleFirstGesture() {
    if (this.wantsHomeBgm) {
      this.playHomeBgm();
    }
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      master: clamp01(saved?.master ?? DEFAULT_SETTINGS.master),
      music: clamp01(saved?.music ?? DEFAULT_SETTINGS.music),
      sfx: clamp01(saved?.sfx ?? DEFAULT_SETTINGS.sfx),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
