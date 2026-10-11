import fs from 'node:fs';
import crypto from 'node:crypto';
const read = (p) => JSON.parse(fs.readFileSync('performance/' + p, 'utf8'));
const investigation = read('investigation.json');
const main = read('local-results.json'),
  backup = read('local-backup-results.json');
const extended = fs.existsSync('performance/local-extended-results.json')
  ? read('local-extended-results.json')
  : null;
const sha = (p) =>
  crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rawBefore = read('browser-baseline-fresh-raw.json'),
  rawAfter = read('browser-optimized-final-raw.json');
const dates = (r) => [r[0].date, r.at(-1).date];
const fmt = (x) => x.toFixed(1);
const productionTable = [
  '画面・URL | 計測条件 | 指標 | 前中央値ms | 後中央値ms | 時間の短縮率 | 前/後回数 | 判定・備考',
  ...investigation.rows.map(
    (r) =>
      `${r.screen} ${r.url}（本番ベースURL未特定） | ${r.condition} | ${r.metric} | 未計測 | 未計測 | 算出不可 | 0/0 | 本番URL・通常反映/復旧手順が未特定`,
  ),
];
const localRows = [];
for (const result of [main, backup, extended].filter(Boolean))
  for (const r of result.rows) {
    if (!r.condition.startsWith('200x50|')) continue;
    const [data, route, cache] = r.condition.split('|');
    if (
      r.operation === 'direct' ||
      [
        'navigate-tasks',
        'search',
        'search-clear',
        'parent-edit',
        'child-edit',
        'focus-start',
        'filter-completed',
        'filter-all',
        'focus-pause',
        'focus-resume',
        'scroll-last',
        'scroll-top',
        'backup-read-confirm',
        'backup-confirm-import',
      ].includes(r.operation)
    ) {
      if (
        result === main &&
        r.operation !== 'direct' &&
        r.operation !== 'navigate-tasks' &&
        route !== 'tasks'
      )
        continue;
      if (result === backup && r.operation === 'direct') continue;
      localRows.push(
        `${result === main ? '主画面' : result === backup ? 'バックアップ手順' : '補足操作'} / ${route} / ${r.operation} | ${cache}・${data} | ${r.metric} | ${fmt(r.before.medianMs)} | ${fmt(r.after.medianMs)} | ${fmt(r.reductionPercent)}% | ${r.before.n}/${r.after.n} | ${r.judgement} | ${fmt(r.before.minMs)}–${fmt(r.before.maxMs)} / ${fmt(r.after.minMs)}–${fmt(r.after.maxMs)}`,
      );
    }
  }
