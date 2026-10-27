import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowLeft, Check, ChevronDown, CircleAlert, FileText, Image as ImageIcon,
  LayoutDashboard, LogOut, Mail, MessageSquare, Moon, Plus, Save, Search, Settings,
  ShieldCheck, Sun, Trash2, Users, X, ExternalLink, Eye, Pencil, UploadCloud
} from 'lucide-react';
import { apiRequest } from './lib/api.js';
import { useTheme } from './theme/ThemeProvider.jsx';
import RichTextEditor from './components/RichTextEditor.jsx';

const navItems = [
  ['overview','Overview',LayoutDashboard],['posts','Posts',FileText],['comments','Comments',MessageSquare],
  ['subscribers','Subscribers',Users],['pages','Pages & sections',Settings],['media','Media library',ImageIcon],
  ['newsletter','Newsletter',Mail],['messages','Contact messages',Mail],['settings','Site settings',Activity]
];

function Notice({ notice, clear }) {
  if (!notice) return null;
  return <div className={`admin-notice ${notice.type || 'info'}`} role="status">
    {notice.type === 'error' ? <CircleAlert size={17}/> : <Check size={17}/>}
    <span>{notice.message}</span><button onClick={clear} aria-label="Dismiss"><X size={15}/></button>
  </div>;
}

