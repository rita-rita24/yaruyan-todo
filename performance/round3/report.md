# 現代化・性能検証結果（2026-10-10 JST）

## ① 実施結果

ローカルの実装と検査は実施したが、依頼全体は未完了。本番URL・配布場所・反映手順が特定できず、本番反映・配信版確認・本番再計測は未実施。全面現代化の完了条件（全対応環境・全操作の検証）と全操作の性能目標も未達である。

最終配布ソースは `yaruyan-todo.html`、SHA-256 `f693b06e12709b225d0586d0bc537ce324b6bfbbc2de13f9f50368b996c09113`。本番の反映バージョン・反映日時は該当なし。計測は2026-10-10 00:59–01:08 JSTを含むlocalhost上の比較。個別日時と版は [versions.json](versions.json) と各生データへ記録。作業開始時の未コミット変更を基準版として保存し、既存の変更を維持した。Git HEADと今回の基準版は同一ではない。

対象はHTML/CSS/SVG/ブラウザJavaScript、Node ES modules、JSON、YAML、Markdown内の実行例。バックエンド・SQL・認証・組織機能・外部API・ビルドは実装されていない。3画面（tasks/memo/settings）、[55操作](operations.md)、本体333関数の構文索引、全管理ソースの機械検査を実施した。最終版の時間計測は19種類の自動操作・10条件群、変更前50/変更後50試行である。未計測操作は一覧へ残した。全関数の構文索引は全関数の人手による意味監査を保証するものではない。

ドラッグ移動先の二分探索、原子的DOM再配置と互換経路、子マークアップの部品化、不要コード除去、例外を消さない後処理、上限超過入力の全文保持、ASTによるテスト抽出を実装した。静的解析・書式・依存固定・CIも整備した。子DOMの部分更新候補は、画面操作で安定した効果を確認できず不採用。配布HTMLの容量は383,080→382,903 bytes（177 bytes減）、ブラウザ実行時依存は追加なし。

性能はドラッグの**移動先計算だけ**で処理負荷削減を確認した。一覧操作の中央値は改善と悪化が混在し、別系列では逆転するため、全体の体感改善とは認定していない。1万件検索解除は最終版でも中央値約1.95–2.18秒で、主要な残存遅延である。

## ② コードの現代化の結果

単位は表に示す実装箇所・宣言・分岐であり、書式の変更行数ではない。既存管理コードと追加管理コードを同じ14ルールで再検査した。歴史的HTMLスナップショットは移行対象にせず、診断を別途記録した。

|領域・単位|変更前の実装|採用した実装|前|移行済み|必要な例外|未対応|根拠・範囲|
|---|---|---|---:|---:|---:|---:|---|
|JS・後処理1箇所|finally内return|セッション一致時だけ後処理|1|1|0|0|showToast、no-unsafe-finallyと例外回帰検証|
|JS・宣言1個|再代入しないlet|const|1|1|0|0|tests/create-boundary-qa.mjs、prefer-const|
|JS・未使用宣言10個|参照のない変数/関数|削除|10|10|0|0|本体2、計測2、テスト6。unused-audit.json|
|JS・不要分岐3個|実行条件から到達しないdisabled属性|削除|3|3|0|0|renderTasksの親開始操作内|
|DOM・再配置1箇所|insertBeforeのみ|moveBeforeと機能検出・標準代替|1|1|1|0|reconcileChildren、代替は現行標準で非推奨ではない|
|JS・計算実装1個|全候補の座標走査|二分探索|1|1|0|0|縦一覧、可変高さ・スクロール・挿入スロットの差分テスト|
|HTML/JS・責務1個|renderTasks内の子行マークアップ|createSubtaskRowMarkup|1|1|0|0|文字列のエスケープとSVG参照を維持|
|入力・制限1箇所|ブラウザmaxlengthで切断|保存検証まで全文を保持|1|1|0|0|完了メッセージ欄、80文字規約維持|
|テスト・抽出機構1個|インデント依存の正規表現|Espree構文木のrange|1|1|0|0|関数・keydown bindingの抽出。HTML script抽出は正規表現のまま|
|JS・非推奨アクセス7箇所|keyCode===229|日本語IME互換用途のみ継続|7|0|7|0|OS実IMEと最低対応環境の検証後に解消判断|
|CSS・接頭辞3箇所|WebKit表示専用|継続|3|0|3|0|同等の標準描画代替を確認できない。見た目維持|

