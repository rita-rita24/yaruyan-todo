# 採用基準の追記（2026-10-10）

前段の言語・環境・例外基準は [round3/standards.md](../round3/standards.md) を継承する。対応ブラウザ範囲は縮小していない。最低バージョンと本番実行環境の特定、実機の互換検証は未完了。

|領域|変更・扱い|公式根拠と状態|適用範囲・検査|
|---|---|---|---|
|DOM/SVG|既存symbolの子要素をcloneNode(true)で独立SVGへ複製する候補は不採用|[DOM Standard](https://dom.spec.whatwg.org/#dom-node-clonenode)、現行標準。useも非推奨ではなく、性能候補として比較|直接表示の代理時間は短縮したが検索解除・親編集の処理代理値に再現する悪化があり撤回。現行の標準useを維持|
|SVG|標準ベクター形状を維持|[SVG use構造](https://svgwg.org/svg2-draft/struct.html#UseElement)は編集草案。SVG2の新機能を安定版として追加したわけではない|画像化・解像度削減なし。元sprite形状とのisEqualNode比較|
|HTML|閉じた領域をinert、開いた領域のみ操作可能|[HTML Living Standard inert](https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute)、既存アプリでも使用している標準機能|閉じた4overlayの初期状態とsyncModalInteractivity。保存ロック解除後、入れ子・開閉フォーカスを確認|
|HTML|入力を包むlabelの冗長forを削除|[HTML label](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)、暗黙関連付けを維持|3label、label.controlをブラウザ確認|
|検査|html-validate 10.9.0を固定|[公式利用手順](https://html-validate.org/usage/index.html)、[推奨ルール](https://html-validate.org/rules/)。最新11.16.2のNode条件は^22.22.0または>=24.8.0。10.9.0は^20.19.0または>=22.12.0|既存宣言Node22.13以上を維持できる版。最新11を採用済みとは報告しない。recommended/prettierを使用し一括無効化なし|
|JS解析設定|4箇所の年版指定を2022から2026へ統一|[Espree公式](https://github.com/eslint/js/tree/main/packages/espree#options)の年版2026指定。固定11.2.0が解析可能な範囲を使用|静的検査・ASTテスト抽出・2個の索引生成元。解析可否と実行API対応は別であり、設定変更だけを全面現代化の達成に数えない|
|Node実行検証|最低22.13.0と24.21.0/26.11.1の固定版でverify成功|[24.21.0 LTS](https://nodejs.org/en/blog/release/v24.21.0)、[26.11.1 Current](https://nodejs.org/en/blog/release/v26.11.1)|各258テスト・75モジュール0エラー、Mac。リモートUbuntu CIの実行とは別|
|診断|Long Animation Framesを実験計測のみ利用|[W3C Editor Draft](https://w3c.github.io/long-animation-frames/)（2026-09-03、work in progress）|Chrome154の計測ハーネスのみ。配布HTMLへ導入しない。iframeで観測0でも停止なしとは認定しない|

HTML検査は現行の静的配布HTML全体に適用する。生成後の全状態のHTML適合、全CSS仕様適合、型検査、全非推奨APIの検出を網羅したとは扱わない。固定した過去HTML・却下候補は再現性のため改変せず、解析診断を別に保存する。6個の維持中QA生成元は共有SVG検証へ更新し、use参照と実験候補の独立形状をそれぞれ正しく検査する。

生成後DOMの追加検査は29診断を別記する。20件の属性値直列化は[HTMLのboolean値](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes)として空文字が許容される。動的inline style2件は行の推定寸法とツールチップ座標に必要で、同等な互換置換は未検証。生成空白6件は未修正。ツール挿入overlay1件は配布ソースの外。動的検査のルールを無効化して0件に見せていない。
