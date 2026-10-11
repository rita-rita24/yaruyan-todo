import fs from 'node:fs';
import crypto from 'node:crypto';
const hash = (p) =>
  crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const results = [
  'results',
  'extended-results',
  'backup-results',
  'solo-results',
  'confirmation-results',
].map((name) => ({
  name,
  ...JSON.parse(fs.readFileSync(`performance/round2/${name}.json`)),
}));
const rawFiles = [
  'round2-before-paired-chrome-shell-main',
  'round2-after-paired-chrome-shell-main',
  'round2-before-paired-chrome-extended',
  'round2-after-paired-chrome-extended',
  'round2-before-paired-chrome-backup',
  'round2-after-paired-chrome-backup',
  'round2-before-paired-chrome-solo',
  'round2-after-paired-chrome-solo',
  'round2-before-paired-chrome-final-confirm',
  'round2-after-paired-chrome-final-confirm',
];
const raw = rawFiles.flatMap((name) =>
  JSON.parse(fs.readFileSync(`performance/browser-${name}-raw.json`)),
);
const qa = JSON.parse(
  fs.readFileSync('performance/browser-round2-functional-raw.json'),
).slice(-2);
const versions = {
  baseline: hash('performance/round2/baseline.html'),
  adopted: hash('performance/round2/rejected-reuse.html'),
  timingBeforeFocusCSS: hash('performance/round2/measured-shell.html'),
  measurementSeries: {
    screenAndExtendedBackupSolo: {
      source: 'performance/round2/measured-shell.html',
      sha256: hash('performance/round2/measured-shell.html'),
    },
    confirmation: {
      source: 'performance/round2/rejected-reuse.html',
      sha256: hash('performance/round2/rejected-reuse.html'),
    },
  },
  dateRange: [
    raw.map((x) => x.date).sort()[0],
    raw
      .map((x) => x.date)
      .sort()
      .at(-1),
  ],
  rawFiles,
  qa,
  production: {
    url: null,
    deployed: false,
    verified: false,
    reason:
      '本番URL・配置先・通常のリリース手順をリポジトリと会話から特定できない。確認を依頼済み。',
  },
};
fs.writeFileSync(
  'performance/round2/candidate-versions.json',
  JSON.stringify(versions, null, 2) + '\n',
);
const selected = [
  ...results[4].rows.filter(
    (r) =>
      r.condition === '200x50|tasks|initial' &&
      ['direct', 'search', 'search-clear', 'focus-start'].includes(r.operation),
  ),
  ...results[1].rows.filter(
    (r) =>
      r.condition === '200x50|tasks|initial' &&
      ['filter-completed', 'filter-all', 'scroll-last'].includes(r.operation),
  ),
];
const table = (rows) => [
  '|画面・操作|条件|指標|前中央値 ms|後中央値 ms|短縮率|回数 前/後|判定|',
  '|---|---|---|---:|---:|---:|---|---|',
  ...rows.map(
    (r) =>
      `|${r.operation}|${r.condition}|${r.metric}|${r.before.medianMs.toFixed(1)}|${r.after.medianMs.toFixed(1)}|${r.reductionPercent.toFixed(1)}%|${r.before.n}/${r.after.n}|${r.judgement}|`,
  ),
];
const regressions = results.flatMap((x) =>
  x.rows
    .filter((r) => r.judgement === '悪化' && r.metric === '主要内容の表示')
    .map((r) => ({ suite: x.name, ...r })),
);
const report = [
  '# 読み込み高速化・追加改善（第2回）',
  '',
  '## ① 実施結果',
  '',
  'この記録は採用を取り消した候補の調査記録。現行状態はinvestigation.txtを参照。前回の改善版を基準として再調査・実装・ローカル再計測を実施。検索・フィルタで、内容が変わっていない子行を付け替えて再利用し、親の外枠は必要時に更新する。必要な情報・件数・操作を減らしていない。',
  '**本番未反映・本番未検証・本番の全対象画面未計測。** 本番URLと通常の配置・リリース手順が未特定であり、本番での改善率は算出不可。追加実装を本番反映済みと扱わない。リポジトリ内に本番URL、デプロイ設定、リリースコマンドは見つからず、ユーザーへ必要情報を確認済み（回答待ち）。',
  `計測日時（UTC）: ${versions.dateRange.join(' ～ ')}。日本時間は +9時間。`,
  `基準SHA256: \`${versions.baseline}\`。追加改善版SHA256: \`${versions.adopted}\`。Git HEADではなく、ユーザーが復元したコードに前回改善を適用した版を基準に固定した。`,
  '',
  '## ② 本番での画面別結果',
  '',
  '|対象画面・URL|条件|指標|前中央値 ms|後中央値 ms|短縮率|回数 前/後|判定・備考|',
  '|---|---|---|---|---|---|---|---|',
  ...['タスクリスト #/tasks', '整理メモ #/memo', '設定 #/settings'].flatMap(
    (route) =>
      ['0親×0子', '20親×5子', '200親×50子'].flatMap((data) =>
        ['初回', '再読み込み'].flatMap((cache) =>
          ['主要内容の表示', '操作可能'].map(
            (metric) =>
              `|${route}（本番URL未特定）|${data}・${cache}・PC|${metric}|未計測|未計測|算出不可|0/0|本番アクセス先未特定|`,
          ),
        ),
      ),
  ),
  '',
  '関連操作: 画面内遷移、検索・解除、完了/全件フィルタ、親編集、子編集、集中開始/一時停止/再開、末尾・先頭スクロール、設定のバックアップ読込確認/取込。いずれも本番未計測。動的URLはなく、親・子モーダルはIDごとの共通処理のため、先頭の代表IDを性能計測、末尾IDを機能確認で検証した。子なし単独タスク20件の親集中開始も別条件で計測した。',
  '',
  '### ローカル実測（本番の改善率ではない）',
  '',
  '今回の変更前後を同じ定義で比較した値。以下は最大件数・初回の抜粋。主要な初期/検索結果はフォーカスCSS修正後の最終確認、フィルタ結果は外枠修正後・フォーカスCSS追加前の比較であり、別系列として扱う。全画面・全条件と負の値を含む全結果は results.txt、extended-results.txt、backup-results.txt、solo-results.txt、confirmation-results.txt に保存。',
  '',
  ...table(selected),
  '',
  '短縮率 = (前 − 後) ÷ 前 × 100。描画完了を共通の安全な終了点にしたため、主要内容の表示と操作可能は別指標として同じ値になる。検索/フィルタ/取込は必要な結果の指標も別行に保存。',
  '',
  '### 悪化と改善未確認',
  '',
  '連続全画面比較で負の差が出た空データ設定・20親×5子のタスクと設定・200親×50子の設定とタスク・子なし親20件を、新規タブに分けて前後各5回、フォーカスCSS修正後に追加比較した。confirmation-results に保存。元の比較に混ぜず、差が再現するかを別表で確認する。',
  ...table(
    results[4].rows.filter(
      (r) =>
        r.metric === '主要内容の表示' &&
        [
          'direct',
          'navigate-memo',
          'navigate-tasks',
          'parent-edit',
          'search',
          'search-clear',
        ].includes(r.operation),
    ),
  ),
  '',
  ...(regressions.length
    ? table(regressions)
    : ['探索的95%区間で明確な悪化を示した条件はない。']),
  '0を含む探索的95%区間の差は改善未確認。単なる中央値の差を確実な改善と扱わない。対象画面・条件の率を平均して全体改善率を作っていない。',
  '',
  '## ③ 計測・動作確認の根拠',
  '',
  `本計測: ${results.reduce((n, x) => n + x.beforeRuns, 0)}試行前 / ${results.reduce((n, x) => n + x.afterRuns, 0)}試行後。各条件5回以上。フォーカスCSS追加前の140/140試行と、追加後の確認試行は別系列。候補比較と機能QAは本計測に混ぜていない。使用ブラウザ: ${raw[0].userAgent}。同じMac・Chrome154、通常計測iframe1280×900、通信localhost、HTTP Cache-Control:no-store。サーバー/CDNキャッシュは存在しない。実機スマホと本番負荷は未計測。`,
  '開始点: 直接アクセスはnavigation timeOrigin、遷移・検索・フィルタ・モーダル・取込は処理開始直前。終了点: 保存復元完了、正しい件数/検索結果/表示対象/モーダルの準備を確認し、2回のrequestAnimationFrameを待った時点。loadイベントや通信終了だけを完了にしない。メモは正しい値と編集可能状態、設定は設定値と全テーマボタン、集中は対象IDとオーバーレイ状態を確認。',
  '初回は新規検証名前空間・fixture localStorage・空IndexedDB。再読み込みは同じ名前空間で保存後のlocalStorage/IndexedDBを再利用し、新しいiframeで計測。検証fixtureは0/0、20親×5子、上限200親×50子（10,000子）、単独20親。子の約1/3完了、半数が全角ＡＰＩ、メモ固定、音/祝い演出無効。再読み込みには前試行の一時停止実績が含まれるため初回とは混ぜない。fixture生成時間は生値seedMsに残し、直接表示時間にも含む。個人の保存領域とは隔離。最終比較では各repeatの全計測・保存が終わってから検証DBを閉じて削除する（initialからrepeatまでは保持）。第2回の途中で生成した270個の検証DBを整理した。測定時間には片付けを含めない。',
  '各結果JSONに生値、中央値、最小/最大、Q1/Q3、同じ試行順序の前後を対応させた探索的bootstrap中央値差95%区間を保存。GCや外部CPU負荷は完全制御できない。特に小さい差は未確認とする。十分な本番実利用データは得られていない。',
  `Nodeテスト253件すべて通過。追加改善版ブラウザQA: ${qa.map((q) => `${q.viewport.join('×')}で${q.checks.length}項目、失敗${q.failed}`).join(' / ')}。検索のNFKC・フィルタ交差・空結果・件数・エスケープ、キャッシュ再利用、非表示中の編集/完了/並び順の更新、全削除時のキャッシュ解放、集中保存成功/失敗、鍵盤フォーカス、バックアップ、画面非表示中の更新/取込、10,000件DOM保持、末尾スクロール、親子編集、キーボードとドラッグ並べ替えを確認した。`,
  '再現: node performance/serve-benchmark.mjs → ?compare=chrome-shell-main でCSSフォーカス追加前の版を前後交互に計測（試行ごとに先行版を入れ替える）。拡張は ?compare=chrome-extended&suite=extended&parents=200&children=50&route=tasks、バックアップは ?compare=chrome-backup&suite=backup、単独親は ?compare=chrome-solo&parents=20&children=0&route=tasks。最終確認は ?compare=chrome-final-confirm&parents=200&children=50&route=tasks（他条件はconfirmation-resultsの件数/直接先に置換）を条件ごとに新規タブで実行。単独版の再現は http://127.0.0.1:49187/?version=round2-before-paired-chrome-shell-main（基準スナップショット）または ?version=round2-after-paired-chrome-shell-main（時間計測時の固定スナップショット）で計測開始。suite=extended&parents=200&children=50&route=tasks、suite=backup（3件数×settings）、parents=20&children=0&route=tasks（単独親）も実行。再計測時はversion末尾を変更して生値を上書きしない。集計: node performance/round2/summarize.mjs と summarize-{extended,backup,solo}.mjs。QA: node performance/round2/create-functional-qa.mjs → /functional-qa と /functional-narrow。',
  '',
  '## ④ 変更内容・残る課題',
  '',
  '確認した原因: 前回の実装は検索やフィルタが変わると親行全体のinnerHTML生成とSVG変換を繰り返し、非表示行をキャッシュから落としていた。部分表示の変化が、変化していない親ヘッダーと子行まで再生成させていた。',
  '採用: 狭い画面で長い画面外行をフォーカスした時にボタンが画面外に残るケースを確認したため、focus-withinの行はcontent-visibility:visibleにして通常描画する。390px幅の49項目で修正を確認した。親ごとの全件表示スナップショットと子DOMを保持し、全件の表示キーがモデルと一致する場合だけ既存の子行を付け替える。親の軽い外枠は複製し、content-visibilityの以前の実測高さをリセットする。移動前のフォーカスを保存し、DOM反映後に同じ子操作または既存のフォーカス復帰先へ戻す。検索結果と順序は毎回最新モデルから求める。親/子のID、名称、完了、集中状態、表示実績時間と順序が変われば再生成する。保存データのキャッシュ、保存順序、ストレージ復元、更新反映の時点は変更しない。',
  '初期表示への負担を抑えるため、子DOMのMap作成は最初の絞り込み時に遅延する。キャッシュがなければ全件照合を省き、全件表示時は既に作ったキーを使う。キャッシュは各親で現在と全件の2表現まで。通常は同じDOMを共有するが、編集中の部分表示と古い全件表示は一時的に別DOMを保持する。削除親は次回renderで保持しない。空検索結果でも既存親のキャッシュを保持するためメモリとの交換条件がある。',
  '見送り: 親をそのまま使う子行再利用候補は、表示件数が正しくても検索後の画面外に古い高さが残ることを確認した（全件3,707px→1子に絞っても3,707px）。外枠更新後は約120pxになり、表示時126.7pxと整合する既存の推定サイズ動作へ戻した。生値は browser-round2-intrinsic-probe-raw.json。直接SVG HTML方式も現行のCSS・外枠修正を含む版で再評価したが、初回中央値612ms→775ms、再読み込み670ms→1,040msで遅く、採用しない。プロファイルのrenderTasks中央値も初回247ms→409msで増え、アイコン走査削減だけでは全体が速くならなかった。一覧全体のDOMだけを保持する候補は、JS完了時間が減っても描画後の実測改善が安定しなかった。子Mapを初回から作る候補は検索が速くなったが、初期表示負担を避けるため遅延方式を選んだ。候補コードと対応する生結果を保存し、採用版と混合しない。外枠修正前のChrome測定も採用版とは分ける。連続測定では変更していない画面まで後半に遅くなったため、ブラウザを開き直した交互比較を最終比較とし、最初の連続比較は診断用に分離した。IABで一部の検証タブが閉じ切れておらず、端末のスワップ使用8,647MBと大きいRendererメモリを確認した。残った検証タブは全て終了を確認。その後Chrome154で新たに前後を交互に測定し、さらに条件ごとに新規タブで追加確認した。IAB155の連続・交互・新規タブの測定値とは混合しない。IABの変動すべてをタブ残留だけで説明できるかは未確定。',
  '残る遅延: 初回10,000件のHTML/SVG生成・ストレージ復元・初期レイアウト、部分表示中にモデル内容が変わった場合の再生成、検索解除で大量の既存行を戻す際のレイアウト。今回の方式で初回表示まで速くなったとは一律に主張しない。5回の比較で小差まで採否を決めることはできず、追加確認でもばらつきが残る。初期表示に有効な候補は複数検証して見送ったが、仮想化など未検証の大きい候補も残るため、最大限の高速化を達成したとは扱わない。個々の子行だけ更新する方式や仮想化は候補だが、さらなる設計・操作/スクロール検証が必要であり、追加効果は未実測。',
  `時間計測版SHA256（フォーカスCSS追加前）: ${versions.timingBeforeFocusCSS}。最終確認は追加改善版SHA256を使用。フォーカスCSS追加後のメモ初期表示・バックアップ等の全条件再計測は未実施であり、以前の系列を最終版の実測と置き換えない。`,
  '復旧: performance/round2/baseline.html を yaruyan-todo.html に戻せば前回改善版へ戻る。今回の変更に保存スキーマ変更はない。本番では公開版の一致を確認し、表示/件数/更新/操作の不具合、明確な待ち時間悪化があれば通常の手順で基準版へ復旧する。配置先・手順を確認するまでは本番反映を行えない。',
  '',
  '保存先: 本フォルダの versions.json、loading-changes.patch、unit-tests.txt、各*-results.{json,txt}、再現スクリプト。生結果は親performanceフォルダの browser-round2-*-raw.json。第1回の基準・結果は上書きしない。',
];
fs.writeFileSync(
  'performance/round2/candidate-comparison.txt',
  report.join('\n') + '\n',
);
console.log(
  JSON.stringify(
    {
      before: versions.baseline,
      after: versions.adopted,
      regressions: regressions.map((r) => ({
        suite: r.suite,
        condition: r.condition,
        operation: r.operation,
        percent: r.reductionPercent,
      })),
      selected: selected
        .filter((x) => x.metric === '主要内容の表示')
        .map((r) => ({
          operation: r.operation,
          before: r.before.medianMs,
          after: r.after.medianMs,
          percent: r.reductionPercent,
          judgement: r.judgement,
        })),
    },
    null,
    2,
  ),
);
