# 採用基準・公式根拠（調査日 2026-10-10 JST）

本体はHTML Living Standard・CSS・SVG・JavaScript。開発/検証はNode.jsのES modules、JSON、GitHub Actions YAML、Markdown内のシェル例。バックエンド、SQL、テンプレートエンジン、フレームワーク、コンパイル、polyfill、適用済みDBマイグレーションはない。IndexedDBのDBバージョン・保存キー・バックアップ形式は変えない。

|領域|採用・分類|安定性・条件|公式根拠|範囲・検査|
|---|---|---|---|---|
|JavaScript|const/let、async/await、Map/Set、構造化クローン、任意連鎖などを継続|ECMA-262 17版（2026年6月）が最新版。未完成の2027編集草案を完成仕様とは扱わない。古い導入年だけで現在適切な構文を廃止しない|https://ecma-international.org/publications-and-standards/standards/ecma-262/ |本体全script、全mjsの構文・指定したESLintルール|
|エラー処理|finallyから制御をreturnせず、必要なクリーンアップだけ条件分岐|新たな実行時API不要。古い実装はセッションが変わると例外を握りつぶす|https://eslint.org/docs/latest/rules/no-unsafe-finally |showToast、再混入をESLintと失敗テストで検査|
|DOM|同じ接続済み一覧内の再配置をmoveBeforeで原子的に行う|DOM標準に掲載。すべての既存対応環境で利用可能とは扱わず、feature detectionとinsertBefore代替。新規ノードにも代替を使う|https://dom.spec.whatwg.org/#dom-parentnode-movebefore |reconcileChildren、対応/非対応の両経路テスト、ブラウザ並べ替えQA|
|HTML|button/input/label、hidden、inert、意味のある見出しを継続、関数で子マークアップを分離|Living Standard。dialog/popoverへの一律移行はしない。集中表示が背面スクロールを許す既存仕様、入れ子の確認・保存ロック・復帰先を維持する設計が必要|https://html.spec.whatwg.org/multipage/dom.html / https://html.spec.whatwg.org/multipage/interaction.html / https://html.spec.whatwg.org/multipage/obsolete.html |本体/生成HTMLの解析、廃止要素検索、操作QA。規格適合性検証と全ブラウザは未完|
|CSS|既存のlayers、ネスト、Grid/Flex、カスタムプロパティ、light-dark、content-visibilityを継続|仕様草案の公開だけをブラウザ対応の証拠にしない。元の対応要件（ネスト/light-dark/structuredClone/roundRect）を保つ。content-visibility非対応は通常描画。interpolate-sizeは任意の装飾で未対応時の基本レイアウトを維持|https://www.w3.org/TR/css-nesting-1/ / https://drafts.csswg.org/css-contain-2/ |全style構文解析、無制限transition検査、390pxブラウザQA。CSS全面改変を今回の実績にしない|
|Node.js|推奨24 LTS、22.13以降の22系継続、CIに22/24/26|公式情報の最新Currentは26.11.1、最新LTSは24.21.0。26はCurrentなので推奨開発環境はLTSを選定。今回の実行機は22.22.2、24/26のローカル実行・リモートCI実行は未確認|https://nodejs.org/en/about/previous-releases / https://nodejs.org/api/test.html |.nvmrc、engines、CI matrix、lockfile整合。Nodeの本番ランタイムは不要|
|静的解析|ESLint 10.12.0、Prettier 3.9.9、Espree 11.2.0を固定|npmレジストリの最新安定版と公式公開情報を確認。Node ^22.13または24以降。ブラウザの配信依存は増えない|https://eslint.org/docs/latest/use/getting-started / https://prettier.io/docs/options / https://github.com/eslint/js/releases |全管理mjs、埋め込みscript。書式変更と意味のある修正は区別|
|テスト抽出|インデント・閉じ括弧の正規表現からEspreeのAST rangeへ|ESLint公式パーサー、正確な関数スコープを使い、ネスト内同名関数・文字列中の括弧・改行したイベント登録を誤抽出しない|https://github.com/eslint/js/blob/main/packages/espree/README.md |tests/helpers/app-source.mjs、関数・キーbindingの抽出、新規回帰テスト|
|CI|checkout 7.0.1、setup-node 7.0.0をSHA固定|公式リリースとGit tagの指すcommitをGitHub APIで照合|https://github.com/actions/checkout/releases / https://github.com/actions/setup-node/releases |contents:read、認証情報保持無効、npm ci --ignore-scripts、npm run verify|

## 残す具体的な例外

- `keyCode === 229`: 本体7箇所。キー識別はkey/codeだが、IMEではcompositionstart/endの境界でisComposingだけで変換確定を識別できないケースがある。既存の日本語確定キーの契約を維持する。MDNのkeydownの注意事項（https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event ）とW3C UI Events（https://www.w3.org/TR/uievents/ ）を根拠に229の用途だけ許容し、検査で件数と値を限定。最低対応環境のOS実IMEが未検証なので全廃済みとは報告しない。全対象の実IMEでcomposition/keyの代替経路を検証できたとき撤去を判断する。
- CSS接頭辞3箇所: `-webkit-font-smoothing`と`::-webkit-progress-bar/value`。前者に同じ見た目を保証する標準代替はなく、後者は標準progress要素をBlink/WebKitでスタイルするため必要。対象を削除すると表示条件を変えるため継続。全対象ブラウザに同等の標準APIが揃い視覚確認したとき解消する。
- `insertBefore`: moveBefore未対応・新規ノード・未接続コンテナで必要な現行標準API。非推奨ではない。旧式として全廃する対象ではない。
- 履歴HTMLと生成QA: `performance/**/*.html` は比較用固定版・候補・生成物。元の生成スクリプトは現代化/整形対象。固定版を編集すると過去の証拠・再現性を壊すため直接更新しない。全HTMLを解析しscriptの診断をsource-inventory.jsonへ残す（過去版のfinally診断を隠していない）。
- 本体HTMLの整形: 実行時のコード整理・静的解析は全体へ適用。既存の生成ツールの挿入マーカーを維持するため全HTMLのPrettier整形は行わず、新規部分も既存インデントに合わせる。型検査、完全なHTML/CSS規格適合検査、最低対応ブラウザ実機は未完。

追加コードにも同じ静的解析を適用する。ESLintのルールセットは明示的な14ルールで、すべての非推奨APIを網羅するものではない。禁止API検索は補助検査。ES2022の構文解析条件を保ち、既存の最低環境を無断で縮小しない。ESNextへ設定を変えただけの現代化は行わない。
