#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_SCROLL_SPEED = 2.4;
const DEFAULT_AUDIO = 'generated:demo-beat';

const VISIBLE_7KEY_CHANNELS = new Map([
  ['11', 0],
  ['12', 1],
  ['13', 2],
  ['14', 3],
  ['15', 4],
  ['18', 5],
  ['19', 6],
]);

const LONG_7KEY_CHANNELS = new Map([
  ['51', 0],
  ['52', 1],
  ['53', 2],
  ['54', 3],
  ['55', 4],
  ['58', 5],
  ['59', 6],
]);

function parseArgs(argv) {
  const options = {
    input: '',
    output: '',
    notesOnly: false,
    includeLong: true,
    trimLeadingEmpty: false,
    bonusEvery: 0,
    offset: 0,
    scrollSpeed: DEFAULT_SCROLL_SPEED,
    audioFile: DEFAULT_AUDIO,
    bgaFile: '',
    syncAudioPath: '',
    silenceThreshold: '-45dB',
  };

  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--notes-only') {
      options.notesOnly = true;
      continue;
    }

    if (arg === '--no-long') {
      options.includeLong = false;
      continue;
    }

    if (arg === '--trim-leading-empty') {
      options.trimLeadingEmpty = true;
      continue;
    }

    if (arg === '--keep-leading-empty') {
      options.trimLeadingEmpty = false;
      continue;
    }

    if (arg === '--bonus-every') {
      options.bonusEvery = readNumberOption(argv, (i += 1), arg, { integer: true, min: 0 });
      continue;
    }

    if (arg === '--offset') {
      options.offset = readNumberOption(argv, (i += 1), arg);
      continue;
    }

    if (arg === '--scroll-speed') {
      options.scrollSpeed = readNumberOption(argv, (i += 1), arg, { min: 0.1 });
      continue;
    }

    if (arg === '--audio') {
      options.audioFile = readStringOption(argv, (i += 1), arg);
      continue;
    }

    if (arg === '--sync-audio') {
      options.syncAudioPath = readStringOption(argv, (i += 1), arg);
      continue;
    }

    if (arg === '--silence-threshold') {
      options.silenceThreshold = readStringOption(argv, (i += 1), arg);
      continue;
    }

    if (arg === '--bga') {
      options.bgaFile = readStringOption(argv, (i += 1), arg);
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  options.input = positional[0] ?? '';
  options.output = positional[1] ?? '';

  if (!options.input) {
    throw new Error('Input .bms file is required. Use --help for usage.');
  }

  return options;
}

function readNumberOption(argv, index, flag, rules = {}) {
  const value = Number(argv[index]);

  if (!Number.isFinite(value)) {
    throw new Error(`${flag} requires a number.`);
  }

  if (rules.integer && !Number.isInteger(value)) {
    throw new Error(`${flag} requires an integer.`);
  }

  if (rules.min !== undefined && value < rules.min) {
    throw new Error(`${flag} must be ${rules.min} or greater.`);
  }

  return value;
}

function readStringOption(argv, index, flag) {
  const value = argv[index];
  if (!value) throw new Error(`${flag} requires a value.`);
  return value;
}