function Login({ onLogin }) {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await onLogin(email,password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="admin-login-wrap"><form className="admin-login" onSubmit={submit}>
    <Link to="/" className="admin-back"><ArrowLeft size={15}/> Back to website</Link>
    <div className="admin-login-mark">fn.</div><span className="eyebrow">PRIVATE WORKSPACE</span>
    <h1>Welcome <em>back.</em></h1><p>Sign in to manage your writing and website.</p>
    <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {error && <div className="admin-inline-error">{error}</div>}
    <button className="button button-dark" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <ShieldCheck size={16}/></button>
    <small>Administrator access only. Public registration is disabled.</small>
  </form></div>;
}

function Stat({ label, value, icon: Icon, tone='' }) {
  return <div className="admin-stat"><div className={`admin-stat-icon ${tone}`}><Icon size={18}/></div><span>{label}</span><strong>{value ?? '—'}</strong></div>;
}

function Empty({ title, detail }) {
  return <div className="admin-empty"><div><FileText size={22}/></div><strong>{title}</strong><p>{detail}</p></div>;
}

function Overview({ data, go }) {
  const stats = data?.stats || {};
  return <div className="admin-content">
    <div className="admin-page-title"><div><span className="eyebrow">YOUR CONTROL ROOM</span><h1>Good to see you.</h1><p>Here is what is happening across your website.</p></div><button className="button button-dark" onClick={()=>go('posts','new')}><Plus size={16}/> Write a post</button></div>
    <div className="admin-stats-grid">
      <Stat label="Published posts" value={stats.posts} icon={FileText}/>
      <Stat label="Drafts" value={stats.drafts} icon={Pencil} tone="gold"/>
      <Stat label="Pending comments" value={stats.pendingComments} icon={MessageSquare} tone="rose"/>
      <Stat label="Confirmed subscribers" value={stats.subscribers} icon={Users} tone="green"/>
      <Stat label="Total appreciations" value={stats.likes} icon={Activity}/>
      <Stat label="New messages" value={stats.messages} icon={Mail} tone="gold"/>
    </div>
    <div className="admin-panel-grid">
      <section className="admin-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, one click away.</p></div></div><div className="quick-actions">
        <button onClick={()=>go('posts','new')}><Plus/><span><b>Create a post</b><small>Start a new story</small></span></button>
        <button onClick={()=>go('comments')}><MessageSquare/><span><b>Review comments</b><small>Moderate reader responses</small></span></button>
        <button onClick={()=>go('pages')}><Settings/><span><b>Edit homepage</b><small>Change your public content</small></span></button>
        <button onClick={()=>go('newsletter')}><Mail/><span><b>Newsletter campaigns</b><small>Notify confirmed subscribers</small></span></button>
      </div></section>
      <section className="admin-panel"><div className="panel-heading"><div><h2>Publishing checklist</h2><p>Before you announce a new story.</p></div></div><ul className="admin-checklist"><li><Check/> Preview your article and cover image</li><li><Check/> Add a clear excerpt and category</li><li><Check/> Check the article slug and SEO description</li><li><Check/> Publishing automatically queues the newsletter announcement</li></ul></section>
    </div>
  </div>;
}

function Posts({ notify, editPost }) {
  const [items,setItems] = useState([]);
  const [filter,setFilter] = useState('all');
  const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true);
  const load = useCallback(async()=>{setLoading(true);try{const r=await apiRequest(`/api/admin/posts${filter==='all'?'':`?status=${filter}`}`);setItems(r.items||[]);}catch(e){notify(e.message,'error')}finally{setLoading(false)}},[filter]);
  useEffect(()=>{load()},[load]);
  const filtered = items.filter(p=>`${p.title} ${p.slug} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  async function remove(post) {
    if (!window.confirm(`Delete "${post.title}"? This also deletes its comments and likes.`)) return;
    try { await apiRequest(`/api/admin/posts/${post._id}`,{method:'DELETE'}); notify('Post deleted.'); load(); }
    catch(e){notify(e.message,'error')}
  }
  return <div className="admin-content">
    <div className="admin-page-title"><div><span className="eyebrow">CONTENT STUDIO</span><h1>Your writing</h1><p>Create, edit, preview, publish, and manage articles.</p></div><button className="button button-dark" onClick={()=>editPost(null)}><Plus size={16}/> New post</button></div>
    <div className="admin-toolbar"><div className="admin-tabs">{['all','published','draft','archived'].map(s=><button key={s} className={filter===s?'active':''} onClick={()=>setFilter(s)}>{s==='all'?'All posts':s[0].toUpperCase()+s.slice(1)}</button>)}</div><label className="admin-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search posts"/></label></div>
    {loading?<div className="admin-loading">Loading posts…</div>:filtered.length===0?<Empty title="No posts found" detail="Create a post or try another filter."/>:
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Article</th><th>Status</th><th>Updated</th><th>Likes</th><th>Actions</th></tr></thead><tbody>{filtered.map(p=><tr key={p._id}><td><div className="table-article">{p.coverImage?<img src={p.coverImage} alt=""/>:<div className="table-placeholder"><FileText size={17}/></div>}<div><b>{p.title}</b><small>/{p.slug}</small></div></div></td><td><span className={`status-pill ${p.status}`}>{p.status}</span></td><td>{new Date(p.updatedAt).toLocaleDateString()}</td><td>{p.likeCount||0}</td><td><div className="table-actions"><button title="Edit" onClick={()=>editPost(p)}><Pencil size={15}/></button><a title="View" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer"><Eye size={15}/></a><button title="Delete" onClick={()=>remove(p)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>}
  </div>;
}

function PostEditor({ post, close, notify, refresh }) {
  const initial = post || { title:'',slug:'',excerpt:'',content:'<p></p>',coverImage:'',coverAlt:'',category:'Field notes',tags:[],status:'draft',readTime:5,seo:{title:'',description:''} };
  const [form,setForm] = useState(initial);
  const [saving,setSaving] = useState(false);
  const [tab,setTab] = useState('content');
  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  useEffect(()=>{setForm(post || { title:'',slug:'',excerpt:'',content:'<p></p>',coverImage:'',coverAlt:'',category:'Field notes',tags:[],status:'draft',readTime:5,seo:{title:'',description:''} })},[post]);
  function makeSlug(value){return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  async function save(status=form.status) {
    if(!form.title.trim()) return notify('A title is required.','error');
    const payload={...form,status,slug:form.slug||makeSlug(form.title),tags:Array.isArray(form.tags)?form.tags:String(form.tags||'').split(',').map(x=>x.trim()).filter(Boolean),readTime:Number(form.readTime)||5};
    setSaving(true);
    try {
      const r=await apiRequest(post?`/api/admin/posts/${post._id}`:'/api/admin/posts',{method:post?'PUT':'POST',body:JSON.stringify(payload)});
      setForm(r.post); notify(status==='published' ? (r.newsletterQueued === false ? 'Post published, but newsletter queueing failed. Check Redis and retry the campaign.' : r.newsletterQueued === true ? 'Post published successfully; newsletter announcement queued.' : post ? 'Post updated.' : 'Post published successfully.') : 'Draft saved successfully.'); refresh(); close();
    }catch(e){notify(e.message,'error')}finally{setSaving(false)}
  }
  async function uploadCover(e) {
    const file=e.target.files?.[0]; if(!file)return;
    const data=new FormData();data.append('file',file);
    try{const result=await apiRequest('/api/admin/media',{method:'POST',body:data});update('coverImage',result.media.url);notify('Cover image uploaded.')}
    catch(err){notify(err.message,'error')}
    e.target.value='';
  }
  return <div className="editor-overlay"><div className="post-editor-modal">
    <div className="post-editor-top"><div><span className="eyebrow">{post?'EDIT STORY':'NEW STORY'}</span><h2>{post?'Refine your story':'A new page begins.'}</h2></div><button className="icon-button" onClick={close} aria-label="Close editor"><X/></button></div>
    <div className="editor-modal-body"><div className="editor-tabs"><button className={tab==='content'?'active':''} onClick={()=>setTab('content')}>Content</button><button className={tab==='details'?'active':''} onClick={()=>setTab('details')}>Details & SEO</button></div>
    {tab==='content'?<div className="editor-fields">
      <label>Article title<input value={form.title} onChange={e=>{update('title',e.target.value);if(!post)update('slug',makeSlug(e.target.value))}} maxLength={180} placeholder="Give this story a title"/></label>
      <label>Short excerpt<textarea rows="2" value={form.excerpt} onChange={e=>update('excerpt',e.target.value)} maxLength={500} placeholder="A concise introduction to the story"/></label>
      <label>Article content<RichTextEditor value={form.content||''} onChange={v=>update('content',v)}/></label>
      <label>Cover image<div className="upload-line"><input value={form.coverImage||''} onChange={e=>update('coverImage',e.target.value)} placeholder="Image URL or upload below"/><label className="upload-button"><UploadCloud size={16}/> Upload<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadCover}/></label></div></label>
      {form.coverImage&&<img className="cover-preview" src={form.coverImage} alt={form.coverAlt||'Cover preview'}/>}
      <label>Cover image alt text<input value={form.coverAlt||''} onChange={e=>update('coverAlt',e.target.value)} maxLength={250}/></label>
    </div>:<div className="editor-fields">
      <label>URL slug<input value={form.slug||''} onChange={e=>update('slug',makeSlug(e.target.value))} required/><small>Used in the article URL; use lowercase words separated by hyphens.</small></label>
      <div className="form-two"><label>Category<input value={form.category||''} onChange={e=>update('category',e.target.value)} maxLength={80}/></label><label>Reading time (minutes)<input type="number" min="1" max="120" value={form.readTime||5} onChange={e=>update('readTime',e.target.value)}/></label></div>
      <label>Tags (comma-separated)<input value={Array.isArray(form.tags)?form.tags.join(', '):form.tags||''} onChange={e=>update('tags',e.target.value)} placeholder="engineering, learning, internship"/></label>
      <label>SEO title<input value={form.seo?.title||''} onChange={e=>update('seo',{...form.seo,title:e.target.value})} maxLength={180}/></label>
      <label>SEO description<textarea rows="3" value={form.seo?.description||''} onChange={e=>update('seo',{...form.seo,description:e.target.value})} maxLength={300}/></label>
      <label className="editor-checkbox"><input type="checkbox" checked={form.status==='published'} onChange={e=>update('status',e.target.checked?'published':'draft')}/> Published</label>
    </div>}
    </div><div className="post-editor-bottom"><button className="button button-quiet" onClick={close}>Cancel</button><div><button className="button button-quiet" disabled={saving} onClick={()=>save('draft')}><Save size={15}/> Save draft</button><button className="button button-dark" disabled={saving} onClick={()=>save('published')}>{saving?'Saving…':'Publish'} <ArrowLeft className="publish-arrow" size={15}/></button></div></div>
  </div></div>;
}

function Comments({ notify }) {
  const [items,setItems]=useState([]);const [filter,setFilter]=useState('pending');const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);try{const r=await apiRequest(`/api/admin/comments${filter==='all'?'':`?status=${filter}`}`);setItems(r.items||[])}catch(e){notify(e.message,'error')}finally{setLoading(false)}},[filter]);
  useEffect(()=>{load()},[load]);
  async function moderate(item,status){try{await apiRequest(`/api/admin/comments/${item._id}`,{method:'PATCH',body:JSON.stringify({status})});notify(`Comment ${status}.`);load()}catch(e){notify(e.message,'error')}}
  return <div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">COMMUNITY</span><h1>Reader comments</h1><p>Keep the conversation thoughtful and welcoming.</p></div></div><div className="admin-tabs">{['pending','approved','rejected','spam','all'].map(s=><button key={s} className={filter===s?'active':''} onClick={()=>setFilter(s)}>{s[0].toUpperCase()+s.slice(1)}</button>)}</div>{loading?<div className="admin-loading">Loading comments…</div>:!items.length?<Empty title="No comments here" detail="Comments matching this filter will appear here."/>:<div className="comment-admin-list">{items.map(c=><article className="comment-admin-card" key={c._id}><div className="comment-admin-top"><div><b>{c.name}</b><small>{c.post?.title||'Post'} · {new Date(c.createdAt).toLocaleString()}</small></div><span className={`status-pill ${c.status}`}>{c.status}</span></div><p>{c.body}</p><div className="comment-admin-actions">{c.status!=='approved'&&<button onClick={()=>moderate(c,'approved')}><Check size={14}/> Approve</button>}{c.status!=='rejected'&&<button onClick={()=>moderate(c,'rejected')}><X size={14}/> Reject</button>}{c.status!=='spam'&&<button onClick={()=>moderate(c,'spam')}><ShieldCheck size={14}/> Mark spam</button>}</div></article>)}</div>}</div>;
}

function Subscribers({ notify }) {
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [query,setQuery]=useState('');
  const load=useCallback(async()=>{try{const r=await apiRequest('/api/admin/subscribers');setItems(r.items||[])}catch(e){notify(e.message,'error')}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  const filtered=items.filter(s=>s.email.toLowerCase().includes(query.toLowerCase()));
  function exportCsv(){const rows=[['email','status','consentAt','confirmedAt'],...filtered.map(s=>[s.email,s.status,s.consentAt||'',s.confirmedAt||''])];const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='newsletter-subscribers.csv';a.click();URL.revokeObjectURL(url)}
  return <div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">YOUR READERS</span><h1>Subscribers</h1><p>Manage newsletter audience and consent records. Keep this information private.</p></div><button className="button button-dark" onClick={exportCsv}>Export CSV</button></div><label className="admin-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search email"/></label>{loading?<div className="admin-loading">Loading subscribers…</div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Email</th><th>Status</th><th>Consent</th><th>Confirmed</th></tr></thead><tbody>{filtered.map(s=><tr key={s._id}><td>{s.email}</td><td><span className={`status-pill ${s.status}`}>{s.status}</span></td><td>{s.consentAt?new Date(s.consentAt).toLocaleDateString():'—'}</td><td>{s.confirmedAt?new Date(s.confirmedAt).toLocaleDateString():'—'}</td></tr>)}</tbody></table></div>}</div>;
}

function Pages({ notify }) {
  const [items,setItems]=useState([]);const [selected,setSelected]=useState('home');const [form,setForm]=useState({title:'',content:{},published:true,seo:{}});
  const [settings,setSettings]=useState({});const [entriesText,setEntriesText]=useState('[]');const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{try{const [pages,site]=await Promise.all([apiRequest('/api/admin/pages'),apiRequest('/api/site')]);setItems(pages.items||[]);setSettings(site.settings||{});const p=(pages.items||[]).find(x=>x.key===selected);setForm(p?{title:p.title||'',content:p.content||{},published:p.published!==false,seo:p.seo||{}}:{title:'Home',content:{homeTitle:site.settings?.homeTitle||'',homeSubtitle:site.settings?.homeSubtitle||''},published:true,seo:{}});setEntriesText(JSON.stringify(p?.content?.entries||[],null,2))}catch(e){notify(e.message,'error')}finally{setLoading(false)}},[selected]);
  useEffect(()=>{load()},[load]);
  function choose(key){setSelected(key);const p=items.find(x=>x.key===key);setForm(p?{title:p.title||'',content:p.content||{},published:p.published!==false,seo:p.seo||{}}:{title:'Home',content:{homeTitle:settings.homeTitle||'',homeSubtitle:settings.homeSubtitle||''},published:true,seo:{}});setEntriesText(JSON.stringify(p?.content?.entries||[],null,2))}
  async function save(){try{if(selected==='home'){const next={...settings,homeTitle:form.content.homeTitle||'',homeSubtitle:form.content.homeSubtitle||''};await apiRequest('/api/admin/settings',{method:'PUT',body:JSON.stringify(next)});setSettings(next)}else{let payload=form;if(selected==='journey'){let entries;try{entries=JSON.parse(entriesText)}catch{throw new Error('Journey entries must be valid JSON.')}if(!Array.isArray(entries))throw new Error('Journey entries must be a JSON array.');payload={...form,content:{...form.content,entries}}}await apiRequest(`/api/admin/pages/${selected}`,{method:'PUT',body:JSON.stringify(payload)});await load()}notify('Page content saved.')}catch(e){notify(e.message,'error')}}
  const pageFields = Object.entries(form.content||{}).filter(([k,v])=>typeof v==='string');
  return <div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">CONTENT MANAGEMENT</span><h1>Pages & sections</h1><p>Edit public-facing copy without changing application code.</p></div><button className="button button-dark" onClick={save}><Save size={16}/> Save changes</button></div><div className="pages-layout"><aside className="page-selector"><b>Pages</b>{['home','about','blog','journey','contact'].map(k=><button key={k} className={selected===k?'active':''} onClick={()=>choose(k)}>{k==='home'?'Home page':k[0].toUpperCase()+k.slice(1)}</button>)}</aside><section className="admin-panel page-edit-panel">{loading?<p>Loading pages…</p>:<><span className="eyebrow">EDITING {selected.toUpperCase()}</span>{selected!=='home'&&<label>Page title<input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></label>}{selected==='home'?<><label>Hero headline<textarea rows="2" value={form.content.homeTitle||''} onChange={e=>setForm(f=>({...f,content:{...f.content,homeTitle:e.target.value}}))}/></label><label>Hero description<textarea rows="4" value={form.content.homeSubtitle||''} onChange={e=>setForm(f=>({...f,content:{...f.content,homeSubtitle:e.target.value}}))}/></label></>:<>{pageFields.map(([key,value])=><label key={key}>{key.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase())}<textarea rows="4" value={value} onChange={e=>setForm(f=>({...f,content:{...f.content,[key]:e.target.value}}))}/></label>)}{selected==='journey'&&<label>Journey timeline entries (JSON)<textarea rows="12" value={entriesText} onChange={e=>setEntriesText(e.target.value)}/><small>Use an array of objects: <code>{'[{"number":"01","title":"Diploma","description":"What this chapter taught you."}]'}</code>. Edit the JSON to add, remove or reorder timeline entries.</small></label>}</>}<label>SEO title<input value={form.seo.title||''} onChange={e=>setForm(f=>({...f,seo:{...f.seo,title:e.target.value}}))}/></label><label>SEO description<textarea rows="2" value={form.seo.description||''} onChange={e=>setForm(f=>({...f,seo:{...f.seo,description:e.target.value}}))}/></label><label className="editor-checkbox"><input type="checkbox" checked={form.published!==false} onChange={e=>setForm(f=>({...f,published:e.target.checked}))}/> Page is visible publicly</label></>}</section></div></div>;
}

function Media({ notify }) {
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{try{const r=await apiRequest('/api/admin/media');setItems(r.items||[])}catch(e){notify(e.message,'error')}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  async function upload(e){const files=[...(e.target.files||[])];if(!files.length)return;setBusy(true);try{for(const file of files){const data=new FormData();data.append('file',file);await apiRequest('/api/admin/media',{method:'POST',body:data})}notify(`${files.length} image(s) uploaded.`);load()}catch(err){notify(err.message,'error')}finally{setBusy(false);e.target.value=''}}
  async function remove(item){if(!window.confirm('Delete this media item? Existing posts using its URL may lose the image.'))return;try{await apiRequest(`/api/admin/media/${item._id}`,{method:'DELETE'});notify('Media deleted.');load()}catch(e){notify(e.message,'error')}}
  return <div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">ASSET LIBRARY</span><h1>Media</h1><p>Upload images, copy their URL, and reuse them in stories and pages.</p></div><label className="button button-dark media-upload-button"><UploadCloud size={16}/>{busy?'Uploading…':'Upload images'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={busy} onChange={upload}/></label></div>{loading?<div className="admin-loading">Loading media…</div>:!items.length?<Empty title="Your library is empty" detail="Upload a cover image or other visual asset to get started."/>:<div className="media-grid">{items.map(m=><article className="media-card" key={m._id}><img src={m.url} alt={m.alt||m.originalName}/><div><b title={m.originalName}>{m.originalName}</b><small>{Math.ceil((m.size||0)/1024)} KB</small><div className="media-actions"><button onClick={()=>{navigator.clipboard?.writeText(m.url);notify('Image URL copied.')}}>Copy URL</button><button onClick={()=>remove(m)} aria-label="Delete media"><Trash2 size={14}/></button></div></div></article>)}</div>}</div>;
}

function Newsletter({ notify }) {
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [busyId,setBusyId]=useState('');
  const load=useCallback(async()=>{try{const campaigns=await apiRequest('/api/admin/campaigns');setItems(campaigns.items||[])}catch(e){notify(e.message,'error')}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  async function retry(campaign){setBusyId(campaign._id);try{await apiRequest(`/api/admin/campaigns/${campaign._id}/retry`,{method:'POST',body:JSON.stringify({})});notify('Campaign retry queued.');await load()}catch(e){notify(e.message,'error')}finally{setBusyId('')}}
  return <div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">DIRECT TO INBOX</span><h1>Newsletter</h1><p>Publishing a story automatically queues an announcement for confirmed subscribers.</p></div></div><section className="admin-panel campaign-history"><div className="panel-heading"><div><h2>Campaign history</h2><p>Delivery counts are updated by the background worker. Failed campaigns can be retried.</p></div></div>{loading?<p>Loading campaigns…</p>:!items.length?<Empty title="No campaigns yet" detail="Publish a story to queue its announcement."/>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Story</th><th>Status</th><th>Recipients</th><th>Sent</th><th>Failed</th><th>Created</th><th>Action</th></tr></thead><tbody>{items.map(c=><tr key={c._id}><td>{c.post?.title||'Post'}</td><td><span className={`status-pill ${c.status}`}>{c.status}</span></td><td>{c.recipientCount}</td><td>{c.sentCount}</td><td>{c.failedCount}</td><td>{new Date(c.createdAt).toLocaleDateString()}</td><td>{c.status==='failed'&&<button className="comment-admin-action" disabled={busyId===c._id} onClick={()=>retry(c)}>{busyId===c._id?'Retrying…':'Retry'}</button>}</td></tr>)}</tbody></table></div>}</section></div>;
}

function Messages({ notify }) {
  const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{try{const r=await apiRequest('/api/admin/contact-messages');setItems(r.items||[])}catch(e){notify(e.message,'error')}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  return <div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">INCOMING NOTES</span><h1>Contact messages</h1><p>Messages sent through the public contact form.</p></div></div>{loading?<p>Loading messages…</p>:!items.length?<Empty title="No messages yet" detail="New contact form submissions will appear here."/>:<div className="comment-admin-list">{items.map(m=><article className="comment-admin-card" key={m._id}><div className="comment-admin-top"><div><b>{m.subject||'No subject'}</b><small>{m.name} · {m.email} · {new Date(m.createdAt).toLocaleString()}</small></div><span className={`status-pill ${m.status}`}>{m.status}</span></div><p>{m.message}</p><a className="text-link" href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: '+(m.subject||'your message'))}`}>Reply by email <ExternalLink size={14}/></a></article>)}</div>}</div>;
}

