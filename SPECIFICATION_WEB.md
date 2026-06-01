# Web版プロトタイプ設計順

## 0. まず作る範囲を決める

最初のWebプロトタイプでは、完成形をここまでに絞る。

```text
1曲だけ遊べる
7レーンが表示される
A W E F J I Oで叩ける
ノーツが曲時間に合わせて流れる
PERFECT / GREAT / MISS判定が出る
スコアとコンボが増える
水色ノーツでスコア×1.2
BGA動画がぼかし背景として流れる
```

曲選択、譜面エディタ、設定画面、ランキングは後回し。

---

# 1. プロジェクト構成を決める

最初はViteを使うと楽。構成はこんな感じ。

```text
rhythm-game/
├─ index.html
├─ package.json
├─ src/
│  ├─ main.js
│  ├─ game/
│  │  ├─ Game.js
│  │  ├─ SongManager.js
│  │  ├─ ChartLoader.js
│  │  ├─ NoteManager.js
│  │  ├─ InputManager.js
│  │  ├─ JudgeManager.js
│  │  ├─ ScoreManager.js
│  │  └─ BgaManager.js
│  ├─ render/
│  │  ├─ Renderer.js
│  │  ├─ LaneRenderer.js
│  │  ├─ NoteRenderer.js
│  │  └─ UiRenderer.js
│  └─ data/
│     └─ sample-chart.json
├─ public/
│  ├─ audio/
│  │  └─ sample.mp3
│  └─ video/
│     └─ sample-bga.mp4
```

最初から分けすぎても面倒だけど、音ゲーはあとで機能が増えるので、**音楽管理・判定・描画・入力** は早めに分けた方が楽。

---

# 2. Three.jsの基本描画を作る

最初に作るのはゲームではなく、表示土台。

作るもの：

```text
Scene
Camera
Renderer
Animation loop
```

画面は2D音ゲーっぽく作るので、カメラは **OrthographicCamera** が向いている。
3D空間だけど、見た目は2Dとして扱う。

この段階の目標：

```text
ブラウザに黒背景が出る
Three.jsの描画ループが動いている
ウィンドウリサイズに対応している
```

---

# 3. 座標設計を決める

ここがけっこう大事。

おすすめは、ゲーム内座標をこう決める。

```text
画面中央X = 0
判定ラインY = -3.2
ノーツ出現Y = 4.0
レーン幅 = 0.7
レーン数 = 7
```

レーンX座標はこういうイメージ。

```text
laneX = (laneIndex - 3) * laneWidth
```

つまり：

| lane | キー | X位置イメージ |
| ---: | -- | ------: |
|    0 | A  |    -2.1 |
|    1 | W  |    -1.4 |
|    2 | E  |    -0.7 |
|    3 | F  |       0 |
|    4 | J  |     0.7 |
|    5 | I  |     1.4 |
|    6 | O  |     2.1 |

この方式にしておくと、画面中央にきれいに7レーンが並ぶ。

---

# 4. レーン表示を作る

次に7レーンを描画する。

作るもの：

```text
7本の縦長Plane
判定ライン
キー名表示
レーン押下時の光り演出
```

通常レーン色は、あなたの仕様通り。

| キー | レーン色 |
| -- | ---- |
| A  | 白    |
| W  | 緑    |
| E  | 白    |
| F  | 緑    |
| J  | 白    |
| I  | 緑    |
| O  | 白    |

ただし、真っ白・真緑だと眩しいので、プロトタイプでは少し暗めにした方が見やすい。

```text
白レーン：薄いグレー
緑レーン：暗めの緑
判定ライン：明るめ
```

---

# 5. 入力管理を作る

次にキー入力だけを作る。

対応キー：

```text
A W E F J I O
```

キーとレーンの対応：

```js
const keyToLane = {
  KeyA: 0,
  KeyW: 1,
  KeyE: 2,
  KeyF: 3,
  KeyJ: 4,
  KeyI: 5,
  KeyO: 6,
};
```

この段階ではノーツ判定はまだしない。

目標はこれ。

```text
Aを押したら一番左のレーンが光る
Wを押したら2番目のレーンが光る
...
Oを押したら一番右のレーンが光る
```

入力が先に完成していると、その後の判定実装がかなり楽。

---

# 6. 音楽再生管理を作る

次に `SongManager` を作る。

役割：

```text
audioを読み込む
再生する
停止する
現在の曲時間を返す
曲が終わったか判定する
offsetを反映する
```

基本はこういう考え方。

```js
const songTime = audio.currentTime + offset;
```

`audio.currentTime` は現在の再生時間を秒単位で扱えるので、ノーツの表示位置や判定の基準にする。([MDNウェブドキュメント][1])