function printHelp() {
  console.log(`Usage:
  node tools/bms-to-demo-chart.mjs input.bms [output.json] [options]

Options:
  --notes-only              Output only the notes array instead of a full demo chart.
  --bonus-every <n>         Mark every nth converted note as type "bonus". 0 disables it.
  --no-long                 Ignore BMS long-note channels 51/52/53/54/55/58/59.
  --trim-leading-empty      Trim empty BMS lead-in before the first BGM event.
  --keep-leading-empty      Keep the original BMS timeline from measure 000. Enabled by default.
  --offset <seconds>        Set output chart offset. Default: 0.
  --scroll-speed <number>   Set output chart scrollSpeed. Default: ${DEFAULT_SCROLL_SPEED}.
  --audio <path>            Set output chart audioFile. Default: ${DEFAULT_AUDIO}.
  --sync-audio <path>       Detect MP3/WAV leading silence with ffmpeg and set chart offset.
  --silence-threshold <dB>  Threshold for --sync-audio. Default: -45dB.
  --bga <path>              Set output chart bgaFile. Default: empty.

Mapped BMS channels:
  11 12 13 14 15 18 19 -> lanes 0 1 2 3 4 5 6
  51 52 53 54 55 58 59 -> lanes 0 1 2 3 4 5 6, as tap notes by default
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const text = await readBmsText(options.input);
  const parsed = parseBms(text, options);
  if (options.syncAudioPath) {
    const audioFirstSoundTime = detectFirstSoundTime(options.syncAudioPath, options.silenceThreshold);
    parsed.audioSyncOffset = roundTime(parsed.firstSoundTime - audioFirstSoundTime);
    console.error(
      `Audio sync: first BMS sound=${roundTime(parsed.firstSoundTime)}s, first audio sound=${roundTime(audioFirstSoundTime)}s, offset+=${parsed.audioSyncOffset}s`,
    );
  }
  const chart = buildDemoChart(parsed, options);
  const output = options.notesOnly ? chart.notes : chart;
  const json = `${JSON.stringify(output, null, 2)}\n`;

  if (options.output) {
    await writeFile(options.output, json, 'utf8');
    console.log(`Converted ${chart.notes.length} notes -> ${options.output}`);
  } else {
    process.stdout.write(json);
  }
}

async function readBmsText(filePath) {
  const buffer = await readFile(filePath);
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function parseBms(text, options) {
  const headers = {
    title: '',
    artist: '',
    bpm: 130,
    lnObj: '',
  };
  const bpmDefinitions = new Map();
  const stopDefinitions = new Map();
  const measureLengthRatios = new Map();
  const rawNotes = [];
  const rawAudioEvents = [];
  const timingEvents = [];
  const ignoredChannels = new Map();

  for (const originalLine of text.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line || !line.startsWith('#')) continue;

    const dataMatch = line.match(/^#(\d{3})([0-9A-Z]{2}):(.+)$/i);
    if (dataMatch) {
      const measure = Number(dataMatch[1]);
      const channel = dataMatch[2].toUpperCase();
      const data = dataMatch[3].trim();

      if (channel === '02') {
        const ratio = Number(data);
        if (Number.isFinite(ratio) && ratio > 0) {
          measureLengthRatios.set(measure, ratio);
        }
        continue;
      }

      if (channel === '03') {
        timingEvents.push(...parseObjectData(data, measure, channel, (token, objectIndex, objectCount) => ({
          type: 'bpm',
          measure,
          objectIndex,
          objectCount,
          bpm: parseInt(token, 16),
        })).filter((event) => Number.isFinite(event.bpm) && event.bpm > 0));
        continue;
      }

      if (channel === '08') {
        timingEvents.push(...parseObjectData(data, measure, channel, (token, objectIndex, objectCount) => ({
          type: 'bpm-ref',
          measure,
          objectIndex,
          objectCount,
          id: token.toUpperCase(),
        })));
        continue;
      }

      if (channel === '09') {
        timingEvents.push(...parseObjectData(data, measure, channel, (token, objectIndex, objectCount) => ({
          type: 'stop-ref',
          measure,
          objectIndex,
          objectCount,
          id: token.toUpperCase(),
        })));
        continue;
      }

      if (channel === '01') {
        rawAudioEvents.push(...parseObjectData(data, measure, channel, (token, objectIndex, objectCount) => ({
          type: 'audio',
          measure,
          objectIndex,
          objectCount,
          objectId: token.toUpperCase(),
        })));
        continue;
      }

      const lane = getLaneForChannel(channel, options.includeLong);
      if (lane !== null) {
        rawNotes.push(...parseObjectData(data, measure, channel, (token, objectIndex, objectCount) => ({
          type: 'note',
          measure,
          objectIndex,
          objectCount,
          lane,
          objectId: token.toUpperCase(),
        })));
      } else {
        ignoredChannels.set(channel, (ignoredChannels.get(channel) ?? 0) + 1);
      }

      continue;
    }

    const commandMatch = line.match(/^#([A-Z]+)([0-9A-Z]{0,2})\s*(.*)$/i);
    if (!commandMatch) continue;

    const command = commandMatch[1].toUpperCase();
    const suffix = commandMatch[2].toUpperCase();
    const value = commandMatch[3].trim();

    if (command === 'TITLE') headers.title = value;
    if (command === 'ARTIST') headers.artist = value;
    if (command === 'BPM' && !suffix) {
      const bpm = Number(value);
      if (Number.isFinite(bpm) && bpm > 0) headers.bpm = bpm;
    }
    if (command === 'BPM' && suffix) {
      const bpm = Number(value);
      if (Number.isFinite(bpm) && bpm > 0) bpmDefinitions.set(suffix, bpm);
    }
    if (command === 'STOP' && suffix) {
      const stop = Number(value);
      if (Number.isFinite(stop) && stop > 0) stopDefinitions.set(suffix, stop);
    }
    if (command === 'LNOBJ') headers.lnObj = value.toUpperCase();
  }

  const measureStarts = buildMeasureStarts([...rawNotes, ...rawAudioEvents], timingEvents, measureLengthRatios);
  const playableRawNotes = headers.lnObj ? rawNotes.filter((note) => note.objectId !== headers.lnObj) : rawNotes;
  const notes = playableRawNotes.map((note) => ({ ...note, beat: getBeat(note, measureStarts, measureLengthRatios) }));
  const audioEvents = rawAudioEvents.map((event) => ({ ...event, beat: getBeat(event, measureStarts, measureLengthRatios) }));
  const resolvedTimingEvents = timingEvents
    .map((event) => resolveTimingEvent(event, measureStarts, measureLengthRatios, bpmDefinitions, stopDefinitions))
    .filter(Boolean);
  const timedObjects = calculateTimedObjects([...notes, ...audioEvents], resolvedTimingEvents, headers.bpm);
  const leadInTime = options.trimLeadingEmpty ? getLeadingEmptyTime(timedObjects) : 0;
  const firstSoundTime = getFirstSoundTime(timedObjects);

  return {
    headers,
    notes: buildTimedNotes(timedObjects, options.bonusEvery, leadInTime),
    ignoredChannels,
    leadInTime,
    firstSoundTime: Number.isFinite(firstSoundTime) ? firstSoundTime - leadInTime : 0,
    audioSyncOffset: 0,
  };
}

function parseObjectData(data, measure, channel, createEvent) {
  const compact = data.replace(/\s+/g, '');
  if (compact.length < 2 || compact.length % 2 !== 0) return [];

  const objectCount = compact.length / 2;
  const events = [];

  for (let objectIndex = 0; objectIndex < objectCount; objectIndex += 1) {
    const token = compact.slice(objectIndex * 2, objectIndex * 2 + 2);
    if (token === '00') continue;
    events.push(createEvent(token, objectIndex, objectCount, measure, channel));
  }

  return events;
}

function getLaneForChannel(channel, includeLong) {
  if (VISIBLE_7KEY_CHANNELS.has(channel)) return VISIBLE_7KEY_CHANNELS.get(channel);
  if (includeLong && LONG_7KEY_CHANNELS.has(channel)) return LONG_7KEY_CHANNELS.get(channel);
  return null;
}

function buildMeasureStarts(rawNotes, timingEvents, measureLengthRatios) {
  const maxMeasure = Math.max(
    0,
    ...rawNotes.map((note) => note.measure),
    ...timingEvents.map((event) => event.measure),
    ...measureLengthRatios.keys(),
  );
  const starts = new Array(maxMeasure + 2).fill(0);

  for (let measure = 1; measure < starts.length; measure += 1) {
    const previousRatio = measureLengthRatios.get(measure - 1) ?? 1;
    starts[measure] = starts[measure - 1] + previousRatio * 4;
  }

  return starts;
}

function getBeat(event, measureStarts, measureLengthRatios) {
  const ratio = measureLengthRatios.get(event.measure) ?? 1;
  return measureStarts[event.measure] + (event.objectIndex / event.objectCount) * ratio * 4;
}

function resolveTimingEvent(event, measureStarts, measureLengthRatios, bpmDefinitions, stopDefinitions) {
  const beat = getBeat(event, measureStarts, measureLengthRatios);

  if (event.type === 'bpm') {
    return { type: 'bpm', beat, bpm: event.bpm };
  }

  if (event.type === 'bpm-ref') {
    const bpm = bpmDefinitions.get(event.id);
    return bpm ? { type: 'bpm', beat, bpm } : null;
  }

  if (event.type === 'stop-ref') {
    const units = stopDefinitions.get(event.id);
    return units ? { type: 'stop', beat, units } : null;
  }

  return null;
}

function calculateTimedObjects(objects, timingEvents, initialBpm) {
  const events = [
    ...timingEvents.map((event) => ({ ...event, order: event.type === 'bpm' ? 1 : 2 })),
    ...objects.map((object, index) => ({ ...object, type: 'object', sourceType: object.type, sourceIndex: index, order: 0 })),
  ].sort((a, b) => a.beat - b.beat || a.order - b.order);

  const timedObjects = [];
  let currentBeat = 0;
  let currentTime = 0;
  let bpm = initialBpm;

  for (const event of events) {
    const beatDelta = Math.max(0, event.beat - currentBeat);
    currentTime += (beatDelta * 60) / bpm;
    currentBeat = event.beat;

    if (event.type === 'object') {
      timedObjects.push({ ...event, type: event.sourceType, time: currentTime });
      continue;
    }

    if (event.type === 'bpm') {
      bpm = event.bpm;
      continue;
    }

    if (event.type === 'stop') {
      currentTime += (event.units / 192) * (60 / bpm);
    }
  }

  return timedObjects.sort((a, b) => a.time - b.time || (a.lane ?? 0) - (b.lane ?? 0));
}

function getLeadingEmptyTime(timedObjects) {
  const firstNoteTime = getFirstTime(timedObjects, 'note');
  const firstAudioTime = getFirstTime(timedObjects, 'audio');

  if (!Number.isFinite(firstAudioTime) || firstAudioTime <= 0) return 0;
  if (!Number.isFinite(firstNoteTime)) return firstAudioTime;

  return firstAudioTime <= firstNoteTime + 0.001 ? firstAudioTime : 0;
}

function getFirstTime(timedObjects, type) {
  return timedObjects.reduce(
    (firstTime, object) => (object.type === type ? Math.min(firstTime, object.time) : firstTime),
    Infinity,
  );
}

function getFirstSoundTime(timedObjects) {
  return timedObjects.reduce(
    (firstTime, object) => (object.type === 'note' || object.type === 'audio' ? Math.min(firstTime, object.time) : firstTime),
    Infinity,
  );
}

function buildTimedNotes(timedObjects, bonusEvery, trimTime) {
  const timedNotes = [];

  for (const object of timedObjects) {
    if (object.type !== 'note') continue;

    const noteNumber = timedNotes.length + 1;
    timedNotes.push({
      time: roundTime(Math.max(0, object.time - trimTime)),
      lane: object.lane,
      type: bonusEvery > 0 && noteNumber % bonusEvery === 0 ? 'bonus' : 'normal',
    });
  }

  return timedNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);
}

function roundTime(time) {
  return Math.round(time * 1000) / 1000;
}

function buildDemoChart(parsed, options) {
  const notes = parsed.notes;
  const lastNoteTime = notes.at(-1)?.time ?? 0;

  return {
    songTitle: parsed.headers.title || basename(options.input),
    artist: parsed.headers.artist || 'BMS Converted Pattern',
    audioFile: options.audioFile,
    bgaFile: options.bgaFile,
    offset: roundTime(options.offset + parsed.audioSyncOffset),
    scrollSpeed: options.scrollSpeed,
    duration: Math.max(8, roundTime(lastNoteTime + 3)),
    notes,
  };
}

function detectFirstSoundTime(audioPath, silenceThreshold) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    audioPath,
    '-af',
    `silencedetect=noise=${silenceThreshold}:d=0.05`,
    '-f',
    'null',
    '-',
  ], {
    encoding: 'utf8',
  });

  if (result.error) {
    throw new Error(`ffmpeg を実行できません: ${result.error.message}`);
  }

  const output = `${result.stderr}\n${result.stdout}`;
  const match = output.match(/silence_start:\s*0(?:\.0+)?[\s\S]*?silence_end:\s*([0-9.]+)/);
  if (!match) return 0;

  const firstSoundTime = Number(match[1]);
  if (!Number.isFinite(firstSoundTime)) return 0;
  return firstSoundTime;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
