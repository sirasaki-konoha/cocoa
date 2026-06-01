import { BgaManager } from '../render/BgaManager.js';
import { LaneRenderer } from '../render/LaneRenderer.js';
import { NoteRenderer } from '../render/NoteRenderer.js';
import { Renderer } from '../render/Renderer.js';
import { UiRenderer } from '../render/UiRenderer.js';
import { ChartLoader } from './ChartLoader.js';
import { DEFAULT_SCROLL_SPEED } from './constants.js';
import { InputManager } from './InputManager.js';
import { JudgeManager } from './JudgeManager.js';
import { NoteManager } from './NoteManager.js';
import { ScoreManager } from './ScoreManager.js';
import { SongManager } from './SongManager.js';

export class Game {
  constructor(root) {
    this.renderer = new Renderer(root);
    this.uiRenderer = new UiRenderer();
    this.chartLoader = new ChartLoader();
    this.songManager = new SongManager();
    this.scoreManager = new ScoreManager();
    this.bgaManager = new BgaManager(this.renderer.scene);
    this.laneRenderer = new LaneRenderer(this.renderer.scene);
    this.noteRenderer = new NoteRenderer(this.renderer.scene);
    this.noteManager = new NoteManager(this.noteRenderer);
    this.judgeManager = new JudgeManager(
      this.noteManager,
      this.scoreManager,
      this.uiRenderer,
      this.laneRenderer,
      this.songManager,
    );
    this.inputManager = new InputManager((lane) => this.handleLanePress(lane));
    this.chart = null;
    this.chartEntries = [];
    this.selectedChartId = '';
    this.offset = 0;
    this.scrollSpeed = DEFAULT_SCROLL_SPEED;
    this.state = 'loading';
    this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
    this.lastFrameTime = performance.now();
    this.animationFrameId = 0;
  }

  async init() {
    this.chartEntries = this.chartLoader.listBuiltInCharts();
    this.selectedChartId = this.chartEntries[0].id;
    this.uiRenderer.renderChartList(this.chartEntries, this.selectedChartId);
    this.uiRenderer.bindHomeStart(() => this.showChartSelect());
    this.uiRenderer.bindBackHome(() => this.showHome());
    this.uiRenderer.bindSettings(() => this.uiRenderer.setChartMessage('設定は次の実装で追加予定です。'));
    this.uiRenderer.bindStart(() => this.start());
    this.uiRenderer.bindShowChartSelect(() => this.showChartSelect());
    this.uiRenderer.bindChartSelection((chartId) => this.selectBuiltInChart(chartId));
    this.uiRenderer.bindChartUpload((file) => this.selectUploadedChart(file));
    this.uiRenderer.bindOffset((offset) => {
      this.offset = offset;
      this.songManager.setOffset(offset);
    });
    this.uiRenderer.bindSpeed((speed) => {
      this.scrollSpeed = speed;
    });

    await this.applyChart(this.chartEntries[0].chart, this.selectedChartId);
    this.uiRenderer.setChartMessage('矢印キーで曲を選び、Playで開始します。');
    this.inputManager.start();
    window.addEventListener('keydown', this.handleGlobalKeyDown);
    this.laneRenderer.setVisible(false);
    this.showHome();
    this.loop();
  }

  async selectBuiltInChart(chartId, direction = 0) {
    if (this.state === 'starting' || this.state === 'playing') return;

    const entry = this.chartEntries.find((chartEntry) => chartEntry.id === chartId);
    if (!entry) return;

    if (this.state === 'ready') {
      await this.songManager.fadeOutPreview(240);
    }

    await this.applyChart(entry.chart, chartId, direction);
    await this.startSelectionPreview();
    this.uiRenderer.setChartMessage(`${entry.label} を選択しました。`);
  }

  async selectUploadedChart(file) {
    if (this.state === 'starting' || this.state === 'playing') return;

    try {
      const chart = await this.chartLoader.loadFromFile(file);
      const id = `upload:${file.name}:${Date.now()}`;
      const entry = {
        id,
        label: file.name,
        description: 'インポートした譜面JSONです。ページを再読み込みすると消えます。',
        chart,
      };
      this.chartEntries = [...this.chartEntries.filter((chartEntry) => !chartEntry.id.startsWith('upload:')), entry];
      await this.songManager.fadeOutPreview(240);
      await this.applyChart(chart, id);
      await this.startSelectionPreview();
      this.uiRenderer.setChartMessage(`${file.name} を読み込みました。`);
    } catch (error) {
      this.uiRenderer.setChartMessage(error.message || '譜面JSONを読み込めませんでした。', true);
    }
  }

