# 日本語テキスト多角分析ツール 技術仕様書・メンテナンスガイド

本書は、本ツールの将来的なメンテナンス、バグ修正、機能拡張を行うための技術的な仕様とアーキテクチャをまとめたドキュメントです。

---

## 1. システム・アーキテクチャ概要

本ツールは**完全なクライアントサイド（ブラウザ完結型）**のアーキテクチャを採用しています。サーバーサイドの処理（PythonやNode.js等）を一切必要とせず、静的ファイルの配信のみで動作します。

* **コア技術**: Vanilla JavaScript (ES6), HTML5 Canvas, CSS3
* **外部ライブラリ**:
  * `kuromoji.js`: 日本語の形態素解析エンジン。`lib/kuromoji/` 内の辞書データ（.dat.gz）をロードして使用。
  * `wordcloud2.js`: ワードクラウドの描画エンジン。

---

## 2. ディレクトリ構成とシステム運用上の必須ファイル

本システムを運用・配布する際、**必須となるディレクトリ・ファイル**と、**開発・テスト用の非必須ファイル**が存在します。運用環境（または配布パッケージ）には必須ファイルが欠けないよう注意してください。

```text
wordcloud_app/
├── index.html       【必須】メインUI構成、DOM要素の定義
├── css/             【必須】
│   └── styles.css   アプリケーション全体のスタイリング、レスポンシブ対応
├── js/              【必須】
│   └── app.js       アプリケーションの全ロジック（状態管理、解析、描画）
├── lib/             【必須】外部ライブラリ
│   ├── kuromoji/    kuromoji.js本体と辞書データ (dict/*.dat.gz) ※辞書データがないと解析不可
│   └── wordcloud2/  wordcloud2.min.js
├── data/            【一部必須】
│   ├── stopwords.txt         【必須】システムのデフォルト除外ワード辞書
│   └── sample_opinions.txt等 【非必須】ユーザーが配置したサンプルデータ群
├── assets/          【必須】
│   └── fonts/       フォントファイル等の静的アセット
├── kidou.bat        【必須】ローカル環境でCORS制約を回避してブラウザを起動するバッチファイル
├── docs/            【非必須】チュートリアルや本仕様書などのドキュメント
└── server/          【非必須】過去のHFSやIISなどのサーバー配信テスト用ディレクトリ
```

---

## 3. アプリケーションのライフサイクルと状態管理

`app.js` では、グローバル変数を用いてアプリケーションの「状態（State）」を管理しています。画面上の設定（品詞、除外ワード等）が変更されると、状態が更新され、必要な計算が再実行されます。

### 主要な状態変数（State）
* `globalAnalyzedLines`: 解析済みの元テキスト。行ごとのトークン配列をキャッシュしており、KWIC検索や共起計算のベースとなります。
* `wordFrequencies`: 単語の出現回数とTF-IDFスコアを保持する配列。
* `networkNodes`, `networkEdges`: ネットワーク図の描画・当たり判定用データ。
* `pcaPoints`: PCA散布図の描画・当たり判定用データ（x, y座標、所属クラスターを含む）。
* `currentLdaResult`: LDAトピックモデルの解析結果（自動判定されたトピック数 $K$、各語の所属トピック、適合度、トピックカラー等）。
* `customStopWords`, `customCompoundWords`: ユーザーが追加した除外ワードと複合語のSetオブジェクト。

### メインパイプライン (`processAndRender` 関数)
設定が変更されたり、単語が除外された際に呼ばれる心臓部です。
1. **テキスト走査**: `globalAnalyzedLines` をループ処理。
2. **複合語結合**: `mergeCompoundWords()` で指定された文字列を1トークンに結合。
3. **フィルタリング**: 指定された品詞のみを残し、`customStopWords` を除外。
4. **行列・統計計算**: 
   * **TF-IDF**: 出現回数と逆文書頻度を計算。
   * **共起・Louvain**: Jaccard係数の網羅的計算とモジュラリティ最大化。
   * **PCA・K-Means**: 共分散行列のべき乗法による固有値分解とK-Means++。
   * **LDAトピックモデル**: 最適トピック数 $K$ の自動判定（Perplexity評価）とギブスサンプリングによる潜在話題分類。
   * TF-IDFの計算
   * 共起ペアの集計とJaccard係数の算出
   * PCAとK-Meansクラスタリングの実行