重要なのは、**Date.now()やperformance.now()を判定の基準にしないこと**。
音ゲーでは「いま曲の何秒地点か」が絶対基準。

---

# 7. 譜面データ形式を決める

Web版でもJSONでいい。

```json
{
  "songTitle": "Sample Song",
  "artist": "Sample Artist",
  "audioFile": "/audio/sample.mp3",
  "bgaFile": "/video/sample-bga.mp4",
  "offset": 0.0,
  "scrollSpeed": 1.0,
  "notes": [
    { "time": 1.25, "lane": 0, "type": "normal" },
    { "time": 1.50, "lane": 1, "type": "normal" },
    { "time": 2.00, "lane": 3, "type": "bonus" }
  ]
}
```

ノーツの `type` はまず2種類。

| type   | 内容    |
| ------ | ----- |
| normal | 通常ノーツ |
| bonus  | 水色ノーツ |

水色ノーツは `bonus`。
叩いたら現在スコアを1.2倍。

---

# 8. ノーツ生成を作る

ここで初めてノーツを出す。

ただし、最初から全ノーツを画面に出す必要はない。

おすすめは：

```text
現在時刻から見て、数秒以内に来るノーツだけ生成する
```

例：

```js
spawnAheadTime = 3.0;
```

現在の曲時間が10秒なら、13秒までのノーツを生成する。

```text
10.0秒〜13.0秒に叩くノーツだけ画面に出す
```

これで無駄なオブジェクトが増えにくい。

---

# 9. ノーツ位置計算を作る

ノーツは毎フレーム「下に移動させる」のではなく、**曲時間から位置を計算する**。

```text
残り時間 = ノーツ時刻 - 現在の曲時間
Y座標 = 判定ラインY + 残り時間 × スクロール速度
```

例：

```js
const remain = note.time - songTime;
note.mesh.position.y = judgeLineY + remain * scrollSpeed;
```

この方式が音ゲー向き。
フレーム落ちしても、次のフレームで正しい位置に戻る。

---

# 10. 描画ループを作る

描画ループは `requestAnimationFrame()` で回す。これはブラウザにアニメーション更新を依頼し、次の再描画前にコールバックを呼ぶ仕組み。([MDNウェブドキュメント][2])

ループでやること：

```text
曲時間を取得
ノーツを必要分だけ生成
全ノーツの位置を更新
MISS判定を処理
UIを更新
Three.jsでrender
次のrequestAnimationFrameを呼ぶ
```

流れはこう。

```js
function loop() {
  const songTime = songManager.getTime();

  noteManager.spawnNotes(songTime);
  noteManager.updateNotes(songTime);
  judgeManager.checkMiss(songTime);
  uiRenderer.update();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
```

---

# 11. 判定処理を作る

キーを押した瞬間に、そのレーンの未処理ノーツから一番近いものを探す。

```text
timeDiff = 入力時の曲時間 - ノーツ時刻
```

判定幅はプロトタイプならこれでOK。

| 判定      |     範囲 |
| ------- | -----: |
| PERFECT |  ±50ms |
| GREAT   | ±100ms |
| MISS    |   それ以外 |

JavaScript上では秒で扱うので：

```js
const PERFECT = 0.05;
const GREAT = 0.10;
const MISS_LIMIT = 0.15;
```

判定ロジック：

```text
abs(timeDiff) <= 0.05 → PERFECT
abs(timeDiff) <= 0.10 → GREAT
abs(timeDiff) <= 0.15 → GOODまたはGREAT扱い
それ以外 → 空打ち
```

プロトタイプではGOODなしでいい。
本実装でGOODを足せばOK。

---

# 12. MISS処理を作る

ノーツを押さなかった場合、判定ラインを通り過ぎたあとにMISSにする。

```js
if (songTime - note.time > missWindow) {
  miss(note);
}
```

例：

```js
const missWindow = 0.15;
```

つまり、ノーツ時刻から0.15秒以上過ぎたらMISS。

---

# 13. スコア・コンボ管理を作る

`ScoreManager` を作って、判定ごとに処理する。

```text
PERFECT → +1000、combo +1
GREAT → +700、combo +1
MISS → +0、combo 0
bonus成功 → score = round(score × 1.2)
```

水色ノーツはこう。

```js
if (note.type === "bonus") {
  score = Math.round(score * 1.2);
} else {
  score += judgeScore;
}
```

ただし、個人的には水色ノーツも最低限の判定スコアを入れたあとに1.2倍した方が気持ちいい。

```js
score += judgeScore;
score = Math.round(score * 1.2);
```

このへんはゲームバランスで決めてOK。

---

# 14. UIをHTMLで作るかThree.jsで作るか決める