全面の非推奨APIを網羅するルールではなく、表外の未発見残件ゼロを保証しない。書式の不一致は修正したが意味のある置換件数には算入しない。最初の静的検査には誤ったIME件数条件による診断も含まれ、これをコード修正件数には算入していない。

仕様・公式資料確認日は2026-10-10。ECMA-262第17版（2026年6月）、HTML Living Standard、DOM Standardを基準とした。2027年の編集草案は安定版として採用しない。推奨開発環境はNode24 LTS、実行検証は22.22.2。ESLint10.12.0 / Prettier3.9.9 / Espree11.2.0をlockfile固定。CIはNode22/24/26でcheckout7.0.1・setup-node7.0.0をcommit SHA固定。詳細な公式URL、互換条件と解消条件は [standards.md](standards.md)。Node24/26とリモートCIの実行確認は未実施。

HTML/CSSは既存の意味構造・レイアウト・layers・ネスト・content-visibilityを維持し構文解析した。CSS全面刷新や完全なHTML規格適合検査を実施したとは扱わない。追加コードは `npm run check` / `npm run verify` で検査し、READMEへ同じ採用規約を記載した。型検査は未実施。

## ③ 本番での画面別・操作別の時間計測結果

|画面・URL|操作・条件|指標|前の中央値|後の中央値|短縮量|短縮率|前/後 n|判定|
|---|---|---|---|---|---|---|---|---|
|本番URL未特定 / tasks|操作一覧の全該当行|主要内容・操作可能・初期反応・結果確定・保存完了|未計測|未計測|算出不可|算出不可|0/0|変更前本番データなし|
|本番URL未特定 / memo|操作一覧の全該当行|同上|未計測|未計測|算出不可|算出不可|0/0|本番未反映|
|本番URL未特定 / settings|操作一覧の全該当行|同上|未計測|未計測|算出不可|算出不可|0/0|本番未検証|

### ローカル比較（本番の表とは分離）

Chrome154 / macOS / 1280×900 iframe、localhost、HTTP cache無効、保存領域を各試行で分離。空0×0・通常20×5・上限200×50。初回/繰り返しは保存状態の違いで、cold/warmネットワークキャッシュの意味ではない。前後の順序を試行ごとに交互にし各条件n=5。差は `(前−後)/前×100`、負は悪化。全体平均・統計的有意差は算出しない。

下表の指標は **displayMs**（処理・結果確認後の2回のrequestAnimationFrameまで）。実際の画素表示、最初の入力反応、INP、レンダリングトレースを意味しない。readyMsは処理・モデル/保存契約の完了代理指標として [comparison.json](comparison.json) に別記。編集保存は編集画面を開く時間を含む。保存完了だけを独立測定した表ではない。

