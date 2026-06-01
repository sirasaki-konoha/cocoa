# Chart Auto Discovery

Place demo chart JSON files under a subdirectory of this folder:

```text
src/charts/<pack-name>/<chart-name>.json
```

At startup, the app detects every `*.json` one directory below `src/charts`, parses it, validates the demo chart format, and adds valid charts to the selection screen.

Relative `audioFile` and `bgaFile` values are resolved from the chart JSON directory. For example, this works:

```text
src/charts/my-pack/song.json
src/charts/my-pack/song.mp3
```

```json
{
  "audioFile": "song.mp3"
}
```

BMSからMP3付き譜面を作る場合、MP3がBMSタイムライン先頭の無音を削っていることがあります。その場合は `--sync-audio` を指定して、BMS上の最初の発音時刻とMP3内の最初の有音位置から `offset` を自動設定してください。

```bash
npm run convert:bms -- input.bms src/charts/my-pack/song.json --audio song.mp3 --sync-audio src/charts/my-pack/song.mp3
```

この同期はノーツ時刻を書き換えず、譜面JSONの `offset` に補正値を入れます。

Accepted formats:

```json
{
  "songTitle": "Song Title",
  "artist": "Artist",
  "audioFile": "generated:demo-beat",
  "bgaFile": "",
  "offset": 0,
  "scrollSpeed": 2.4,
  "duration": 30,
  "notes": [
    { "time": 1.5, "lane": 0, "type": "normal" },
    { "time": 2.0, "lane": 3, "type": "bonus" }
  ]
}
```

An array of notes is also accepted. In that case, title and metadata are filled with defaults.
