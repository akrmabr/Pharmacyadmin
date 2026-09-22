(() => {
  const DEFAULT_ENDPOINT = 'https://ntgybxhczmylqptbviri.supabase.co';
  const $ = (id) => document.getElementById(id);
  const endpoint = $('endpoint'), token = $('adminToken'), message = $('message'), dashboard = $('dashboard'), badge = $('connectionBadge');
  endpoint.value = localStorage.getItem('ownerUrl') || DEFAULT_ENDPOINT;
  token.value = localStorage.getItem('ownerToken') || '';
  let lastData = null;

  const showMessage = (text, type='') => { message.hidden = !text; message.textContent = text || ''; message.className = `message ${type}`; };
  const setBadge = (text, type='neutral') => { badge.textContent = text; badge.className = `badge ${type}`; };
  const getEndpoint = () => String(endpoint.value || '').trim().replace(/\/+$/, '');
  const requireConfig = () => {
    const url = getEndpoint();
    if (!/^https?:\/\//i.test(url)) throw new Error('أدخل رابط Supabase صحيحاً.');
    if (!String(token.value || '').trim()) throw new Error('أدخل رمز دخول المدير.');
    localStorage.setItem('ownerUrl', url); localStorage.setItem('ownerToken', token.value.trim());
    return { url, auth: token.value.trim() };
  };
  async function call(action, payload={}) {
    const {url, auth} = requireConfig();
    let response;
    try { response = await fetch(`${url}/functions/v1/${action}`, { method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${auth}`}, body:JSON.stringify(payload) }); }
    catch { throw new Error('تعذر الاتصال بـ Supabase. تحقق من الإنترنت وإعدادات CORS في Edge Functions.'); }
    let data = {}; try { data = await response.json(); } catch { throw new Error('استجابة الخادم غير صالحة.'); }
    if (!response.ok) throw new Error(data.error || data.message || 'فشل تنفيذ العملية.');
    return data;
  }
  const display = (v) => v === null || v === undefined || v === '' ? '—' : String(v);
  const typeLabel = (v) => String(v).toUpperCase() === 'LIFETIME' ? 'مدى الحياة' : 'سنوي';
  const statusLabel = (v) => ({ACTIVE:'نشط',SUSPENDED:'موقوف',REVOKED:'ملغى',PENDING:'قيد الانتظار',APPROVED:'مقبول'})[String(v).toUpperCase()] || display(v);
  function statCard(label, value){ const el=document.createElement('div'); el.className='card stat'; el.innerHTML=`<span>${label}</span><b>${display(value)}</b>`; return el; }
  function renderTable(body, rows, cells, colspan){ body.innerHTML=''; if(!Array.isArray(rows)||!rows.length){body.innerHTML=`<tr><td colspan="${colspan}" class="empty">لا توجد بيانات</td></tr>`;return;} rows.forEach(row=>{const tr=document.createElement('tr'); cells(row).forEach(value=>{const td=document.createElement('td');td.textContent=display(value);tr.appendChild(td)});body.appendChild(tr)}); }
  function renderDashboard(data){
    lastData=data||{}; dashboard.hidden=false; const stats=data?.stats||{}; const statsEl=$('stats'); statsEl.innerHTML='';
    const labels={total:'إجمالي التراخيص',active:'التراخيص النشطة',expired:'منتهية',suspended:'موقوفة',revoked:'ملغاة',lifetime:'مدى الحياة'};
    const entries=Object.entries(labels).filter(([key])=>Object.prototype.hasOwnProperty.call(stats,key));
    (entries.length?entries:[['total','إجمالي التراخيص']]).forEach(([key,label])=>statsEl.appendChild(statCard(label,stats[key] ?? 0)));
    renderTable($('expiringBody'),data?.expiring, r=>[r.license_key,r.pharmacy_name,typeLabel(r.license_type),r.expires_at?String(r.expires_at).slice(0,10):'لا ينتهي',statusLabel(r.status)],5);
    renderTable($('requestsBody'),data?.requests, r=>[r.license_key,r.device_id,statusLabel(r.status)],3);
  }
  async function refresh(){ try{setBadge('جارٍ الاتصال…','neutral'); const data=await call('owner-dashboard'); renderDashboard(data); setBadge('متصل','good'); showMessage('تم تحديث بيانات لوحة التراخيص.','success');} catch(e){setBadge('تعذر الاتصال','bad');showMessage(e.message||'تعذر تحميل البيانات.','error');} }
  $('saveBtn').addEventListener('click', refresh);
  $('refreshBtn').addEventListener('click', refresh);
  $('clearBtn').addEventListener('click',()=>{localStorage.removeItem('ownerUrl');localStorage.removeItem('ownerToken');token.value='';endpoint.value=DEFAULT_ENDPOINT;dashboard.hidden=true;setBadge('غير متصل','neutral');showMessage('تم مسح بيانات الدخول من هذا الجهاز.','success');});
  $('licenseType').addEventListener('change', e=>{$('daysField').hidden=e.target.value==='LIFETIME';});
  $('createForm').addEventListener('submit', async (event)=>{event.preventDefault();const form=new FormData(event.currentTarget);const license_type=form.get('license_type');const payload={operation:'create_license',pharmacy_name:String(form.get('pharmacy_name')||'').trim(),owner_name:String(form.get('owner_name')||'').trim(),owner_email:String(form.get('owner_email')||'').trim(),license_type};if(license_type!=='LIFETIME')payload.days=Number(form.get('days')||365);try{showMessage('جارٍ إصدار الترخيص…');const result=await call('owner-control',payload);const key=result.license_key||result.license?.license_key||result.key;const box=$('createdResult');box.hidden=false;box.innerHTML=`<strong>تم إصدار الترخيص بنجاح</strong><div dir="ltr">${display(key||'راجع نتيجة العملية أدناه')}</div><button type="button" class="ghost copy-key">نسخ مفتاح الترخيص</button><pre>${JSON.stringify(result,null,2)}</pre>`;box.querySelector('.copy-key').addEventListener('click',()=>navigator.clipboard?.writeText(String(key||'')));showMessage('تم إصدار الترخيص وتحديث اللوحة.','success');event.currentTarget.reset();$('daysField').hidden=false;$('createForm [name="days"]').value=365;await refresh();}catch(e){showMessage(e.message||'فشل إصدار الترخيص.','error');}});
  document.querySelectorAll('[data-operation]').forEach(btn=>btn.addEventListener('click',async()=>{const key=String($('operationKey').value||'').trim();if(!key){showMessage('أدخل مفتاح الترخيص أولاً.','error');return;}const operation=btn.dataset.operation;const payload={operation,license_key:key};if(operation==='extend')payload.days=Number($('extendDays').value||365);try{showMessage('جارٍ تنفيذ العملية…');const result=await call('owner-control',payload);showMessage(`تم تنفيذ العملية: ${operation}`,'success');console.log(result);await refresh();}catch(e){showMessage(e.message||'فشل تنفيذ العملية.','error');}}));
  document.querySelector('[data-operation="extend"]').addEventListener('click',()=>{$('extendDaysField').hidden=false;});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(localStorage.getItem('ownerToken')) refresh();
})();