|画面・データ・保存状態|操作|前 ms|後 ms|短縮 ms|短縮率 %|前/後 n|後の最小–最大 ms|
|---|---|---:|---:|---:|---:|---|---|
|tasks / 0×0 / initial|direct|43.8|43.3|0.5|1.1|5/5|41.4–43.6|
|tasks / 0×0 / initial|navigate-memo|33.0|33.3|-0.3|-0.9|5/5|33.1–34.5|
|tasks / 0×0 / initial|navigate-settings|33.3|32.6|0.7|2.1|5/5|31.4–34.1|
|tasks / 0×0 / initial|navigate-tasks|34.9|34.6|0.3|0.9|5/5|32.5–35.3|
|tasks / 0×0 / repeat|direct|44.1|45.1|-1.0|-2.3|5/5|42.5–62.6|
|tasks / 0×0 / repeat|navigate-memo|32.2|33.1|-0.9|-2.8|5/5|31.7–34.5|
|tasks / 0×0 / repeat|navigate-settings|33.1|33.1|-0.0|-0.0|5/5|31.7–33.3|
|tasks / 0×0 / repeat|navigate-tasks|33.1|33.7|-0.6|-1.8|5/5|33.0–36.1|
|tasks / 20×5 / initial|direct|65.1|69.5|-4.4|-6.8|5/5|41.4–73.9|
|tasks / 20×5 / initial|navigate-memo|28.5|27.1|1.4|4.9|5/5|23.8–31.3|
|tasks / 20×5 / initial|navigate-settings|33.4|33.7|-0.3|-0.9|5/5|32.5–35.3|
|tasks / 20×5 / initial|navigate-tasks|40.3|37.0|3.3|8.2|5/5|33.4–42.9|
|tasks / 20×5 / initial|search|27.5|29.4|-1.9|-6.9|5/5|24.9–33.2|
|tasks / 20×5 / initial|search-clear|65.2|51.8|13.4|20.6|5/5|50.4–67.4|
|tasks / 20×5 / initial|parent-edit|34.5|38.0|-3.5|-10.1|5/5|32.1–55.8|
|tasks / 20×5 / initial|child-edit|49.3|47.3|2.0|4.1|5/5|23.6–48.9|
|tasks / 20×5 / initial|focus-start|52.6|51.1|1.5|2.9|5/5|48.2–53.7|
|tasks / 20×5 / initial|child-save|40.8|40.3|0.5|1.2|5/5|37.3–58.2|
|tasks / 20×5 / initial|parent-save|58.6|44.2|14.4|24.6|5/5|36.6–61.8|
|tasks / 20×5 / repeat|direct|71.1|52.2|18.9|26.6|5/5|47.9–61.8|
|tasks / 20×5 / repeat|navigate-memo|23.9|22.7|1.2|5.0|5/5|18.9–31.2|
|tasks / 20×5 / repeat|navigate-settings|33.5|34.5|-1.0|-3.0|5/5|31.9–35.2|
|tasks / 20×5 / repeat|navigate-tasks|40.0|38.2|1.8|4.5|5/5|35.2–40.9|
|tasks / 20×5 / repeat|search|32.1|30.3|1.8|5.6|5/5|24.9–30.6|
|tasks / 20×5 / repeat|search-clear|66.1|66.0|0.1|0.2|5/5|64.6–72.1|
|tasks / 20×5 / repeat|parent-edit|34.9|35.2|-0.3|-0.9|5/5|32.8–66.9|
|tasks / 20×5 / repeat|child-edit|49.1|51.7|-2.6|-5.3|5/5|46.3–55.7|
|tasks / 20×5 / repeat|focus-start|47.6|53.8|-6.2|-13.0|5/5|46.8–77.9|
|tasks / 20×5 / repeat|child-save|37.9|37.6|0.3|0.8|5/5|27.4–43.7|
|tasks / 20×5 / repeat|parent-save|45.1|40.4|4.7|10.4|5/5|29.7–54.9|
|tasks / 200×50 / initial|direct|550.4|581.0|-30.6|-5.6|5/5|363.4–806.6|
|tasks / 200×50 / initial|navigate-memo|662.0|611.4|50.6|7.6|5/5|408.4–690.5|
|tasks / 200×50 / initial|navigate-settings|48.2|50.6|-2.4|-5.0|5/5|45.0–102.2|
|tasks / 200×50 / initial|navigate-tasks|82.6|69.6|13.0|15.7|5/5|55.4–86.3|
|tasks / 200×50 / initial|search|1312.9|732.2|580.7|44.2|5/5|532.4–1498.9|
|tasks / 200×50 / initial|search-clear|2787.2|2176.5|610.7|21.9|5/5|2065.3–4803.1|
|tasks / 200×50 / initial|parent-edit|184.7|194.4|-9.7|-5.3|5/5|147.8–1372.3|
|tasks / 200×50 / initial|child-edit|108.4|125.2|-16.8|-15.5|5/5|68.8–145.7|
|tasks / 200×50 / initial|focus-start|256.7|287.9|-31.2|-12.2|5/5|260.4–635.8|
|tasks / 200×50 / initial|child-save|253.9|226.4|27.5|10.8|5/5|181.4–424.5|
|tasks / 200×50 / initial|parent-save|239.0|279.8|-40.8|-17.1|5/5|227.3–1678.7|
|tasks / 200×50 / repeat|direct|604.3|612.4|-8.1|-1.3|5/5|400.9–1021.3|
|tasks / 200×50 / repeat|navigate-memo|560.0|595.4|-35.4|-6.3|5/5|418.8–650.0|
|tasks / 200×50 / repeat|navigate-settings|51.7|47.3|4.4|8.5|5/5|39.4–49.7|
|tasks / 200×50 / repeat|navigate-tasks|70.8|67.6|3.2|4.5|5/5|50.7–146.2|
|tasks / 200×50 / repeat|search|1564.8|1167.1|397.7|25.4|5/5|385.3–1417.1|
|tasks / 200×50 / repeat|search-clear|2481.2|1948.8|532.4|21.5|5/5|1152.4–5207.7|
|tasks / 200×50 / repeat|parent-edit|207.3|218.9|-11.6|-5.6|5/5|169.3–358.6|
|tasks / 200×50 / repeat|child-edit|113.5|100.1|13.4|11.8|5/5|85.2–168.5|
|tasks / 200×50 / repeat|focus-start|313.2|247.8|65.4|20.9|5/5|232.2–430.8|
|tasks / 200×50 / repeat|child-save|245.7|204.1|41.6|16.9|5/5|156.6–238.8|
|tasks / 200×50 / repeat|parent-save|264.0|217.4|46.6|17.7|5/5|138.7–290.2|
|tasks / 20×5 / initial|direct|71.4|73.7|-2.3|-3.2|5/5|59.7–224.8|
|tasks / 20×5 / initial|scroll-last|67.6|69.2|-1.6|-2.4|5/5|54.2–192.8|
|tasks / 20×5 / initial|scroll-top|33.8|33.2|0.6|1.8|5/5|31.7–47.4|
|tasks / 20×5 / initial|filter-completed|38.2|42.4|-4.2|-11.0|5/5|34.0–159.3|
|tasks / 20×5 / initial|filter-all|40.0|49.9|-9.9|-24.7|5/5|31.9–66.5|
|tasks / 20×5 / initial|focus-pause|28.0|41.3|-13.3|-47.5|5/5|37.5–55.1|
|tasks / 20×5 / initial|focus-resume|55.6|50.9|4.7|8.5|5/5|47.0–56.0|
|tasks / 20×5 / repeat|direct|77.9|95.0|-17.1|-22.0|5/5|69.0–1115.8|
|tasks / 20×5 / repeat|scroll-last|79.5|72.3|7.2|9.1|5/5|59.4–215.0|
|tasks / 20×5 / repeat|scroll-top|35.0|34.5|0.5|1.4|5/5|31.9–36.2|
|tasks / 20×5 / repeat|filter-completed|39.5|33.4|6.1|15.4|5/5|31.6–93.3|
|tasks / 20×5 / repeat|filter-all|35.4|41.0|-5.6|-15.8|5/5|37.6–2122.1|
|tasks / 20×5 / repeat|focus-pause|27.0|30.7|-3.7|-13.7|5/5|25.7–244.0|
|tasks / 20×5 / repeat|focus-resume|64.1|51.2|12.9|20.1|5/5|43.7–57.6|
|settings / 20×5 / initial|direct|49.6|49.7|-0.1|-0.2|5/5|46.8–50.3|
|settings / 20×5 / initial|backup-read-confirm|33.3|32.6|0.7|2.1|5/5|31.7–33.5|
|settings / 20×5 / initial|backup-confirm-import|41.7|41.7|0.0|0.0|5/5|41.0–42.4|
|settings / 20×5 / repeat|direct|51.1|50.7|0.4|0.8|5/5|50.4–51.3|
|settings / 20×5 / repeat|backup-read-confirm|32.3|33.2|-0.9|-2.8|5/5|32.8–34.6|
|settings / 20×5 / repeat|backup-confirm-import|41.7|41.7|-0.0|-0.0|5/5|40.5–42.9|