  async applyChart(chart, chartId, direction = 0) {
    this.songManager.stop();
    this.bgaManager.stop();

    this.chart = structuredClone(chart);
    this.selectedChartId = chartId;
    this.offset = this.chart.offset ?? 0;
    this.scrollSpeed = this.chart.scrollSpeed ?? DEFAULT_SCROLL_SPEED;
    this.scoreManager.reset();
    this.noteManager.load(this.chart);
    this.bgaManager.prepare(this.chart);
    this.uiRenderer.setSong(this.chart);
    this.uiRenderer.renderChartList(this.chartEntries, this.selectedChartId, direction);
    this.uiRenderer.hideResult();
    await this.songManager.prepare(this.chart);
    this.songManager.setOffset(this.offset);
  }

  showHome() {
    if (this.state === 'playing' || this.state === 'starting') return;

    this.state = 'home';
    this.songManager.stopPreview();
    this.scoreManager.reset();
    this.noteManager.reset();
    this.uiRenderer.showHome();
    this.laneRenderer.setVisible(false);
  }

  showChartSelect() {
    if (this.state === 'playing' || this.state === 'starting') return;

    this.state = 'ready';
    this.scoreManager.reset();
    this.noteManager.reset();
    this.uiRenderer.showChartSelect();
    this.laneRenderer.setVisible(false);
    this.uiRenderer.setChartMessage('矢印キーで曲を選び、Playで開始します。');
    this.startSelectionPreview();
  }

  async startSelectionPreview() {
    if (this.state !== 'ready') return;

    const didPlay = await this.songManager.playPreview();
    if (!didPlay) {
      this.uiRenderer.setChartMessage('試聴を開始できませんでした。Playは可能です。', true);
    }
  }

  async selectRelativeChart(delta) {
    if (this.state !== 'ready' || this.chartEntries.length === 0) return;

    const currentIndex = Math.max(0, this.chartEntries.findIndex((entry) => entry.id === this.selectedChartId));
    const nextIndex = (currentIndex + delta + this.chartEntries.length) % this.chartEntries.length;
    await this.selectBuiltInChart(this.chartEntries[nextIndex].id, delta);
  }

  async start() {
    if (this.state === 'starting' || this.state === 'playing') return;

    this.state = 'starting';
    await this.songManager.fadeOutPreview(260);
    this.uiRenderer.hideStart();
    this.uiRenderer.hideResult();
    this.laneRenderer.setVisible(true);
    this.scoreManager.reset();
    this.noteManager.reset();
    await this.songManager.prepare(this.chart);
    this.songManager.setOffset(this.offset);
    this.bgaManager.prepare(this.chart);

    for (const value of ['3', '2', '1']) {
      this.uiRenderer.showCountdown(value);
      await wait(700);
    }

    this.uiRenderer.showCountdown('GO');
    await wait(360);
    this.uiRenderer.hideCountdown();

    try {
      await Promise.all([this.songManager.start(), this.bgaManager.start()]);
      this.state = 'playing';
    } catch (error) {
      this.state = 'ready';
      this.songManager.stop();
      this.bgaManager.stop();
      this.noteManager.reset();
      this.laneRenderer.setVisible(false);
      this.uiRenderer.showChartSelect();
      this.uiRenderer.setChartMessage(`音楽ファイルを再生できません: ${this.chart.audioFile}`, true);
    }
  }

  handleGlobalKeyDown(event) {
    if (this.state !== 'ready') return;

    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      this.selectRelativeChart(-1);
    }

    if (event.code === 'ArrowRight') {
      event.preventDefault();
      this.selectRelativeChart(1);
    }

    if (event.code === 'Enter') {
      event.preventDefault();
      this.start();
    }

    if (event.code === 'Escape') {
      event.preventDefault();
      this.showHome();
    }
  }

  handleLanePress(lane) {
    if (this.state !== 'playing') return;
    this.judgeManager.judgeLane(lane);
  }

  loop() {
    const now = performance.now();
    const deltaTime = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.bgaManager.update(deltaTime);
    this.laneRenderer.update(deltaTime);

    if (this.state === 'playing') {
      const songTime = this.songManager.getTime();
      const duration = this.songManager.getDuration();

      this.noteManager.update(songTime, this.scrollSpeed);
      this.judgeManager.checkMisses(songTime);
      this.uiRenderer.update(this.scoreManager, this.songManager.getRawTime(), duration);

      if (this.songManager.isEnded() || (songTime > duration + 0.5 && this.noteManager.isComplete())) {
        this.finish();
      }
    } else {
      this.uiRenderer.update(this.scoreManager, 0, this.songManager.getDuration());
    }

    this.renderer.render();
    this.animationFrameId = window.requestAnimationFrame(() => this.loop());
  }

  finish() {
    if (this.state !== 'playing') return;

    this.state = 'finished';
    this.songManager.stop();
    this.bgaManager.stop();
    this.noteManager.reset();
    this.laneRenderer.setVisible(false);
    this.uiRenderer.showResult(this.scoreManager, this.scoreManager.getRank(this.chart.notes.length));
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