Web版なら、UIは最初 **HTML/CSS** で作るのがおすすめ。

Three.jsで全部作るより早い。

HTMLで作るもの：

```text
スコア
コンボ
判定文字
曲名
スタートボタン
リザルト画面
```

Three.jsで作るもの：

```text
レーン
ノーツ
判定ライン
BGA背景
ヒットエフェクト
```

この分担が楽。

---

# 15. BGA背景を作る

背景動画は Three.js の `VideoTexture` を使うと、動画をテクスチャとして扱える。Three.js公式ドキュメントでも `VideoTexture` は動画用のテクスチャとして説明されている。([Three.js][3])

構成：

```text
HTMLVideoElementを作る
THREE.VideoTextureに渡す
大きなPlaneに貼る
画面奥に配置する
暗い半透明レイヤーを上に重ねる
```

ぼかしは最初はCSSやポストプロセスで頑張らず、まずはこれで十分。

```text
BGAを暗くする
透明な黒パネルを重ねる
レーン背景を濃くする
```

本当にぼかしたい場合は、後からポストプロセスを入れる。
プロトタイプでは「暗くする」だけでかなり見やすい。

---

# 16. スタート画面を作る

ブラウザでは音声や動画の自動再生に制限があるので、プレイヤーのクリックやキー入力をきっかけに開始するのが安全。

流れ：

```text
STARTボタン表示
クリックされたらaudioとvideoを準備
3、2、1のカウントダウン
audio.play()
video.play()
ゲーム開始
```

音ゲー的にも、いきなり始まるよりカウントダウンがあった方がいい。

---

# 17. 曲終了とリザルト画面

`audio.ended` か、曲時間がdurationを超えたら終了。

表示するもの：

```text
最終スコア
最大コンボ
PERFECT数
GREAT数
MISS数
水色ノーツ成功数
ランク
リトライボタン
```

プロトタイプではランクは雑でOK。

```text
S / A / B / C / D
```

---

# 18. 最後に調整項目を足す

プロトタイプ完成後、最低限ほしい設定。

```text
オフセット調整
ノーツ速度
BGA明るさ
判定幅
音量
```

特に重要なのはこの2つ。

```text
offset
scrollSpeed
```

この2つだけでも遊びやすさがかなり変わる。

---

# おすすめ実装順まとめ

実際に作る順番はこれ。

```text
1. Vite + Three.js環境を作る
2. Three.jsのScene / Camera / Rendererを作る
3. 7レーンと判定ラインを表示する
4. A W E F J I Oのキー入力を取る
5. 押したレーンを光らせる
6. audioを読み込んで再生できるようにする
7. audio.currentTimeを取得するSongManagerを作る
8. 仮のノーツ1個を曲時間ベースで表示する
9. ノーツ位置を「曲時間から逆算」する方式にする
10. 譜面JSONを読み込む
11. 譜面に沿って複数ノーツを生成する
12. キー入力時の判定処理を作る
13. MISS処理を作る
14. スコアとコンボを作る
15. 水色ノーツを作る
16. BGA動画をVideoTextureで背景に貼る
17. UIをHTML/CSSで整える
18. 曲終了後のリザルト画面を作る
19. offsetとscrollSpeedを調整できるようにする
20. 見た目とエフェクトを足す
```

# クラス設計案

Web版ならこんな役割分担。

| 名前             | 役割                   |
| -------------- | -------------------- |
| `Game`         | 全体進行、開始、終了、更新ループ     |
| `SongManager`  | 音楽再生、曲時間取得、offset管理  |
| `ChartLoader`  | JSON譜面読み込み           |
| `InputManager` | キー入力取得               |
| `NoteManager`  | ノーツ生成、更新、削除          |
| `JudgeManager` | PERFECT/GREAT/MISS判定 |
| `ScoreManager` | スコア、コンボ、判定数          |
| `LaneRenderer` | レーン表示、押下演出           |
| `NoteRenderer` | ノーツ見た目生成             |
| `BgaManager`   | 背景動画表示               |
| `UiRenderer`   | HTML UI更新            |

# 一番大事な設計ルール

このゲームは、全部これを基準にする。

```text
現在の曲時間 = audio.currentTime + offset
```

ノーツの位置も、判定も、MISSも、曲終了も、全部これ基準。

逆に、これをやるとズレやすい。

```text
setIntervalでノーツを落とす
deltaTimeだけでノーツを移動する
Date.now()で判定する
ノーツの見た目位置だけで判定する
```

音ゲーは「見た目」よりも「曲時間」が王様。
Three.jsはかっこいいレーンとノーツを描く係、JavaScriptのゲームロジックは曲時間をもとに正確に判定する係、という分け方が一番安定する。

