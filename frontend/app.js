'use strict';
const $ = id => document.getElementById(id);
const colors = ['#358b79', '#92b6a1', '#d0ae70', '#7c9eae', '#b6a0b9', '#84ada3'];
const state = {view: 'overview', rows: [], all: [], stats: [], editId: null, deleteId: null, saving: false, deleting: false, loadId: 0};
const number = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 1});
let toastTimer;
function element(tag, className, text) {const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;}
function icon(name) {const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); const use = document.createElementNS(node.namespaceURI, 'use'); use.setAttribute('href', '#' + name); node.setAttribute('aria-hidden', 'true'); node.append(use); return node;}
function format(value) {return number.format(Number(value) || 0);}
function empty(message, hint = '') {const box = element('div', 'empty'); box.append(icon('book'), element('h3', '', message)); if(hint) box.append(element('p', '', hint)); return box;}
function localDate() {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function notify(message) {$('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => {$('toast').hidden = true;}, 4200);}
async function api(path, options = {}, timeoutMs = 15000) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {...options, signal: controller.signal, headers: options.body ? {'Content-Type':'application/json'} : {}});
    const text = await response.text(); let data;
    try {data = text ? JSON.parse(text) : null;} catch {throw new Error(`服务返回了无法识别的内容（${response.status}），请确认后端正常运行。`);}
    if (!response.ok) {
      const detail = data?.detail;
      const message = Array.isArray(detail) ? detail.map(x => `${x.loc?.slice(1).join('.') || '输入'}：${x.msg}`).join('；') : typeof detail === 'string' ? detail : `请求失败（${response.status}）`;
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('请求超时，请检查服务状态后重试。');
    if (error instanceof TypeError) throw new Error('无法连接服务，请确认 FastAPI 已启动。');
    throw error;
  } finally {clearTimeout(timeout);}
}
function getFilters() {
  const start = $('start-date').value, end = $('end-date').value;
  if(start && end && start > end) throw new Error('开始日期不能晚于结束日期。');
  const dates = new URLSearchParams(); if(start) dates.set('start_date',start); if(end) dates.set('end_date',end);
  const records = new URLSearchParams(dates);
  if(state.view === 'records' && $('filter-subject').value) records.set('subject', $('filter-subject').value);
  return {dates, records, label: start || end ? `${start || '最早记录'} 至 ${end || '不限结束日期'}` : '全部时间'};
}
function updateSubjects(rows) {
  const names = [...new Set(rows.map(row => row.Subject))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const selected = $('filter-subject').value; if(selected && !names.includes(selected)) names.push(selected);
  $('filter-subject').replaceChildren(new Option('全部科目',''));
  $('subjects').replaceChildren();
  for(const name of names){$('filter-subject').add(new Option(name,name)); $('subjects').append(new Option(name,name));}
  $('filter-subject').value = selected;
}
async function loadData() {
  if (state.view === 'review') return;
  let filters;
  try {filters = getFilters(); $('filter-error').hidden = true;}
  catch(error) {$('filter-error').textContent=error.message; $('filter-error').hidden=false; return;}
  const loadId = ++state.loadId;
  $('status').textContent='正在读取学习记录…'; $('status').hidden=false; $('content').hidden=true; $('error-panel').hidden=true;
  $('main').setAttribute('aria-busy','true');
  try {
    const [all, rows, stats] = await Promise.all([api('/study'), api('/study?' + filters.records), api('/study/stats/subjects?' + filters.dates)]);
    if(loadId !== state.loadId) return;
    if(!Array.isArray(all) || !Array.isArray(rows) || !Array.isArray(stats)) throw new Error('接口返回的数据格式不正确，请检查后端。');
    state.all=all; state.rows=rows; state.stats=stats;
    updateSubjects(all); $('range-label').textContent=filters.label;
    renderOverview(); renderRecords(); $('content').hidden=false;
  } catch(error) {
    if(loadId !== state.loadId) return;
    $('error-detail').textContent=error.message; $('error-panel').hidden=false;
  } finally {
    if(loadId === state.loadId){$('status').hidden=true; $('main').setAttribute('aria-busy','false');}
  }
}
function renderOverview() {
  const stats = [...state.stats].sort((a,b)=>Number(b.total_minutes)-Number(a.total_minutes));
  const total = stats.reduce((sum,row)=>sum+Number(row.total_minutes),0);
  $('total-hours').textContent=format(total/60); $('total-minutes').textContent=`共 ${format(total)} 分钟的专注投入`;
  $('record-count').textContent=format(stats.reduce((sum,row)=>sum+Number(row.record_count),0)); $('subject-count').textContent=format(stats.length);
  const chart=$('chart'), breakdown=$('subject-breakdown'); chart.replaceChildren(); breakdown.replaceChildren();
  if(!stats.length) {chart.append(empty('这段时间还没有学习记录','添加一条记录，开启你的学习积累。')); breakdown.append(empty('暂无科目数据'));}
  else {
    const bars=element('div','chart-bars'); const max=Math.max(...stats.map(x=>Number(x.total_minutes)),1);
    stats.forEach((row,i)=>{
      const color=colors[i%colors.length], minutes=Number(row.total_minutes);
      const item=element('div','chart-item'); item.style.setProperty('--bar-color',color);
      item.setAttribute('aria-label',`${row.subject}，${minutes} 分钟，${row.record_count} 条记录`);
      const track=element('div','bar-track'), bar=element('div','bar'); bar.style.height=`${minutes/max*160}px`;
      track.append(element('span','bar-value',format(minutes)),bar); item.append(track,element('div','bar-label',row.subject)); bars.append(item);
      const line=element('div','breakdown-row'); line.style.setProperty('--bar-color',color);
      const name=element('div','breakdown-name',row.subject); name.append(element('small','',`${format(row.record_count)} 条记录`));
      const time=element('div','breakdown-time',`${format(minutes)} 分钟`); time.append(element('small','',`占比 ${total ? Math.round(minutes/total*100) : 0}%`));
      line.append(element('span','dot'),name,time); breakdown.append(line);
    }); chart.append(bars);
  }
  const recent=$('recent-records'); recent.replaceChildren();
  const rows=[...state.rows].sort((a,b)=>String(b.Date).localeCompare(String(a.Date)) || Number(b.id)-Number(a.id)).slice(0,4);
  if(!rows.length){recent.append(empty('还没有可展示的记录'));return;}
  for(const row of rows){const line=element('div','recent-row'), mark=element('span','recent-icon'), body=element('div','recent-main'); mark.append(icon('book')); body.append(element('strong','',row.Topic),element('p','',row.Subject)); line.append(mark,body,element('span','recent-time',`${format(row.Duration_minutes)} 分钟`),element('time','recent-date',row.Date)); recent.append(line);}
}
function action(name, label, callback, extra='') {const button=element('button','icon-button '+extra); button.type='button'; button.setAttribute('aria-label',label); button.title=label; button.append(icon(name)); button.addEventListener('click',callback); return button;}
function renderRecords() {
  const body=$('records-body'); body.replaceChildren(); $('list-count').textContent=state.rows.length; $('records-empty').hidden=state.rows.length>0;
  const rows=[...state.rows].sort((a,b)=>String(b.Date).localeCompare(String(a.Date)) || Number(b.id)-Number(a.id));
  for(const row of rows){
    const tr=element('tr'); const subject=element('td'); subject.append(element('span','subject-tag',row.Subject),element('span','topic-name',row.Topic));
    tr.append(element('td','',row.Date),subject,element('td','',`${format(row.Duration_minutes)} 分钟`));
    for(const field of ['Difficulty','Plan_Comment']){const td=element('td','note-cell'), note=element('span','note-text',row[field] || '—'); note.title=row[field] || '';td.append(note);tr.append(td);}
    const td=element('td'), actions=element('div','row-actions');
    actions.append(action('edit',`编辑：${row.Topic}`,()=>openRecord(row)),action('trash',`删除：${row.Topic}`,()=>openDelete(row),'delete'));td.append(actions);tr.append(td);body.append(tr);
  }
}
function openRecord(row=null) {
  const form=$('record-form'); form.reset(); state.editId=row?.id ?? null;
  for(const input of form.querySelectorAll('input')) input.setCustomValidity('');
  const defaults={Subject:'',Topic:'',Date:localDate(),Duration_minutes:'',Difficulty:'',Plan_Comment:''};
  for(const [key,value] of Object.entries(defaults)) form.elements.namedItem(key).value=row?.[key] ?? value;
  $('dialog-title').textContent=row ? '编辑学习记录' : '新增学习记录'; $('save-error').hidden=true; $('save-record').textContent='保存记录';
  $('record-dialog').showModal(); form.elements.Subject.focus();
}
function openDelete(row){state.deleteId=row.id; $('delete-description').textContent=`${row.Date} · ${row.Subject} · ${row.Topic}`; $('delete-error').hidden=true; $('delete-dialog').showModal();}
function setDialogBusy(dialog,busy){dialog.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=busy);}
$('record-form').addEventListener('input', event=>{if(event.target.setCustomValidity)event.target.setCustomValidity('');});
$('record-form').addEventListener('submit',async event=>{
  event.preventDefault(); if(state.saving)return;
  const form=event.currentTarget;
  for(const field of ['Subject','Topic']){const input=form.elements.namedItem(field);input.setCustomValidity(input.value.trim() ? '' : '请填写内容，不能只输入空格。');}
  if(!form.reportValidity())return;
  const payload=Object.fromEntries(new FormData(form)); payload.Subject=payload.Subject.trim();payload.Topic=payload.Topic.trim();payload.Duration_minutes=Number(payload.Duration_minutes);
  const edit=state.editId!==null; state.saving=true;setDialogBusy($('record-dialog'),true);$('save-record').textContent='正在保存…';$('save-error').hidden=true;
  try{await api(edit ? `/study/${state.editId}` : '/study',{method:edit?'PUT':'POST',body:JSON.stringify(payload)});$('record-dialog').close();notify(edit?'记录已更新':'学习记录已保存');await loadData();}
  catch(error){$('save-error').textContent=error.message;$('save-error').hidden=false;}
  finally{state.saving=false;setDialogBusy($('record-dialog'),false);$('save-record').textContent='保存记录';}
});
$('confirm-delete').addEventListener('click',async()=>{
  if(state.deleting || state.deleteId===null)return;
  state.deleting=true;setDialogBusy($('delete-dialog'),true);$('confirm-delete').textContent='正在删除…';$('delete-error').hidden=true;
  try{await api(`/study/${state.deleteId}`,{method:'DELETE'});$('delete-dialog').close();notify('记录已删除');await loadData();}
  catch(error){$('delete-error').textContent=error.message;$('delete-error').hidden=false;}
  finally{state.deleting=false;setDialogBusy($('delete-dialog'),false);$('confirm-delete').textContent='确认删除';}
});
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>{const id=button.dataset.close;if((id==='record-dialog' && !state.saving)||(id==='delete-dialog' && !state.deleting))$(id).close();});
$('record-dialog').addEventListener('cancel',event=>{if(state.saving)event.preventDefault();});
$('delete-dialog').addEventListener('cancel',event=>{if(state.deleting)event.preventDefault();});
function setView(){
  state.view = location.hash === '#review' ? 'review' : location.hash === '#records' ? 'records' : 'overview';
  const records = state.view === 'records', review = state.view === 'review';
  $('overview-view').hidden = records || review; $('records-view').hidden = !records;
  $('review-view').hidden = !review; $('subject-filter').hidden = !records;
  $('filters').hidden = review; $('add-record').hidden = review;
  const titles = {overview: '学习概览', records: '学习记录', review: 'AI 复盘'};
  const subtitles = {overview: '把投入记下来，让每一步成长都有迹可循。', records: '记录学过的内容，也留下下一步的方向。', review: '回顾学过的内容，把下一步走得更清楚。'};
  $('page-title').textContent = titles[state.view]; $('breadcrumb').textContent = titles[state.view];
  $('page-subtitle').textContent = subtitles[state.view];
  for(const link of document.querySelectorAll('[data-view]')){const active=link.dataset.view===state.view;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  if (review) {
    // 避免切页之前尚未完成的列表请求覆盖复盘页的加载状态。
    state.loadId++; $('content').hidden = true; $('status').hidden = true;
    $('error-panel').hidden = true; $('filter-error').hidden = true;
    $('main').setAttribute('aria-busy','false');
  } else { loadData(); }
}
$('filters').addEventListener('submit',event=>{event.preventDefault();loadData();});
$('reset-filters').addEventListener('click',()=>{$('filters').reset();$('filter-subject').value='';loadData();});
$('retry').addEventListener('click',loadData);$('add-record').addEventListener('click',()=>openRecord());
window.addEventListener('hashchange',setView);
$('today').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());$('today').dateTime=localDate();