function SiteSettingsPanel({ notify }) {
  const [form,setForm]=useState(null);const [saving,setSaving]=useState(false);const [navigationText,setNavigationText]=useState('[]');const [socialText,setSocialText]=useState('[]');
  useEffect(()=>{apiRequest('/api/site').then(r=>{const settings=r.settings||{};setForm(settings);setNavigationText(JSON.stringify(settings.navigation||[],null,2));setSocialText(JSON.stringify(settings.socialLinks||[],null,2))}).catch(e=>notify(e.message,'error'))},[]);
  async function save(){setSaving(true);try{let navigation,socialLinks;try{navigation=JSON.parse(navigationText);socialLinks=JSON.parse(socialText)}catch{throw new Error('Navigation links and social links must contain valid JSON.')}if(!Array.isArray(navigation)||!Array.isArray(socialLinks))throw new Error('Navigation links and social links must be JSON arrays.');const payload={...form,navigation,socialLinks};await apiRequest('/api/admin/settings',{method:'PUT',body:JSON.stringify(payload)});setForm(payload);setNavigationText(JSON.stringify(navigation,null,2));setSocialText(JSON.stringify(socialLinks,null,2));notify('Site settings saved.')}catch(e){notify(e.message,'error')}finally{setSaving(false)}}
  if(!form)return <div className="admin-content"><p>Loading settings…</p></div>;
  const field=(key,label,area=false)=><label key={key}>{label}{area?<textarea rows="3" value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>:<input value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>}</label>;
  return <div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">SITE-WIDE CONTROLS</span><h1>Site settings</h1><p>Manage your identity and the global content used across the website.</p></div><button className="button button-dark" onClick={save} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save settings'}</button></div><section className="admin-panel settings-form">{field('siteName','Site name')}{field('tagline','Tagline')}{field('homeTitle','Homepage headline',true)}{field('homeSubtitle','Homepage description',true)}{field('heroImage','Homepage hero image URL')}{field('heroImageAlt','Homepage hero image alt text')}{field('introEyebrow','Intro section label')}{field('introText','Intro section text',true)}{field('postsEyebrow','Recent posts label')}{field('postsHeading','Recent posts heading')}{field('postsLinkText','Recent posts link text')}{field('journeyEyebrow','Journey section label')}{field('journeyHeading','Journey section heading',true)}{field('journeyDescription','Journey section description',true)}{field('journeyLinkText','Journey section link text')}{field('newsletterEyebrow','Newsletter label')}{field('newsletterHeading','Newsletter heading',true)}{field('newsletterDescription','Newsletter description',true)}{field('footerText','Footer text',true)}{field('contactEmail','Public contact email')}<label>Navigation links (JSON)<textarea rows="5" value={navigationText} onChange={e=>setNavigationText(e.target.value)}/><small>Use internal paths beginning with /, for example <code>{'[{"label":"Writing","href":"/blog"}]'}</code>.</small></label><label>Accent color<input type="color" value={form.theme?.accent||'#b6c8a8'} onChange={e=>setForm(f=>({...f,theme:{...(f.theme||{}),accent:e.target.value}}))}/></label><label>Social links (JSON)<textarea rows="5" value={socialText} onChange={e=>setSocialText(e.target.value)}/><small>Array of objects such as <code>{'[{"label":"GitHub","url":"https://github.com/your-profile"}]'}</code>.</small></label></section></div>;
}

