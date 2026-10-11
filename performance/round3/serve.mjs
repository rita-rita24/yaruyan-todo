import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const results = [];
const fixture = (parents, children) =>
  Array.from({ length: parents }, (_, i) => ({
    id: `p${i}`,
    text: `親タスク ${i} プロジェクト`,
    done: false,
    subtasks: Array.from({ length: children }, (_, j) => ({
      id: `s${i}_${j}`,
      text: `子タスク ${j} ${j % 2 ? '資料' : 'ＡＰＩ'}検証`,
      done: j % 3 === 1,
    })),
  }));
const marker = '      navigate(getRouteFromHash());\n    })();';
function app(url) {
  const version = url.searchParams.get('version') || 'baseline',
    group = url.searchParams.get('group');
  const parents = Number(url.searchParams.get('parents')),
    children = Number(url.searchParams.get('children'));
  const prefix = 'perf-' + group;
  const sourcePath = version.startsWith('round3-before')
    ? 'performance/round3/baseline.html'
    : version.includes('adopted')
      ? 'performance/round3/adopted.html'
      : 'performance/round3/candidate.html';
  const source = fs.readFileSync(path.join(root, sourcePath), 'utf8');
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  let html = source.replaceAll('yatta-spa', prefix);
  const seed = url.searchParams.get('cache') === 'initial';
  const data = fixture(parents, children);
  const pre = `<script>const seedStart=performance.now(); ${seed ? `for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('perf-'))localStorage.removeItem(key);}document.documentElement.dataset.storageKeys=JSON.stringify({length:localStorage.length,keys:Object.keys(localStorage),bytes:${JSON.stringify(JSON.stringify(data).length)}});localStorage.setItem('${prefix}-tasks-v8',${JSON.stringify(JSON.stringify(data))});localStorage.setItem('${prefix}-settings-v8','{"sound":false,"celebration":false}');localStorage.setItem('${prefix}-organize-memo-v1','性能検証用メモ');localStorage.setItem('${prefix}-task-view-v1','{"filter":"all"}');localStorage.setItem('${prefix}-sidebar-collapsed-v3','false');` : ''} const seedMs=performance.now()-seedStart; window.__perfSeedMs=seedMs;</script>`;
  html = html.replace('<script>', pre + '<script>');
  let qa = `
      const measured=[];
      const go=route=>{if(getRouteFromHash()===route){navigate(route);return Promise.resolve();}return new Promise(resolve=>{window.addEventListener('hashchange',resolve,{once:true});navigate(route);});};
      const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const check=(ok,label)=>{if(!ok)throw new Error(label);};
      const run=async(name,action,verify)=>{const start=performance.now();await action();verify();const ready=performance.now()-start;await paint();measured.push({operation:name,readyMs:ready,displayMs:performance.now()-start});};
      try {
        check(_persistentStorageInitialized,'storage initialized');
        check(tasks.length===${parents},'parent count');
        check(tasks.reduce((n,t)=>n+t.subtasks.length,0)===${parents * children},'child count');
        check(getRouteFromHash()===${JSON.stringify(url.searchParams.get('route'))},'route');
        const readyMs=performance.now(); await paint();
        measured.push({operation:'direct',readyMs,displayMs:performance.now(),seedMs:window.__perfSeedMs});
        await run('navigate-memo',()=>go('memo'),()=>check(organizeMemoInput.value==='性能検証用メモ'&&!organizeMemoInput.readOnly,'memo ready'));
        await run('navigate-settings',()=>go('settings'),()=>check(!soundToggle.checked&&themeColorGrid.children.length===THEME_PRESETS.length,'settings ready'));
        await run('navigate-tasks',()=>go('tasks'),()=>check(taskList.children.length===${parents},'all parents visible'));
        if(tasks.length){
          await run('search',()=>{taskSearchInput.value='api';taskSearchInput.dispatchEvent(new InputEvent('input',{bubbles:true}));},()=>check(taskList.querySelectorAll('.subtask-item').length===${parents * Math.ceil(children / 2)},'search exact children'));
          await run('search-clear',()=>{taskSearchInput.value='';taskSearchInput.dispatchEvent(new InputEvent('input',{bubbles:true}));},()=>check(taskList.querySelectorAll('.subtask-item').length===${parents * children},'clear exact children'));
          await run('parent-edit',()=>openParentModal('p0'),()=>check(parentEditInput.value===tasks[0].text&&modalSubtaskList.children.length===${children},'parent edit ready'));
          closeParentModal({force:true});
          if(${children}){
            await run('child-edit',()=>openSubtaskModal('p0','s0_0'),()=>check(subtaskEditInput.value===tasks[0].subtasks[0].text,'child edit ready'));
            closeSubtaskModal({force:true});
            await run('focus-start',()=>openFocusModal('subtask','p0','s0_0'),()=>check(focusOverlay.classList.contains('show')&&focusState.subtaskId==='s0_0','focus ready'));
            await pauseOrResumeFocus();
          }else{
            await run('focus-start-parent',()=>openFocusModal('parent','p0'),()=>check(focusOverlay.classList.contains('show')&&focusState.parentId==='p0','parent focus ready'));
            await pauseOrResumeFocus();
          }
        }
        if(tasks.length&&${children}&&${JSON.stringify(url.searchParams.get('suite'))}==='main'){
          await performAbortFocus();
          const originalChildText=getSubtask('p0','s0_0').text, originalParentText=getTask('p0').text;
          await run('child-save',async()=>{openSubtaskModal('p0','s0_0');subtaskEditInput.value='変更した子タスク';await saveSubtaskEdit();},()=>check(getSubtask('p0','s0_0').text==='変更した子タスク','child persisted'));
          await run('parent-save',async()=>{openParentModal('p0');parentEditInput.value='変更した親タスク';await saveParentEdit();},()=>check(getTask('p0').text==='変更した親タスク','parent persisted'));
          openSubtaskModal('p0','s0_0');subtaskEditInput.value=originalChildText;await saveSubtaskEdit();
          openParentModal('p0');parentEditInput.value=originalParentText;await saveParentEdit();
        }
        await save();
        ${url.searchParams.get('cache') === 'repeat' ? `const fixtureDb=await _indexedDbPromise;fixtureDb?.close();await new Promise(resolve=>{const request=indexedDB.deleteDatabase(INDEXED_DB_NAME);request.onsuccess=resolve;request.onerror=resolve;});` : ''}
        await fetch('/result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:${JSON.stringify(version)},group:${JSON.stringify(group)},sourceSha256:${JSON.stringify(sourceSha256)},route:${JSON.stringify(url.searchParams.get('route'))},cache:${JSON.stringify(url.searchParams.get('cache'))},parents:${parents},children:${children},date:new Date().toISOString(),profile:window.__perfProfile||null,userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],measured})});
        parent.postMessage({done:true},'*');
      } catch(error) { await fetch('/result',{method:'POST',body:JSON.stringify({error:error.stack,version:${JSON.stringify(version)},group:${JSON.stringify(group)},measured})});parent.postMessage({done:true,error:error.message},'*'); }
 `;
  if (url.searchParams.get('suite') === 'profile') {
    const init =
      '      syncAllParents();\n      previousAllDoneState = isAllDone();';
    html = html.replace(
      init,
      `      const rendererProfile={renderTasks:[],hydrateMaterialIcons:[]};
      window.__perfProfile=rendererProfile;
      const profileRenderTasks=renderTasks;
      renderTasks=function(...args){const t=performance.now();const value=profileRenderTasks(...args);rendererProfile.renderTasks.push(performance.now()-t);return value;};
      const profileHydrate=hydrateMaterialIcons;
      hydrateMaterialIcons=function(...args){const t=performance.now();const value=profileHydrate(...args);rendererProfile.hydrateMaterialIcons.push(performance.now()-t);return value;};
` + init,
    );
    const start = qa.indexOf("        await run('navigate-memo'");
    const end = qa.indexOf('        await save();', start);
    qa = qa.slice(0, start) + qa.slice(end);
  }
  if (url.searchParams.get('suite') === 'extended') {
    const start = qa.indexOf("        await run('navigate-memo'");
    const end = qa.indexOf('        await save();', start);
    qa =
      qa.slice(0, start) +
      `        const waitIdle=async()=>{const limit=performance.now()+15000;while(isStateSaveOperationPending()||isFocusOperationPending()){check(performance.now()<limit,'background save unlock timeout');await paint();}};
        if(tasks.length&&${children}){
          await run('scroll-last',async()=>{taskList.lastElementChild.querySelector('.subtask-item:last-child').scrollIntoView({block:'end'});await paint();},()=>{const row=taskList.lastElementChild.querySelector('.subtask-item:last-child'),rect=row.getBoundingClientRect();check(rect.height>0&&rect.bottom<=innerHeight+2&&row.dataset.subId==='s${parents - 1}_${children - 1}','last row visible after scroll');});
          await run('scroll-top',()=>window.scrollTo(0,0),()=>check(scrollY===0,'top visible'));
        }
        await run('filter-completed',()=>setTaskFilter('completed'),()=>check(taskList.querySelectorAll('.subtask-item').length===${parents * Math.floor((children + 1) / 3)},'completed filter exact count'));
        await run('filter-all',()=>setTaskFilter('all'),()=>check(taskList.querySelectorAll('.subtask-item').length===${parents * children},'all filter exact count'));
        if(tasks.length&&${children}){
          await waitIdle();await openFocusModal('subtask','p0','s0_0');check(getSubtask('p0','s0_0').focus.focusState==='running'&&focusOverlay.classList.contains('show'),'focus-start preparation');
          await run('focus-pause',async()=>{await waitIdle();await pauseOrResumeFocus();},()=>check(getSubtask('p0','s0_0').focus.focusState==='paused'&&focusOverlay.classList.contains('show'),'focus pause persisted'));
          await run('focus-resume',async()=>{await waitIdle();await pauseOrResumeFocus();},()=>check(getSubtask('p0','s0_0').focus.focusState==='running'&&focusOverlay.classList.contains('show'),'focus resume persisted'));
          await waitIdle();await pauseOrResumeFocus();await waitIdle();check(getSubtask('p0','s0_0').focus.focusState==='paused','cleanup pause persisted');
        }
` +
      qa.slice(end);
  }
  if (url.searchParams.get('suite') === 'backup') {
    const start = qa.indexOf("        await run('navigate-memo'");
    const end = qa.indexOf('        await save();', start);
    qa =
      qa.slice(0, start) +
      `        const backupJson=JSON.stringify(createBackupPayload());
        await run('backup-read-confirm',()=>importBackupFile(new File([backupJson],'benchmark.json',{type:'application/json'})),()=>check(confirmModalOverlay.classList.contains('show'),'backup confirmation ready'));
        await run('backup-confirm-import',()=>executeConfirmedAction(),()=>{check(!confirmModalOverlay.classList.contains('show'),'confirmation closed');check(tasks.length===${parents}&&tasks.reduce((n,t)=>n+t.subtasks.length,0)===${parents * children},'import exact count');check(organizeMemoInput.value==='性能検証用メモ','import memo');});
` +
      qa.slice(end);
  }
  if (!html.includes(marker)) throw Error('marker missing');
  return html.replace(
    marker,
    '      navigate(getRouteFromHash());\n' + qa + '    })();',
  );
}
const runner = `<!doctype html><meta charset="utf-8"><h1>読み込み性能検証</h1><p id="status">待機</p><button id="start">計測開始</button><iframe id="app" style="width:1280px;height:900px"></iframe><pre id="results"></pre><script>
const params=new URLSearchParams(location.search);const version=params.get('version')||'baseline';const suite=params.get('suite')||'main';const status=document.getElementById('status');let busy=false;
start.onclick=async()=>{if(busy)return;busy=true;start.disabled=true;const errors=[];let count=0;
for(const [parents,children] of (params.has('parents')?[[Number(params.get('parents')),Number(params.get('children'))]]:[[0,0],[20,5],[200,50]]))for(const route of (params.has('route')?params.get('route').split(','):suite==='backup'?['settings']:['tasks','memo','settings']))for(let n=0;n<Number(params.get('trials')||5);n++){for(const version of (params.get('compare')==='markup-profile'?(n%2?['round2-markup-profile','round2-shell-profile']:['round2-shell-profile','round2-markup-profile']):params.has('compare')?(n%2?['round3-after-'+params.get('compare'),'round3-before-'+params.get('compare')]:['round3-before-'+params.get('compare'),'round3-after-'+params.get('compare')]):[params.get('version')||'baseline'])){const group=version+'-'+parents+'-'+route+'-'+n+'-'+Date.now();for(const cache of ['initial','repeat']){status.textContent=version+' '+parents+'x'+children+' '+route+' '+cache+' '+n;await new Promise(resolve=>{const previous=document.getElementById('app');const replacement=document.createElement('iframe');replacement.id='app';replacement.style.cssText=previous.style.cssText;previous.replaceWith(replacement);const handler=e=>{if(e.source!==app.contentWindow)return;window.removeEventListener('message',handler);if(e.data.error)errors.push(e.data.error);resolve();};window.addEventListener('message',handler);app.src='/app?'+new URLSearchParams({version,parents,children,route,cache,group,suite})+'#/'+route;});count++;}}}
status.textContent='完了 '+count+'件 エラー '+errors.length;results.textContent=JSON.stringify(await(await fetch('/results?version='+version)).json());};</script>`;
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1:49188');
      res.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/result') {
        let body = '';
        for await (const part of req) body += part;
        const result = JSON.parse(body);
        if (!/^[a-z0-9-]+$/.test(result.version))
          throw new Error('Invalid result version');
        const resultPath = path.join(
          root,
          `performance/round3/browser-${result.version}-raw.json`,
        );
        const saved = fs.existsSync(resultPath)
          ? JSON.parse(fs.readFileSync(resultPath, 'utf8'))
          : [];
        saved.push(result);
        fs.writeFileSync(resultPath, JSON.stringify(saved, null, 2));
        results.push(result);
        res.end('ok');
        return;
      }
      if (url.pathname === '/results') {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify(
            results.filter(
              (result) => result.version === url.searchParams.get('version'),
            ),
          ),
        );
        return;
      }
      res.setHeader('Content-Type', 'text/html;charset=utf-8');
      const content =
        url.pathname === '/functional-narrow'
          ? '<iframe id=qa style="width:390px;height:844px;border:0" src=/functional-qa></iframe>'
          : url.pathname === '/functional-qa'
            ? fs.readFileSync(
                path.join(root, 'performance/round3/functional-qa.html'),
                'utf8',
              )
            : url.pathname === '/app'
              ? app(url)
              : runner;
      res.end(content);
    } catch (error) {
      res.statusCode = 500;
      res.end(error.stack);
    }
  })
  .listen(49188, '127.0.0.1', () => console.log('http://127.0.0.1:49188'));