// 复盘只在用户主动点击时发起，不随切页、刷新或日期变动自动调用模型。
let reviewBusy = false;
const reviewStates = ['placeholder', 'loading', 'empty', 'error', 'result'];
function showReviewState(next) {
  for (const name of reviewStates) $('review-' + name).hidden = name !== next;
  $('review-feedback').setAttribute('aria-busy', String(next === 'loading'));
}
function appendReviewText(parent, text) {
  // 只创建文本和明确允许的格式节点，模型返回的 HTML 不会执行。
  for (const part of text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)) {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) parent.append(element('strong', '', part.slice(2, -2)));
    else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) parent.append(element('code', '', part.slice(1, -1)));
    else parent.append(document.createTextNode(part));
  }
}
function renderReview(text) {
  const body = $('review-body'); body.replaceChildren();
  let paragraph = null, list = null, code = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) {
      paragraph = null; list = null;
      if (code) code = null;
      else {const pre = element('pre'); code = element('code'); pre.append(code); body.append(pre);}
      continue;
    }
    if (code) {code.append(document.createTextNode(line + '\n')); continue;}
    if (!line.trim()) {paragraph = null; list = null; continue;}
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {body.append(element('hr')); paragraph = null; list = null; continue;}
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {const node = element(heading[1].length <= 2 ? 'h3' : 'h4'); appendReviewText(node, heading[2]); body.append(node); paragraph = null; list = null; continue;}
    const item = line.match(/^\s*(?:([-*+])|\d+[.)、])\s+(.+)$/);
    if (item) {
      const tag = item[1] ? 'ul' : 'ol';
      if (!list || list.localName !== tag) {list = element(tag); body.append(list);}
      const li = element('li'); appendReviewText(li, item[2]); list.append(li); paragraph = null; continue;
    }
    list = null;
    if (!paragraph) {paragraph = element('p'); body.append(paragraph);} else paragraph.append(element('br'));
    appendReviewText(paragraph, line);
  }
}
async function generateReview() {
  if (reviewBusy) return;
  if (!$('review-form').reportValidity()) return;
  const start = $('review-start').value, end = $('review-end').value;
  if (start && end && start > end) {
    $('review-validation').textContent = '开始日期不能晚于结束日期。'; $('review-validation').hidden = false; return;
  }
  $('review-validation').hidden = true;
  const params = new URLSearchParams();
  if (start) params.set('start_date', start);
  if (end) params.set('end_date', end);
  const range = start || end ? `${start || '最早记录'} 至 ${end || '不限结束日期'}` : '全部学习记录';
  reviewBusy = true;
  $('review-form').querySelectorAll('input, button').forEach(node => node.disabled = true);
  $('retry-review').disabled = true; $('generate-label').textContent = '正在生成…';
  $('review-loading-range').textContent = range; showReviewState('loading');
  try {
    const data = await api('/study/review' + (params.size ? '?' + params : ''), {method: 'POST'}, 90000);
    // 接口新格式为 {review: ...}，同时兼容旧服务尚未重启时返回的字符串。
    const review = typeof data === 'string' ? data : data?.review;
    if (typeof review === 'string' && review.trim()) {
      renderReview(review); $('review-result-range').textContent = range;
      const now = new Date(); $('review-generated-at').dateTime = now.toISOString();
      $('review-generated-at').textContent = '生成于 ' + now.toLocaleString('zh-CN', {month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'});
      showReviewState('result');
    } else {
      const message = data?.message ?? data?.messsage;
      if (typeof message === 'string' && message.trim()) {$('review-empty-message').textContent = `${range}：${message}`; showReviewState('empty');}
      else throw new Error('没有收到有效的复盘内容，请稍后重试。');
    }
  } catch (error) {
    $('review-error-detail').textContent = error.message; showReviewState('error');
  } finally {
    reviewBusy = false; $('review-form').querySelectorAll('input, button').forEach(node => node.disabled = false);
    $('retry-review').disabled = false; $('generate-label').textContent = '生成复盘';
  }
}
$('review-form').addEventListener('submit', event => {event.preventDefault(); generateReview();});
$('retry-review').addEventListener('click', generateReview);
function clearReviewResult() {
  if (reviewBusy) return;
  $('review-validation').hidden = true; $('review-body').replaceChildren(); showReviewState('placeholder');
}
for (const id of ['review-start', 'review-end']) $(id).addEventListener('input', clearReviewResult);
$('reset-review').addEventListener('click', () => {$('review-form').reset(); clearReviewResult();});
setView();