export default function Admin() {
  const {theme,toggleTheme}=useTheme();
  const [user,setUser]=useState(null);const [checking,setChecking]=useState(true);const [section,setSection]=useState('overview');
  const [notice,setNotice]=useState(null);const [dashboard,setDashboard]=useState(null);const [editingPost,setEditingPost]=useState(undefined);const [refreshKey,setRefreshKey]=useState(0);const [mobileNav,setMobileNav]=useState(false);
  const notify=(message,type='success')=>{setNotice({message,type});window.setTimeout(()=>setNotice(null),5000)};
  const refresh=()=>setRefreshKey(k=>k+1);
  useEffect(()=>{apiRequest('/api/admin/session').then(r=>setUser(r.user)).catch(()=>setUser(null)).finally(()=>setChecking(false))},[]);
  useEffect(()=>{if(user)apiRequest('/api/admin/dashboard').then(setDashboard).catch(e=>notify(e.message,'error'))},[user,refreshKey]);
  async function login(email,password){const r=await apiRequest('/api/admin/login',{method:'POST',body:JSON.stringify({email,password})});setUser(r.user);setSection('overview')}
  async function logout(){try{await apiRequest('/api/admin/logout',{method:'POST',body:JSON.stringify({})})}catch{}setUser(null)}
  function go(key,sub){setSection(key);setMobileNav(false);if(key==='posts'&&sub==='new')setEditingPost(null)}
  const title=navItems.find(n=>n[0]===section)?.[1]||'Overview';
  if(checking)return <div className="admin-loading full-page">Preparing secure workspace…</div>;
  if(!user)return <Login onLogin={login}/>;
  return <div className="admin-shell">
    <aside className={`admin-sidebar ${mobileNav?'mobile-open':''}`}><Link to="/" className="admin-brand"><span className="brand-mark">fn.</span><span>Field Notes<small>ADMIN STUDIO</small></span></Link><div className="admin-side-label">WORKSPACE</div><nav>{navItems.map(([key,label,Icon])=><button key={key} className={section===key?'active':''} onClick={()=>go(key)}><Icon size={17}/><span>{label}</span>{key==='comments'&&dashboard?.stats?.pendingComments>0&&<i>{dashboard.stats.pendingComments}</i>}</button>)}</nav><div className="admin-sidebar-bottom"><div className="admin-user"><div className="admin-avatar">{user.email?.slice(0,1).toUpperCase()}</div><span><b>{user.email}</b><small>Administrator</small></span></div><button onClick={logout}><LogOut size={16}/> Sign out</button></div></aside>
    <div className="admin-main"><header className="admin-topbar"><button className="admin-mobile-toggle" onClick={()=>setMobileNav(!mobileNav)}><ChevronDown size={18}/></button><div><span className="eyebrow">FIELD NOTES / {title.toUpperCase()}</span></div><div className="admin-top-actions"><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={15}/> View site</a><button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button></div></header><Notice notice={notice} clear={()=>setNotice(null)}/>
      {section==='overview'&&<Overview data={dashboard} go={go}/>}
      {section==='posts'&&<Posts key={refreshKey} notify={notify} editPost={setEditingPost}/>}
      {section==='comments'&&<Comments notify={notify}/>}
      {section==='subscribers'&&<Subscribers notify={notify}/>}
      {section==='pages'&&<Pages notify={notify}/>}
      {section==='media'&&<Media notify={notify}/>}
      {section==='newsletter'&&<Newsletter notify={notify}/>}
      {section==='messages'&&<Messages notify={notify}/>}
      {section==='settings'&&<SiteSettingsPanel notify={notify}/>}
    </div>
    {editingPost!==undefined&&<PostEditor post={editingPost} close={()=>setEditingPost(undefined)} notify={notify} refresh={refresh}/>}
  </div>;
}
