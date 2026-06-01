export class UiRenderer {
  constructor() {
    this.elements = {
      title: document.querySelector('#song-title'),
      score: document.querySelector('#score'),
      combo: document.querySelector('#combo'),
      judge: document.querySelector('#judge'),
      bonus: document.querySelector('#bonus-callout'),
      progress: document.querySelector('#progress'),
      homePanel: document.querySelector('#home-panel'),
      chartSelectPanel: document.querySelector('#chart-select-panel'),
      resultPanel: document.querySelector('#result-panel'),
      countdown: document.querySelector('#countdown'),
      homeClock: document.querySelector('#home-clock'),
      homeStartButton: document.querySelector('#home-start-button'),
      settingsButton: document.querySelector('#settings-button'),
      backHomeButton: document.querySelector('#back-home-button'),
      startButton: document.querySelector('#start-button'),
      retryButton: document.querySelector('#retry-button'),
      selectChartButton: document.querySelector('#select-chart-button'),
      chartList: document.querySelector('#chart-list'),
      chartFile: document.querySelector('#chart-file'),
      chartMessage: document.querySelector('#chart-message'),
      selectedChartTitle: document.querySelector('#selected-chart-title'),
      selectedChartMeta: document.querySelector('#selected-chart-meta'),
      selectedChartDescription: document.querySelector('#selected-chart-description'),
      chartCount: document.querySelector('#chart-count'),
      offset: document.querySelector('#offset'),
      offsetValue: document.querySelector('#offset-value'),
      speed: document.querySelector('#speed'),
      speedValue: document.querySelector('#speed-value'),
      rank: document.querySelector('#rank'),
      resultScore: document.querySelector('#result-score'),
      resultMaxCombo: document.querySelector('#result-max-combo'),
      resultPerfect: document.querySelector('#result-perfect'),
      resultGreat: document.querySelector('#result-great'),
      resultMiss: document.querySelector('#result-miss'),
      resultBonus: document.querySelector('#result-bonus'),
    };
    this.judgeTimer = 0;
    this.bonusTimer = 0;
    this.clockMinute = '';
  }

  setSong(chart) {
    this.elements.title.textContent = `${chart.songTitle} / ${chart.artist}`;
    this.elements.selectedChartTitle.textContent = `${chart.songTitle} / ${chart.artist}`;
    this.elements.offset.value = chart.offset ?? this.elements.offset.value;
    this.elements.speed.value = chart.scrollSpeed ?? this.elements.speed.value;
    this.elements.speedValue.textContent = Number(this.elements.speed.value).toFixed(1);
    this.updateOffsetLabel();
  }

  update(scoreManager, songTime, duration) {
    this.updateClock();
    this.elements.score.textContent = scoreManager.score.toLocaleString('ja-JP');
    this.elements.combo.textContent = String(scoreManager.combo);

    const progress = duration > 0 ? Math.min(100, Math.max(0, (songTime / duration) * 100)) : 0;
    this.elements.progress.style.width = `${progress}%`;

    if (this.judgeTimer > 0 && performance.now() > this.judgeTimer) {
      this.elements.judge.classList.remove('is-visible');
      this.judgeTimer = 0;
    }

    if (this.bonusTimer > 0 && performance.now() > this.bonusTimer) {
      this.elements.bonus.classList.remove('is-visible');
      this.bonusTimer = 0;
    }
  }

  showJudge(judge) {
    this.elements.judge.textContent = judge;
    this.elements.judge.classList.remove('is-visible');
    window.requestAnimationFrame(() => this.elements.judge.classList.add('is-visible'));
    this.judgeTimer = performance.now() + 420;
  }

  showBonus() {
    this.elements.bonus.classList.remove('is-visible');
    window.requestAnimationFrame(() => this.elements.bonus.classList.add('is-visible'));
    this.bonusTimer = performance.now() + 760;
  }

  showHome() {
    document.body.dataset.screen = 'home';
    this.elements.homePanel.hidden = false;
    this.elements.chartSelectPanel.hidden = true;
    this.elements.resultPanel.hidden = true;
  }

  showChartSelect() {
    document.body.dataset.screen = 'select';
    this.elements.homePanel.hidden = true;
    this.elements.chartSelectPanel.hidden = false;
    this.elements.resultPanel.hidden = true;
  }

  hideStart() {
    document.body.dataset.screen = 'play';
    this.elements.homePanel.hidden = true;
    this.elements.chartSelectPanel.hidden = true;
  }

  hideResult() {
    this.elements.resultPanel.hidden = true;
  }

  showCountdown(value) {
    this.elements.countdown.hidden = false;
    this.elements.countdown.textContent = value;
  }

  hideCountdown() {
    this.elements.countdown.hidden = true;
  }

  showResult(scoreManager, rank) {
    this.elements.rank.textContent = rank;
    this.elements.resultScore.textContent = scoreManager.score.toLocaleString('ja-JP');
    this.elements.resultMaxCombo.textContent = String(scoreManager.maxCombo);
    this.elements.resultPerfect.textContent = String(scoreManager.counts.PERFECT);
    this.elements.resultGreat.textContent = String(scoreManager.counts.GREAT);
    this.elements.resultMiss.textContent = String(scoreManager.counts.MISS);
    this.elements.resultBonus.textContent = String(scoreManager.counts.bonus);
    this.elements.resultPanel.hidden = false;
  }

  bindStart(handler) {
    this.elements.startButton.addEventListener('click', handler);
    this.elements.retryButton.addEventListener('click', handler);
  }

  bindHomeStart(handler) {
    this.elements.homeStartButton.addEventListener('click', handler);
  }

  bindBackHome(handler) {
    this.elements.backHomeButton.addEventListener('click', handler);
  }

  bindSettings(handler) {
    this.elements.settingsButton.addEventListener('click', handler);
  }

  bindShowChartSelect(handler) {
    this.elements.selectChartButton.addEventListener('click', handler);
  }

  renderChartList(entries, selectedId, direction = 0) {
    const selectedIndex = Math.max(0, entries.findIndex((entry) => entry.id === selectedId));
    const selected = entries[selectedIndex];

    this.elements.chartSelectPanel.dataset.direction = direction > 0 ? 'up' : direction < 0 ? 'down' : 'none';

    if (selected) {
      this.elements.selectedChartTitle.textContent = selected.chart.songTitle ?? selected.label;
      this.elements.selectedChartMeta.textContent = `${selected.chart.artist ?? 'Unknown'} / ${selected.chart.notes?.length ?? 0} notes / ${selected.chart.duration ?? '-'} sec`;
      this.elements.selectedChartDescription.textContent = selected.description ?? '';
      this.elements.chartCount.textContent = `${selectedIndex + 1} / ${entries.length}`;
    }

    this.elements.chartList.replaceChildren(
      ...getVisibleChartEntries(entries, selectedIndex).map(({ entry, offset }) => {
        if (!entry) {
          const spacer = document.createElement('div');
          spacer.className = 'chart-card-spacer';
          return spacer;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `chart-card chart-card-offset-${offset}${entry.id === selectedId ? ' is-selected' : ''}`;
        button.dataset.chartId = entry.id;
        button.innerHTML = `
          <p class="chart-card-title">${escapeHtml(entry.chart.songTitle ?? entry.label)}</p>
          <p class="chart-card-meta">${escapeHtml(entry.chart.artist ?? 'Unknown')} / ${entry.chart.notes?.length ?? 0} notes / ${entry.chart.duration ?? '-'} sec</p>
          <p class="chart-card-desc">${escapeHtml(entry.description ?? '')}</p>
        `;
        return button;
      }),
    );

    window.requestAnimationFrame(() => {
      this.elements.chartSelectPanel.dataset.direction = 'none';
    });
  }

  bindChartSelection(handler) {
    this.elements.chartList.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('.chart-card');
      if (!button) return;
      handler(button.dataset.chartId);
    });
  }

  bindChartUpload(handler) {
    this.elements.chartFile.addEventListener('change', () => {
      const file = this.elements.chartFile.files?.[0];
      if (!file) return;
      handler(file);
      this.elements.chartFile.value = '';
    });
  }

  setChartMessage(message, isError = false) {
    this.elements.chartMessage.textContent = message;
    this.elements.chartMessage.style.color = isError ? '#ffb3b3' : 'rgba(239, 216, 181, 0.68)';
  }

  bindOffset(handler) {
    this.elements.offset.addEventListener('input', () => {
      this.updateOffsetLabel();
      handler(Number(this.elements.offset.value));
    });
  }

  bindSpeed(handler) {
    this.elements.speed.addEventListener('input', () => {
      this.elements.speedValue.textContent = Number(this.elements.speed.value).toFixed(1);
      handler(Number(this.elements.speed.value));
    });
  }

  updateOffsetLabel() {
    this.elements.offsetValue.textContent = `${Math.round(Number(this.elements.offset.value) * 1000)}ms`;
  }

  updateClock() {
    const now = new Date();
    const minute = `${now.getHours()}:${now.getMinutes()}`;
    if (minute === this.clockMinute) return;

    this.clockMinute = minute;
    this.elements.homeClock.textContent = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getVisibleChartEntries(entries, selectedIndex) {
  if (entries.length === 0) return [];

  const usedIndexes = new Set();
  return [-2, -1, 0, 1, 2].map((offset) => {
    const index = (selectedIndex + offset + entries.length) % entries.length;
    if (usedIndexes.has(index)) return { entry: null, offset };

    usedIndexes.add(index);
    return { entry: entries[index], offset };
  });
}
