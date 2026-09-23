(() => {
  const SUPABASE_URL = 'https://ntgybxhczmylqptbviri.supabase.co';
  const SUPABASE_PUBLIC_KEY = 'sb_publishable_DEaUhRFFtSaZkZAWzdYffQ_u2zreulm';
  const DEFAULT_ADMIN_EMAIL = 'akrammkreef313@gmail.com';
  const SESSION_KEY = 'alnajah_owner_session';
  const $ = id => document.getElementById(id);
  const email = $('adminEmail'), password = $('adminPassword'), message = $('message'), dashboard = $('dashboard'), badge = $('connectionBadge');
  email.value = localStorage.getItem('ownerEmail') || DEFAULT_ADMIN_EMAIL;
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
  const showMessage = (text, type='') => { message.hidden = !text; message.textContent = text || ''; message.className = `message ${type}`; };
  const setBadge = (text, type='neutral') => { badge.textContent = text; badge.className = `badge ${type}`; };
  const saveSession = value => { session = value; localStorage.setItem(SESSION_KEY, JSON.stringify(value)); };
  const clearSession = () => { session = null; localStorage.removeItem(SESSION_KEY); };
  async function login() {
    const userEmail = String(email.value || '').trim(), userPassword = String(password.value || '');
    if (!userEmail || !userPassword) throw new Error('أدخل بريد مستخدم Supabase وكلمة المرور.');
    let r; try { r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method:'POST', headers:{apikey:SUPABASE_PUBLIC_KEY,'content-type':'application/json'}, body:JSON.stringify({email:userEmail,password:userPassword}) }); } catch { throw new Error('تعذر الاتصال بـ Supabase.'); }
    const data = await r.json().catch(()=>({}));
    if (!r.ok || !data.access_token) throw new Error(data.error_description || data.msg || data.error || 'بيانات الدخول غير صحيحة.');
    localStorage.setItem('ownerEmail', userEmail);
    saveSession({access_token:data.access_token,refresh_token:data.refresh_token,user:data.user});
  }
  async function refreshSession() {
    if (!session?.refresh_token) throw new Error('انتهت الجلسة، سجّل الدخول مرة أخرى.');
    let r; try { r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method:'POST', headers:{apikey:SUPABASE_PUBLIC_KEY,'content-type':'application/json'}, body:JSON.stringify({refresh_token:session.refresh_token}) }); } catch { throw new Error('تعذر تحديث جلسة Supabase.'); }
    const data = await r.json().catch(()=>({}));
    if (!r.ok || !data.access_token) { clearSession(); throw new Error('انتهت الجلسة، سجّل الدخول مرة أخرى.'); }
    saveSession({access_token:data.access_token,refresh_token:data.refresh_token||session.refresh_token,user:data.user||session.user});
  }
  async function call(action, payload={}) {
    if (!session?.access_token) throw new Error('سجّل الدخول أولاً.');
    let r; try { r = await fetch(`${SUPABASE_URL}/functions/v1/${action}`, { method:'POST', headers:{apikey:SUPABASE_PUBLIC_KEY,authorization:`Bearer ${session.access_token}`,'content-type':'application/json'}, body:JSON.stringify(payload) }); } catch { throw new Error('تعذر الاتصال بدالة Supabase.'); }
    const data = await r.json().catch(()=>({}));
    if (r.status===401) { clearSession(); throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.'); }
    if (r.status===403) throw new Error('الحساب صحيح، لكنه غير مضاف كمدير في جدول platform_admins.');
    if (!r.ok) throw new Error(data.error || data.message || 'فشل تنفيذ العملية.');
    return data;
  }
  const display = v => v===null || v===undefined || v==='' ? '—' : String(v);
  const typeLabel = v => String(v).toUpperCase()==='LIFETIME' ? 'مدى الحياة' : 'سنوي';
  const statusLabel = v => ({ACTIVE:'نشط',SUSPENDED:'موقوف',REVOKED:'ملغى',PENDING:'قيد الانتظار',APPROVED:'مقبول',EXPIRED:'منتهي'})[String(v).toUpperCase()] || display(v);
  function renderTable(body, rows, cells, colspan) { body.innerHTML=''; if(!Array.isArray(rows)||!rows.length){body.innerHTML=`<tr><td colspan="${colspan}" class="empty">لا توجد بيانات</td></tr>`;return;} rows.forEach(row=>{const tr=document.createElement('tr');cells(row).forEach(value=>{const td=document.createElement('td');td.textContent=display(value);tr.appendChild(td)});body.appendChild(tr);}); }
  function renderDashboard(data) { dashboard.hidden=false; const stats=data?.stats||{}, statsEl=$('stats'); statsEl.innerHTML=''; const labels={total_pharmacies:'إجمالي الصيدليات',active:'التراخيص النشطة',suspended:'الموقوفة',expired:'المنتهية',pending_requests:'طلبات التفعيل',expiring_soon:'قريبة الانتهاء'}; Object.entries(labels).forEach(([key,label])=>{const el=document.createElement('div');el.className='card stat';el.innerHTML=`<span>${label}</span><b>${display(stats[key]??0)}</b>`;statsEl.appendChild(el);}); renderTable($('expiringBody'),data?.expiring,r=>[r.license_key,r.pharmacy_name,typeLabel(r.license_type),r.expires_at?String(r.expires_at).slice(0,10):'لا ينتهي',statusLabel(r.status)],5); renderTable($('requestsBody'),data?.requests,r=>[r.license_key,r.device_id,statusLabel(r.status)],3); }
  async function refresh() { try { setBadge('جارٍ الاتصال…','neutral'); const data=await call('owner-dashboard'); renderDashboard(data); setBadge('متصل','good'); showMessage('تم تسجيل الدخول وتحديث بيانات لوحة التراخيص.','success'); } catch(e) { setBadge('تعذر الاتصال','bad'); showMessage(e.message||'تعذر تحميل البيانات.','error'); } }
  $('saveBtn').addEventListener('click', async()=>{try{showMessage('جارٍ تسجيل الدخول…');await login();await refresh();}catch(e){setBadge('تعذر الاتصال','bad');showMessage(e.message||'فشل تسجيل الدخول.','error');}});
  $('refreshBtn').addEventListener('click',refresh);
  $('clearBtn').addEventListener('click',()=>{clearSession();password.value='';dashboard.hidden=true;setBadge('غير متصل','neutral');showMessage('تم تسجيل الخروج من لوحة الإدارة على هذا الجهاز.','success');});
  const syncLicenseType = () => { const lifetime = $('licenseType').value === 'LIFETIME'; $('dateField').hidden = lifetime; $('expiresAt').required = !lifetime; if (lifetime) $('expiresAt').value = ''; };
  $('licenseType').addEventListener('change', syncLicenseType);
  syncLicenseType();
  $('createForm').addEventListener('submit',async event=>{event.preventDefault();const f=new FormData(event.currentTarget),type=f.get('license_type');const payload={operation:'create_license',pharmacy_name:String(f.get('pharmacy_name')||'').trim(),owner_name:String(f.get('owner_name')||'').trim(),owner_email:String(f.get('owner_email')||'').trim(),license_type:type};if(type!=='LIFETIME')payload.expires_at=String(f.get('expires_at')||'');try{showMessage('جارٍ إصدار الترخيص…');const result=await call('owner-control',payload);const lic=result.license||result,key=lic.license_key||result.key;const box=$('createdResult');box.hidden=false;box.innerHTML=`<strong>تم إصدار الترخيص بنجاح</strong><div dir="ltr">${display(key)}</div><button type="button" class="ghost copy-key">نسخ مفتاح الترخيص</button><pre>${JSON.stringify(result,null,2)}</pre>`;box.querySelector('.copy-key').addEventListener('click',()=>navigator.clipboard?.writeText(String(key||'')));showMessage('تم إصدار الترخيص وتحديث اللوحة.','success');event.currentTarget.reset();syncLicenseType();await refresh();}catch(e){showMessage(e.message||'فشل إصدار الترخيص.','error');}});
  document.querySelectorAll('[data-operation]').forEach(btn=>btn.addEventListener('click',async()=>{const key=String($('operationKey').value||'').trim();if(!key){showMessage('أدخل مفتاح الترخيص أولاً.','error');return;}const op=btn.dataset.operation,payload={operation:op,license_key:key};if(op==='extend')payload.expires_at=String($('extendDate').value||'');try{showMessage('جارٍ تنفيذ العملية…');await call('owner-control',payload);showMessage('تم تنفيذ العملية بنجاح.','success');await refresh();}catch(e){showMessage(e.message||'فشل تنفيذ العملية.','error');}}));
  document.querySelector('[data-operation="extend"]').addEventListener('click',()=>{$('extendDateField').hidden=false;});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(session?.access_token) refresh();
})();