const lines = [
  '読み込み高速化の調査・実装・検証結果',
  '① 実施結果',
  '状態: ローカルの実装・動作確認・変更前後の性能計測は完了。本番未反映・本番未検証・本番の全対象画面未計測。',
  '本番URL、反映された版、通常の反映/復旧手順は未特定。公開GitHubリポジトリのhomepageは未設定、Pagesは無効、ローカルに配信設定・CI・リリース手順なし。ghも未認証。通常の本番反映は依頼で許可済みだが、送り先と方法を推測して公開することはできない。',
  `対象: yaruyan-todo.html。Git HEAD=${investigation.head}は復旧された現行ソースより古いため、計測基準には使用していない。`,
  `変更前現行ソース: performance/baseline.html SHA256=${sha('performance/baseline.html')}`,
  `採用したローカル版: yaruyan-todo.html SHA256=${sha('yaruyan-todo.html')}（未コミット・未配信）`,
  `計測日時（UTC、JSTは+9時間）: 前 ${dates(rawBefore).join(' ～ ')} / 後 ${dates(rawAfter).join(' ～ ')}`,
  '自動テスト253/253成功。実ブラウザ40項目成功（広い幅と390px幅で各40項目）（保存失敗・ロック解除・フォーカス・検索・編集・集中・空データ・非表示中更新・バックアップ）。ビルド不要の単一HTML。',
  '',
  '② 本番での画面別計測結果',
  '本番の変更前データがないため、以下の全画面の本番短縮率は算出不可。ローカル値で代用しない。',
  ...productionTable,
  '',
  '参考: ローカルHTTPでの比較（本番の改善率ではない）',
  '以下は上限ケース（親200件・各子50件=子10000件）。空/標準、直接アクセス先ごとの操作、メニュー遷移を含む全条件はlocal-results.txt/json、バックアップはlocal-backup-results.txt/json、補足操作はlocal-extended-results.txt/jsonに収録。',
  '画面・操作 | 条件 | 指標 | 前中央値ms | 後中央値ms | 待ち時間短縮率 | 前/後回数 | 判定 | 前min–max / 後min–max ms',
  ...localRows,
  '短縮率=(前中央値−後中央値)÷前中央値×100。負は悪化。サイト全体の単純平均は算出しない。中央値差のbootstrap 95%区間が0を含む場合は改善未確認（1e-6ms以下は浮動小数点誤差として0扱い）。5回の区間は探索的な判断で、因果を厳密に証明するものではない。',
  '',
  '③ 計測と動作確認の根拠',
  '再現: Node.js22で node performance/serve-benchmark.mjs。localhost:49187の?version=baseline-fresh / ?version=optimized-finalで計測開始→各90試行。集計node performance/summarize-final.mjs。バックアップはversion=baseline-fresh-backup / optimized-final-backup&suite=backup、各30試行。標準ケースはbaseline-backup-extra20 / optimized-backup-extra20&suite=backup&parents=20&children=5で各10試行を追加（その条件は初期/再アクセスそれぞれ10回へ増加）。merge-backup-extra.mjsで結合後summarize-final-backup.mjsで集計。補足はREADME参照。',
  '環境: 同じMac・Codex IAB（Chrome155）、iframe1280×900、localhost HTTP、帯域/CPUの人工制限なし。生JSONにuserAgent・viewport・UTC日時・各操作値・seedMsを保存。各試行でiframeを新規作成。ネットワーク/外部CPU/GC/OSスケジューリングを完全には制御できない。',
  'キャッシュ: 全HTTP応答no-store。initial=新しい隔離perf保存領域・localStorage fixture・空IndexedDB。repeat=同じ領域で保存確定後のlocalStorage/IndexedDB。ブラウザHTTPキャッシュの初回/再読込ではない。CDN/本番サーバーキャッシュは未検証。repeatは前回の集中実績（paused）を含むためinitialと分離。',
  '開始: 直接アクセスはdocument生成のperformance.timeOrigin（同じfixture準備seedMsを含む）。画面遷移/編集/集中/バックアップは実処理ハンドラ呼出開始、検索はinputイベント送出開始。物理マウス入力の遅延は測っていない。',
  '終了: 全件数/対象名称/保存確定/表示ルート/検索一致件数/ダイアログ/集中状態/バックアップ復元件数をassertし、二重requestAnimationFrameで表示を確認。loadイベント/通信終了は完了点に使わない。主要内容表示と操作可能を別指標に記録するが、このアプリでは初期化と描画後の安全な操作完了点をともに採用したため、報告値は同じ。描画前readyMsは参考の生値で、利用者の操作可能時間として流用しない。',
  '代表条件: 空0/0、標準20×5、上限200×50、完了/未完了混在。検索API（NFKC/大小文字正規化）で各親の半数の子が一致。親/子はp0/s0_0で子0/5/50件の代表。親のみ20×0の補足はlocal-solo-results.txt/jsonに収録。内容・順序・件数は前後同じ。URLに利用者IDがなく、動的URLの集約は不要。認証/権限区分は現行ローカルアプリにない。通常のyatta保存キー/DBは使わず、perf専用領域を使用。',
  '検証: npm test（performance/final-tests.log）、/functional-qa（browser-functional-final-raw.json）。既存テストは保存世代・競合・破損・部分失敗・バックアップ・Undo・検索・入力・ドラッグ/キーボード・タイマーを含む。ブラウザではSVGの名前/複製独立性/DOM再利用、NFKC検索/完了フィルタ/一括削除防止、エスケープ、親子編集、集中開始/保存失敗/一時停止/完了、保存直後表示、空、非表示中更新/取込後の最新表示を確認。',
  '生値: browser-baseline-fresh-raw.json / browser-optimized-final-raw.json、バックアップの対応raw/combined-rawとextended/soloの対応raw。各集計JSONにn・中央値・min/max・Q1/Q3・全値・差の区間を保存。old baseline/optimized/profile/inline/lazy各JSONは探索的計測で最終比較に混ぜない。初期の失敗計測とextendedの定期保存中の操作拒否/cleanup失敗はinvalid記録として保持し、集計から除外。extendedでは操作開始から背景保存ロックの解除待ちを含め、開始状態と最終paused保存を検証して再計測した。',
  '未計測の条件: 本番全条件、実機スマートフォン、HTTP warm/CDN、実利用分布のp95、長文メモ/多数メッセージ、親編集内からの子編集の待ち時間。対応機能の回帰確認と、条件別の性能計測は区別している。',
  '',
  '④ 変更内容と残る課題',
  '1. アイコン初期化を全document走査から初期静的UIと新しいタスク行に限定。SVG構造はpublicなアイコン名のテンプレートを複製。表示済み行のSVGとDOMを維持し、描画・検索・編集を軽くする。キャッシュに利用者データ/権限/検索結果は入れない。',
  '2. 検索語と子の名称の正規化の重複を削減。空検索は即通過。NFKC・大小文字・親一致時の子表示・状態フィルタの仕様を維持する。',
  '3. メモ/設定で非表示のタスクDOM生成を延期。データ復元・正規化・世代照合・全親集計・進捗/faviconは維持。tasksDirtyで次に一覧を開く前に最新モデルを同期描画し、データ不足や古い表示を防ぐ。最初の一覧遷移も計測し、後続への単なる待ち時間移動かを確認する。',
  '4. content-visibility:autoを親カードへ適用。全件DOM・検索・フォーカスは維持し、画面外のレイアウトと描画をブラウザへ延期。子件数からの概算高さを使い、表示後はブラウザが実寸を記憶する。非対応ブラウザは従来描画へフォールバック。描画前のスクロールバー寸法は概算で、表示時に調整される。末尾表示・画面外編集・キーボード並び替え・親子ドラッグイベント・390px幅を確認。',
  '5. 集中開始時の保存ロックをオーバーレイの初回描画まで維持し、背景のinert解除→フォーカス復元→再ロックを減らす。失敗時は既存の巻き戻し後に両ロックを解除。テーマ属性は値が変わるときだけ更新。',
  '確認事実: 全体hydrateと全件タスクDOM生成が表示完了の経路にあり、プロファイルで時間を消費。最大件数のDOM生成・保存復元の処理が残る。推論: inert/disabled変更後のフォーカス可視性判定はレイアウトを強制する可能性がある。GCやOS負荷が個々の外れ値の原因という断定は未検証。',
  '候補比較: 不要な走査/重複正規化と非表示DOMは広く効き、外部運用コストなし・単一HTMLで容易に戻せるため優先。集中ロックは表示/データの仕様を変えず、失敗/競合/フォーカス検証を追加。SVG文字列の直接埋込候補は実測で最初の一覧遷移が遅くなり不採用。画面外のブラウザ描画省略は大幅な効果を確認し採用。DOM仮想化は全件表示・並び替え・キーボード・検索への影響が大きく、今回不採用。',
  'データキャッシュは更新反映・保存世代の正しさを損なうため追加せず、既に同一IndexedDBトランザクション内で並列取得済みの処理を維持。API/画像/外部JSの通信やDBサーバーは現行版にない。圧縮/CDN設定は配信先未特定のため未検討。',
  '標準データの設定直接表示（バックアップ手順・initial）は追加10回でも41.55→43.05ms（−3.6%、+1.5ms）の小さい悪化傾向。メイン手順の同条件はばらつき内で改善未確認。差の原因は未特定で、改善と報告しない。上限ケースの大幅短縮と機能検証を優先して採用版を保持したが、この小差は残る課題として記録する。',
  '残る待ち時間: 10000件の全DOM生成、全件集計と保存/復元、集中操作時の全開始ボタン制御。画面外描画はCSSで省略済み。大幅な追加短縮には表示構造/レンダラの変更が必要で、現状仕様維持との影響を別途検証する必要がある。推定の追加効果を実測値として示していない。',
  'CSSの挙動の一次資料: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility （autoはDOM/アクセシビリティツリー・ページ内検索・フォーカスを維持する）。',
  '復旧: ローカルはperformance/baseline.htmlをyaruyan-todo.htmlへコピー（今回の性能変更だけを取り消す基準）。Git HEADへ戻すと現行の検索等の機能も失うため使用しない。本番は実際の変更前配信版を先に保存し、既存の通常手順で戻す。データ不整合・主要操作不能・比較条件を揃えた明確な悪化が復旧判断条件。保存形式は変更していない。',
  '未完了と再開条件: 本番URLまたはローカルファイル配布が本番である旨、通常の更新・復旧手順が必要。それを確認後、現行本番の変更前計測を保存→必要な既存承認/反映→配信版確認→主要機能確認→全対象条件の本番再計測→画面別の実測短縮率報告を実施する。',
];
fs.writeFileSync('performance/investigation.txt', lines.join('\n') + '\n');
investigation.status =
  'ローカル実装・計測・検証完了。本番未反映・本番未検証・本番全対象画面未計測';
investigation.finalLocalVersionSha256 = sha('yaruyan-todo.html');
investigation.tests.final = { pass: 253, fail: 0, log: 'final-tests.log' };
investigation.tests.browser = {
  pass: 40,
  fail: 0,
  log: 'browser-functional-final-raw.json',
};
investigation.finalMainDates = {
  before: dates(rawBefore),
  after: dates(rawAfter),
};
fs.writeFileSync(
  'performance/investigation.json',
  JSON.stringify(investigation, null, 2) + '\n',
);
console.log('performance/investigation.txtを更新');