最終版の全代理指標・全サンプル・前後min/maxは [comparison.json](comparison.json)。[comparison.md](comparison.md) には最終版以外の候補・削除前版も含むためsuiteと[versions.json](versions.json)のfingerprintを必ず照合する。候補chrome-confirm/chrome-large、採用前版adopted-small/adopted-largeを最終版の改善率に混ぜない。

## ④ 連続操作の追従性・滑らかさ

|操作・条件|指標|前|後|評価|試行・観測|限界|
|---|---|---:|---:|---|---|---|
|親200・子50、移動先計算199回/試行|同期計算中央値 ms|36.6|7.2|80.3%短縮|5/5試行、各995入力|候補での補助実験。最終版の同一関数をSHA照合済み|
|同条件|getBoundingClientRect呼び出し数/試行|19,900|1,537|92.3%減|合計99,500/7,685観測|幾何取得だけ。実ドラッグの画面追従時間ではない|
|ドラッグ開始・移動・drop・保存|追従遅延/FPS/停止回数/独立保存時間|未計測|未計測|改善未確認|0/0|ブラウザQAは合成イベントで最終順序・保存内容を確認|
|連続検索・日本語変換・タッチ・リサイズ|実入力追従遅延|未計測|未計測|改善未確認|0/0|OS実IME、スマートフォン実機、長時間メモリ未確認|

