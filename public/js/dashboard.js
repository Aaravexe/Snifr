export const $ = id => document.getElementById(id);
export const id = item => item._id || item.id;
export function node(tag,text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}
export async function api(path, method = 'GET', data) {
  const res = await fetch(path, { method, cache:'no-store', headers: data ? { 'Content-Type':'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) location.replace('/auth?mode=signin');
    throw new Error(result.message || 'The request failed. Please try again.');
  }
  return result.data;
}
export async function start() {
  const user = await api('/api/dashboard/session');
  $('greeting').textContent = 'Signed in as ' + user.displayName;
  $('logout').onclick = async () => {
    try { await api('/api/dashboard/logout','POST'); localStorage.removeItem('snifrSession'); location.replace('/auth?mode=signin'); }
    catch (error) { notice(error.message); }
  };
  return user;
}
export function notice(text) { $('notice').textContent = text; }
export function button(text, act) {
  const b = node('button',text);
  b.type = 'button'; b.className = 'quiet';
  b.onclick = async () => {
    b.disabled = true;
    try { await act(); } catch (error) { notice(error.message); } finally { b.disabled = false; }
  };
  return b;
}
export function link(text,href) { const a = node('a',text); a.href = href; return a; }
export function row(title,detail,...actions) {
  const item = node('article'); item.className = 'row';
  item.append(node('strong',title),node('small',detail));
  if (actions.length) { const group = node('div'); group.className = 'actions'; group.append(...actions); item.append(group); }
  return item;
}
export function list(target, rows, empty) { $(target).replaceChildren(...(rows.length ? rows : [node('p',empty)])); }
export async function panel(targets, load) {
  for (const target of targets) $(target).textContent = 'Loading…';
  try { await load(); }
  catch (error) {
    for (const target of targets) {
      const p = node('p',error.message); p.className = 'error';
      $(target).replaceChildren(p,button('Retry',() => panel(targets,load)));
    }
  }
}
// Field descriptors also drive the admin forms so the browser submits typed values.
export function editor(title,fields,record,onSave) {
  const dialog = $('editor'), form = $('editor-form');
  $('editor-title').textContent = title; $('editor-error').textContent = ''; $('fields').replaceChildren();
  const controls = fields.map(field => {
    const label = node('label',field.label);
    const c = node(field.options ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
    if (field.options) {
      c.add(new Option('Choose…',''));
      for (const option of field.options) {
        const [value,text] = Array.isArray(option) ? option : [option,option];
        c.add(new Option(text,value));
      }
    } else if (c.tagName === 'INPUT') c.type = field.type || 'text';
    c.name = field.key; c.required = !field.optional;
    for (const key of ['min','max','step','maxLength','pattern','placeholder']) if (field[key] !== undefined) c[key] = field[key];
    const value = record?.[field.key] ?? field.value;
    if (value !== undefined) c.value = field.format ? field.format(value) : value;
    label.append(c); $('fields').append(label); return c;
  });
  let saving = false;
  $('close').onclick = () => dialog.close();
  dialog.oncancel = event => { if (saving) event.preventDefault(); };
  form.onsubmit = async event => {
    event.preventDefault(); if (saving) return;
    saving = true; $('save').disabled = $('close').disabled = true;
    try {
      const data = {};
      fields.forEach((f,i) => { const v = controls[i].value.trim();
        if (v || !f.omitBlank) data[f.key] = f.parse ? f.parse(v) : f.type === 'number' ? Number(v) : v;
      });
      await onSave(data); dialog.close();
    } catch (error) { $('editor-error').textContent = error.message; }
    finally { saving = false; $('save').disabled = $('close').disabled = false; }
  };
  dialog.showModal();
}
export const petFields = [{key:'name',label:'Pet name',maxLength:80},{key:'breed',label:'Breed',maxLength:100},
  {key:'age',label:'Age in years',type:'number',min:0,max:30,step:'any'}];
export const reviewFields = [{key:'rating',label:'Rating (0.5 to 5 stars)',type:'number',min:.5,max:5,step:.5},
  {key:'comment',label:'Comment',type:'textarea',maxLength:1000,optional:true}];
export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata'}).format(new Date());
export const bookingTime = b => b.date + ' · ' + b.time + ' IST · ' + b.status;
export function ordered(bookings) { return bookings.slice().sort((a,b) => a.date.localeCompare(b.date) ||
  Date.parse('Jan 1 2000 ' + a.time) - Date.parse('Jan 1 2000 ' + b.time)); }