5. **描画**: 現在の `displayType` に応じて Canvas を更新。

---

## 4. カスタム描画と当たり判定（Hit Detection）のロジック

ワードクラウド以外のグラフ（棒グラフ、ネットワーク図、PCA）は、すべて独自の Canvas API 実装によって描画されています。そのため、マウスホバーやクリックイベントのハンドリングも独自に実装しています。

### スケーリング対応
高解像度ディスプレイ（Retina等）やCSSによるリサイズに対応するため、Canvasの論理サイズと物理サイズのマッピングを行っています。
イベントハンドラ内では、以下の計算でマウス座標をCanvas内の座標系に変換しています。
```javascript
const rect = cloudCanvas.getBoundingClientRect();
const scaleX = cloudCanvas.width / rect.width;
const scaleY = cloudCanvas.height / rect.height;
const mouseX = (e.clientX - rect.left) * scaleX;
```

### Z-Index（重なり）を考慮した当たり判定
点やノードが重なっている場合、「一番手前に描画されたもの」をクリックできるようにするため、配列を**逆順（後ろから前へ）**にループ処理してヒット判定を行っています。
```javascript
for (let i = pcaPoints.length - 1; i >= 0; i--) { ... }
```

### ゴーストクリック対策
`wordcloud2.js` が独自のクリック・ホバーイベントをCanvasに登録するため、他のグラフ（PCAなど）を表示している最中にワードクラウドの判定が裏で誤作動する問題がありました。
これを防ぐため、`wordcloud2.js` のコールバック内に `if (displayType.value !== 'cloud') return;` というガード条件を挿入して排他制御を行っています。

---

## 5. KWIC（Key Word In Context）のアルゴリズム

KWICモーダルを開く際、`globalAnalyzedLines` を再度走査し、対象のキーワード（クリックされた単語）を探します。

1. 行内のトークン列に対して `mergeCompoundWords` を適用し、現在の状態を再現。
2. 行内にキーワードが複数回存在する場合に備え、出現したインデックス（`wordIndices`）を配列で取得。
3. インデックスごとに「左側の文脈（前のトークン列）」と「右側の文脈（後のトークン列）」を文字列結合。
4. 表示領域が崩れないよう、左右それぞれ最大40文字（`maxContextLen`）で切り詰め、先頭や末尾に「…」を付与してテーブル（DOM）を構築。

---

## 6. 今後のメンテナンス・機能追加時の注意点

1. **新しいグラフを追加する場合**
   * `index.html` の `display-type` セレクトボックスに選択肢を追加。
   * `app.js` の `updateClusterCountGroupVisibility()` やイベントリスナー分岐に新しいモードを追加。
   * Canvasの描画関数（`drawXXXOnCanvas`）を新規作成。
   * `cloudCanvas.addEventListener` の `mousemove` と `click` イベント内に、新しいグラフ用の当たり判定ロジックを追加。

2. **Kuromoji辞書の仕様**
   * IISなどの一部のWebサーバーでは、初期設定で `.dat.gz` 拡張子がブロックされ、Kuromojiの初期化に失敗（真っ白な画面になる等）する現象が発生します。サーバー移行時は MIME Type (`application/x-gzip`) の登録が必須である点に注意してください。

3. **パフォーマンスの限界**
   * すべての処理をブラウザのメインスレッドで実行しているため、数万行レベルのテキストを読み込ませるとブラウザがフリーズする可能性があります。
   * 将来的にビッグデータを扱う要件が出た場合は、`Web Worker` を導入して `processAndRender()` の計算処理をバックグラウンドスレッドに逃がすアーキテクチャへの改修を検討してください。