`browser-round3-drag-micro-raw.json` のlookup関数は候補と最終版で同一（関数SHAはversions.json）。同ファイルのchild-render-onlyの改善は撤回した部分更新候補の値で、最終版には適用しない。スクロール末尾への単発到達時間は③の代理計測でありFPSではない。

## ⑤ 検証の根拠と残る課題

`npm run verify` は静的検査0件・回帰257件成功、失敗/skip0。全64管理mjs、本体全script、全HTML内の構文を検査。全ファイル範囲は [source-inventory.json](source-inventory.json)。外部node_modulesと.gitは管理ソースから区別し、比較スナップショット内の診断を隠さず記録した。引数・catch変数は未使用変数検査の対象外と明示的設定し、すべての型・API・CSS適合性の検査ではない。

通常幅と390×844 iframeで最終版各42チェック成功（browser-round3-functional-raw.jsonの末尾2結果、以前の候補結果と区別）。独立したテスト用保存領域を使い、既存ユーザーデータを計測データへ置き換えない。件数・検索正規化・エスケープ・保存失敗復元・非表示ページ更新・バックアップ・上限データ末尾の編集/フォーカス・合成ドラッグ順序/保存を確認した。未対応のmoveBefore代替も単体回帰で確認。実際の実機タッチとOSのIME候補表示は未検証。

遅延原因→変更→効果→確認の対応は、(a) 全候補の幾何取得→二分探索→取得回数と同期処理減→可変高さ/全移動元/スクロールの旧実装比較と順序QA、(b) 非原子的再配置→moveBeforeと代替→ノード状態維持の標準経路→両分岐テスト、(c) finallyからreturn→条件付き後処理→例外保持→新トーストが残り元例外がrejectする回帰、(d) maxlength→保存検証→全文保持→81文字が消えず保存拒否、(e) brittle抽出→構文木→文字列括弧/改行/ネストを正確抽出→回帰、である。(b)〜(e)の体感速度向上は実証していない。

再現: `npm ci --ignore-scripts`、`npm run verify`、`node performance/round3/serve.mjs`、49188のrunnerにcompare=adopted-clean / adopted-extended / adopted-backupを指定。各trials=5。計測サーバーは再起動時も生データへ追記するので、追試は新しいcompare名を使い過去の集合へ混ぜない。QAは `node performance/round3/create-qa.mjs`、/functional-qaと/functional-narrow。索引は `node performance/round3/index-source.mjs`、棚卸しは `node scripts/check.mjs --inventory`。

記録: baseline/candidate/adopted-measured/adoptedの固定HTML、[adopted.patch](adopted.patch)（今回開始時→最終版）、versions.json、生データbrowser-*-raw.json、comparison.json、最終検査final-verify.log、source-inventory.json、application-index.json、公式根拠standards.md。開始時より前の変更は今回のpatchに含めない。トレース・実FPS記録は取得していない。初期のmain失敗系列、IAB valid中断/上書き系列は比較の結論から除外した。ホストCPU/GC/メモリ負荷を制御できず、n=5のばらつきと別系列での逆転がある。

残る課題は、1万件検索/解除の秒単位負荷、55操作の未計測行、初期反応/保存単独/実ドラッグ4区間/長時間追従、最低対応環境と実IME、完全なHTML/CSS規格適合・型検査、Node24/26とCI実行確認、本番前後測定である。検索の行更新・重い描画と処理の分離は有望だが効果は未測定。子行部分更新は同期renderだけは軽くても操作全体で大きな負の差があり撤回した。機能・情報量を落とす上限縮小や検索遅延追加は採用していない。

本番工程の再開には **配布先URL（またはHTML配布場所）、通常の反映手順、変更前本番の検証用データ/利用方法** が必要。リポジトリ公開情報ではhomepageなし・GitHub Pages無効で、これを本番不在の証明とはしていない。配布先で現状版をバックアップ・測定し、その版を復旧先として確保してから既存手順で反映し、版/キャッシュ/主要機能/前後時間を確認する。ローカルbaselineが現在の本番版とは限らないため本番復旧版には無条件に使わない。保存形式は変えていないが、反映前後の利用データ保全と復旧手順は配布先に合わせて確認が必要。
