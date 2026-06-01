import { builtInCharts } from '../data/chart-list.js';

const discoveredChartFiles = import.meta.glob('../charts/*/*.json', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const discoveredAssetFiles = import.meta.glob('../charts/**/*.{mp3,wav,ogg,m4a,aac,flac,mp4,webm,ogv}', {
  eager: true,
  import: 'default',
  query: '?url',
});

const discoveredCharts = discoverCharts(discoveredChartFiles);

export class ChartLoader {
  listBuiltInCharts() {
    return [...builtInCharts, ...discoveredCharts].map((entry) => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      chart: structuredClone(entry.chart),
    }));
  }

  async loadBuiltIn(id) {
    const entry = [...builtInCharts, ...discoveredCharts].find((chartEntry) => chartEntry.id === id);
    if (!entry) throw new Error(`Unknown chart: ${id}`);
    return structuredClone(entry.chart);
  }

  async loadFromFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const chart = normalizeImportedChart(parsed, file.name);
    validateChart(chart);
    return chart;
  }
}

function discoverCharts(files) {
  return Object.entries(files).flatMap(([path, raw]) => {
    try {
      const parsed = JSON.parse(raw);
      const chart = resolveChartAssetPaths(normalizeImportedChart(parsed, getFileName(path)), path);
      validateChart(chart);

      const directory = getDirectoryName(path);
      return {
        id: `directory:${directory}/${getFileName(path)}`,
        label: chart.songTitle,
        description: `src/charts/${directory} から検出した譜面JSONです。`,
        chart,
      };
    } catch {
      return [];
    }
  });
}

function resolveChartAssetPaths(chart, chartPath) {
  const baseDir = chartPath.slice(0, chartPath.lastIndexOf('/') + 1);

  return {
    ...chart,
    audioFile: resolveChartAssetPath(chart.audioFile, baseDir),
    bgaFile: resolveChartAssetPath(chart.bgaFile, baseDir),
  };
}

function resolveChartAssetPath(value, baseDir) {
  if (!value || isNonLocalAsset(value)) return value || '';

  const assetPath = normalizeAssetPath(`${baseDir}${value.replaceAll('\\', '/')}`);
  return discoveredAssetFiles[assetPath] ?? value;
}

function isNonLocalAsset(value) {
  return (
    value.startsWith('generated:') ||
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  );
}

function normalizeAssetPath(path) {
  const segments = [];

  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..' && segments.length > 0 && segments.at(-1) !== '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join('/');
}

function getDirectoryName(path) {
  const match = path.match(/\.\.\/charts\/([^/]+)\//);
  return match?.[1] ?? 'unknown';
}

function getFileName(path) {
  return path.split('/').at(-1) ?? 'chart.json';
}

function normalizeImportedChart(parsed, fallbackTitle) {
  return Array.isArray(parsed)
    ? {
        songTitle: fallbackTitle,
        artist: 'Imported Notes Array',
        audioFile: 'generated:demo-beat',
        bgaFile: '',
        offset: 0,
        scrollSpeed: 2.4,
        duration: getDefaultDuration(parsed),
        notes: parsed,
      }
    : normalizeChart(parsed, fallbackTitle);
}

function normalizeChart(chart, fallbackTitle) {
  return {
    songTitle: chart.songTitle || fallbackTitle,
    artist: chart.artist || 'Unknown Artist',
    audioFile: chart.audioFile || 'generated:demo-beat',
    bgaFile: chart.bgaFile || '',
    offset: Number.isFinite(chart.offset) ? chart.offset : 0,
    scrollSpeed: Number.isFinite(chart.scrollSpeed) ? chart.scrollSpeed : 2.4,
    duration: Number.isFinite(chart.duration) ? chart.duration : getDefaultDuration(chart.notes),
    notes: chart.notes,
  };
}

function getDefaultDuration(notes) {
  if (!Array.isArray(notes)) return 8;
  const lastNoteTime = notes.reduce((max, note) => Math.max(max, note.time ?? 0), 0);
  return Math.max(8, Math.round((lastNoteTime + 3) * 1000) / 1000);
}

function validateChart(chart) {
  if (!chart || typeof chart !== 'object') throw new Error('譜面JSONの形式が不正です。');
  if (!Array.isArray(chart.notes)) throw new Error('譜面JSONに notes 配列がありません。');

  for (const note of chart.notes) {
    if (!Number.isFinite(note.time)) throw new Error('notes[].time は数値である必要があります。');
    if (!Number.isInteger(note.lane) || note.lane < 0 || note.lane > 6) {
      throw new Error('notes[].lane は 0 から 6 の整数である必要があります。');
    }
    if (note.type !== 'normal' && note.type !== 'bonus') {
      throw new Error('notes[].type は normal または bonus である必要があります。');
    }
  }
}
