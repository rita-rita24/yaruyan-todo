import { readFileSync, writeFileSync } from 'node:fs';
const marker = '      navigate(getRouteFromHash());\n    })();';
function instrument(version) {
  const file =
    version === 'before'
      ? 'baseline.html'
      : process.argv[2] || 'candidate.html';
  let html = readFileSync(`performance/round3/${file}`, 'utf8').replaceAll(
    'yatta-spa',
    `perf-round3-drag-${version}-${Date.now()}`,
  );
  const qa = `
    const samples=[];
    tasks=normalizeTasks(Array.from({length:200},(_,i)=>({id:'p'+i,text:'parent '+i,subtasks:Array.from({length:50},(_,j)=>({id:'s'+i+'_'+j,text:'child '+j}))})));
    settings.sound=false;settings.celebration=false;taskViewState.filter='all';resetTaskSearch();render();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const rows=[...taskList.children],geometry=rows.map(row=>row.getBoundingClientRect());
    let reads=0;const originals=rows.map(row=>row.getBoundingClientRect);
    rows.forEach((row,index)=>{row.getBoundingClientRect=function(){reads++;return originals[index].call(this);};});
    for(let trial=0;trial<5;trial++){
      reads=0;const start=performance.now();let checks=0;
      for(let index=1;index<rows.length;index++){
        const rect=geometry[index],y=rect.top+rect.height/2-1;
        const intent=resolveDropIntentByClientY(rows,'p0',y,row=>row.dataset.id);
        if(intent.targetId!=='p'+index||intent.placeAfter)throw Error('wrong drop target '+index);
        checks++;
      }
      samples.push({trial,operation:'drop-lookup',ms:performance.now()-start,geometryReads:reads,inputs:checks});
    }
    rows.forEach((row,index)=>{row.getBoundingClientRect=originals[index];});
    for(let trial=0;trial<5;trial++){
      const siblings=[...taskList.firstElementChild.querySelectorAll('.subtask-item')];
      const start=performance.now();tasks[0].subtasks[0].text='edited '+trial;render();
      const next=[...taskList.firstElementChild.querySelectorAll('.subtask-item')];
      if(next[0].querySelector('.text').textContent!=='edited '+trial)throw Error('wrong child text');
      samples.push({trial,operation:'child-render-only',ms:performance.now()-start,retainedSiblings:siblings.slice(1).filter((row,index)=>row===next[index+1]).length});
    }
    parent.postMessage({version:${JSON.stringify(version)},samples},'*');`;
  html = html.replace(
    marker,
    '      navigate(getRouteFromHash());\n' + qa + '\n    })();',
  );
  return html;
}
const sources = ['before', 'after'].map(instrument);
writeFileSync(
  'performance/round3/drag-qa.html',
  `<!doctype html><meta charset=utf-8><h1>DOM geometry and render microbenchmark</h1><p>This measures synchronous processing, not visual drag latency or persistence.</p><pre id=result>Running</pre><iframe id=app style="width:1280px;height:900px"></iframe><script>
const sources=${JSON.stringify(sources).replaceAll('</script>', '<\\/script>')};const results=[];
window.addEventListener('message',async event=>{if(event.source!==app.contentWindow)return;results.push(event.data);if(results.length===1){app.srcdoc=sources[1];return;}document.getElementById('result').textContent=JSON.stringify(results,null,2);await fetch('/result',{method:'POST',body:JSON.stringify({version:${JSON.stringify(process.argv[3] || 'round3-drag-micro')},date:new Date().toISOString(),userAgent:navigator.userAgent,results})});});app.srcdoc=sources[0];</script>`,
);
console.log('Generated performance/round3/drag-qa.html');
