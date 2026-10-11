# 操作・計測対象一覧（2026-10-10）

URLは配布HTMLの `#/tasks`・`#/memo`・`#/settings`。本番URLは未特定。3画面、下記55操作のコード経路を一覧化した。連続キー入力・実IME・ネイティブタッチ・端末別は代表条件を共有できないため追加検証が必要。実装のない認証・組織分離・サーバー同期・ページング・ズーム・アップロードAPIは対象外。データは保存領域ごとに分離する。

|ID|画面|操作|前提・期待結果|関連コード|今回の時間計測|
|---|---|---|---|---|---|
|01|全画面|直接アクセス|保存状態を復元し対象ページを操作可能にする|_initializePersistentStorageState, renderRoute|tasks最終版実施、memo/settings直アクセスは不要コード削除前の別版|
|02|全画面|再読み込み|確定済みIndexedDBとlocalStorageを照合|同上|initial/repeatを分離、HTTPキャッシュ比較ではない|
|03|全画面|ナビゲーション|tasks/memo/settingsを切替、見出しフォーカス・先頭スクロール|navigate, renderRoute|実施|
|04|全画面|戻る・進む|hashchangeで同じ経路を通る|getRouteFromHash, navigate|未計測、代表遷移でコード経路共有|
|05|全画面|Altショートカット|画面移動・入力・設定切替|handleDocumentShortcuts|時間未計測、回帰テスト|
|06|全画面|本文へ移動|ハッシュを変えず本文にフォーカス|skip link binding|時間未計測|
|07|全画面|サイドバー折りたたみ|設定保存と画面幅の境界更新|toggleSidebar, applySidebarState|時間未計測|
|08|全画面|ツールチップ表示・解除|hover/focus、Escape、scroll、resize追従|handleTooltip*, _queueQuickTooltipPosition|時間未計測、回帰テスト|
|09|tasks|親追加|上限・入力検証、成功後検索解除、保存失敗は入力保持|addTask|時間未計測、ブラウザQA|
|10|tasks|追加欄入力・貼り付け|文字数、カーソル、120文字超を保持|bindTextLengthHint, bindInputEnter|時間未計測、回帰テスト|
|11|tasks|日本語変換確定|変換中のEnter等を抑制|bindInputEnter, handleTaskSearchInput|OS実IME未計測、合成イベントテスト|
|12|tasks|検索入力|NFKC・大小文字・空白を正規化、完全な結果|handleTaskSearchInput, getFilteredSubtasks|実施|
|13|tasks|検索解除|ボタン/Escapeで全結果を復元|resetTaskSearch, render|実施、操作経路は入力イベントの代表|
|14|tasks|完了フィルタ|all/pending/completed、件数と保存値が一致|setTaskFilter|20×5の初回/繰り返し実施|
|15|tasks|一括メニュー開閉|Escape、外側クリック、Tabで閉じる|closeBulkActions|時間未計測、回帰テスト|
|16|tasks|親編集を開く|全子タスク・未保存の親名を表示|openParentModal|実施|
|17|tasks|親名保存|120文字以内の名前だけ保存、子追加下書き保持|saveParentEdit|実施、編集を開く時間を含む|
|18|tasks|親編集を閉じる|未保存確認、フォーカス復帰|closeParentModal|時間未計測、ブラウザQA|
|19|tasks|子追加|上限・入力を確認し即時保存|addSubtaskFromModal|時間未計測、回帰テスト|
|20|tasks|子編集を開く|選んだ子の名前を表示|openSubtaskModal|実施|
|21|tasks|子名保存|名前を保存し親子の状態を維持|saveSubtaskEdit, renderTasks|実施、編集を開く時間を含む|
|22|tasks|子編集を閉じる|未保存確認、入れ子フォーカス復帰|closeSubtaskModal|時間未計測、ブラウザQA|
|23|tasks|親削除|確認後保存、失敗時復元|performDeleteParent|時間未計測、回帰テスト|
|24|tasks|子削除|確認後保存、最後の子削除で親を未完了にする|performDeleteSubtask|時間未計測、回帰テスト|
|25|tasks|完了一括削除|確認件数が実処理と一致、検索時禁止|performClearCompleted|時間未計測、回帰テスト|
|26|tasks|全削除|確認・保存・Undoデータ保持|performClearAll|時間未計測、回帰テスト|
|27|tasks|削除Undo|世代を確認し重複せず復元|_applyDeleteUndoPayload|時間未計測、回帰テスト|
|28|tasks|親ドラッグ|開始・移動・drop・保存、可変高さ対応|resolveDropIntentByClientY, reorderParentTasks|移動先計算の補助実験、実ドラッグ4区間は未計測|
|29|tasks|子ドラッグ|同じ親内で順序保存|同上, reorderSubtasks|時間未計測、ブラウザQA|
|30|tasks|編集内子ドラッグ|未保存名を維持して並べ替え|modalSubtaskList drag bindings|時間未計測、回帰テスト|
|31|tasks|親キーボード並べ替え|表示条件内でAlt+矢印、保存順維持|_moveFocusedTaskRowByOffset|時間未計測、ブラウザQA|
|32|tasks|子キーボード並べ替え|表示条件と編集内の全順序を区別|同上|時間未計測、回帰テスト|
|33|tasks|編集の上下移動|保存順、境界無効化、名前下書き維持|moveEditorTask|時間未計測、回帰テスト|
|34|tasks|スクロール|1万子DOMの末尾へ移動し編集可能|content-visibility, focusin binding|20×5の末尾/先頭到達代理時間実施、上限QA|
|35|tasks|集中開始|保存確定後に対象をロックして表示|openFocusModal|実施|
|36|tasks|集中一時停止|実績を確定し集中画面維持|pauseOrResumeFocus|20×5実施|
|37|tasks|集中再開|現在の対象の計測を再開|同上|20×5実施|
|38|tasks|集中完了|時間と完了状態を保存、閉じる|completeFocus|時間未計測、ブラウザQA|
|39|tasks|集中中断|確認後の中断契約・保存失敗復元|performAbortFocus|時間未計測、回帰テスト|
|40|tasks|完了取り消し|親子状態と計測値を保つ|undoCompleted|時間未計測、回帰テスト|
|41|tasks|タイマー・ポモドーロ周期|残時間・累積時間・通知と定期保存|updateFocusTimer, syncPomodoroPhaseProgress|時間未計測、回帰テスト|
|42|memo|入力・貼り付け|1万文字制限、保存状態表示|handleOrganizeMemoInput|時間未計測、回帰テスト|
|43|memo|自動保存・blur保存|pointer/IMEを妨げず確定、失敗復元|flushOrganizeMemoSave, _waitFor*|時間未計測、回帰テスト|
|44|settings|明暗変更|即時配色、設定保存、失敗復元|applyColorMode, _commitStateSave|時間未計測|
|45|settings|テーマ変更|配色・選択状態・保存|setThemeColor|時間未計測|
|46|settings|効果音設定|音の有無を保存|soundToggle binding|時間未計測|
|47|settings|お祝い設定|演出の有無を保存|celebrationToggle binding|時間未計測|
|48|settings|ポモドーロ設定|有効・分数・入力検証・保存|commitPomodoroSettingsFromControls|時間未計測、回帰テスト|
|49|settings|完了メッセージ追加|上限と1件以上維持|saveMessage|時間未計測、回帰テスト|
|50|settings|メッセージ編集・保存|全文入力保持、80文字超は保存拒否|editMessage, saveEditedMessage|時間未計測、ブラウザQA|
|51|settings|メッセージ削除|最後の1件を削除しない|deleteMessage|時間未計測、回帰テスト|
|52|settings|バックアップ書出し|全状態のJSON、URL解放|exportBackup|時間未計測、回帰テスト|
|53|settings|バックアップ読込・確認|サイズ・形式検証、確認まで既存データ不変|importBackupFile|20×5の確認までを初回/繰り返し実施|
|54|settings|バックアップ確定・Undo|原子的な保存、競合・失敗・取消|performImportBackup, Undo action|確定は20×5実施、Undo時間未計測|
|55|全画面|離脱・非表示・別タブ競合・再試行|未確定checkpoint照合、他タブ上書き防止|persistRuntimeStateForUnload, _saveStoredState|時間未計測、回帰テスト|

計測共通条件: localhost、Mac、1280×900 iframe、通常20親×5子と上限200親×50子、権限なし、架空データ・専用ストレージ。直接表示・検索等の結果確定をコードで検証してから二重rAFを待つ。これは描画トレースに代わる代理値であり、初期反応・実描画・INPを測ったことにはしない。保存メトリクスは既存の保存完了契約を含む関数のawait完了で、再読み込み後の保存内容はrepeatと機能QAで確認する。

時間計測の実施有無と回数はcomparison.jsonを参照。時間未計測の操作を既に速いと判断して除外していない。本番は全55操作未計測。
