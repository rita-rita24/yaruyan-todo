# 2026-10-10 採用基準・例外

[Round4](../round4/standards.md)・[Round3](../round3/standards.md)の公式根拠と例外を継承する。Round5は新しいランタイム依存、実験フラグ、保存キャッシュ、対応ブラウザの最低条件を追加していない。最低ブラウザの特定と実機実行は未完了。

|対象|公式根拠・状態|今回の判断|
|---|---|---|
|DOMの再利用・移動|[DOM Standard](https://dom.spec.whatwg.org/)のinsertBefore、moveBefore、ノード操作。Living Standard|既存reconcileChildrenへ変更のない子行を渡す。接続済み同一一覧では既存のmoveBefore対応判定、その他はinsertBeforeのフォールバックを維持。保存・フォーカス・ドラッグ状態を優先する|
|HTML template|[HTML Living Standard](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)|変更のあった子だけ既存マークアップから生成。空白圧縮候補は速度効果が混在し不採用。HTML/CSS/SVGの全面変換を今回実施したとは扱わない|
|空白|[CSS Text 3](https://www.w3.org/TR/css-text-3/)は2026-08-14 Candidate Recommendation Draft|文書内空白は描画・DOMへ影響し得る。候補の文字数削減を性能・現代化の達成数へ含めない|
|実入力の診断|[Event Timing](https://www.w3.org/TR/event-timing/)は2026-03-19 Working Draft|Chrome計測コピーだけでPerformanceObserverを使用。配布HTMLに追加せず、安定標準への統一として数えない。durationは次の描画までの推定で8ms単位。閾値16ms、欠測を0とせず、isTrustedと結果を照合。INP・全行の実画素・連続FPSを意味しない|
|JS解析|[Espree公式](https://github.com/eslint/js/tree/main/packages/espree#options)|前段の年版2026・固定11.2.0を維持。594関数ノードを位置付きで索引化。構文成功は全API監査・型検査の完了ではない|
|検査環境|[Node 24.21.0 LTS](https://nodejs.org/en/blog/release/v24.21.0)、[26.11.1 Current](https://nodejs.org/en/blog/release/v26.11.1)|最低22.13.0、ホスト22.22.2、24.21.0、26.11.1で各verify成功。Mac上の実行で、リモートUbuntu CIではない|

既存のkeyCode 229判定7箇所、WebKit互換CSS3箇所、html-validate 10.9.0固定、生成DOMの未修正診断は前段の例外・残件として継続する。最新validator 11の採用済みとはしない。全CSS規格適合、全非推奨APIの撤去、実IME、全ブラウザの確認は未完了。公式ページの状態と対応環境の実測は別に記録する。
