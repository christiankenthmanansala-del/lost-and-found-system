const CATS = { "Phones": "📱", "Laptops & tablets": "💻", "Headphones": "🎧", "Cameras": "📷", "Watches & jewelry": "⌚", "Electronics": "🔌", "Bags": "🎒", "Keys": "🔑", "Wallets & cards": "👛", "Documents & IDs": "📄", "Clothing": "🧥", "Glasses": "👓", "Books & stationery": "📚", "Water bottles": "🥤", "Umbrellas": "☂️", "Bikes & sports": "🚲", "Toys": "🧸", "Other": "📦" };
const icon = c => CATS[c] || "📦";

const GUESS = [
    ["Electronics", "charger|cable|power ?bank|usb|flash ?drive|pen ?drive|mouse|keyboard|calculator|console|controller|remote|adapter|gadget"],
    ["Phones", "phone|iphone|smartphone|android|samsung|pixel|galaxy|huawei|oppo|vivo|xiaomi|realme"],
    ["Laptops & tablets", "laptop|macbook|chromebook|tablet|ipad|kindle|ereader|e-reader"],
    ["Headphones", "airpod|earbud|earphone|headphone|headset|speaker"],
    ["Cameras", "camera|gopro|lens|drone|tripod"],
    ["Watches & jewelry", "watch|smartwatch|bracelet|necklace|earring|ring|jewel|jewelry|jewellery|pendant"],
    ["Keys", "key|keychain|key ?fob"],
    ["Documents & IDs", "passport|id|license|licence|permit|document|certificate|diploma|ticket"],
    ["Wallets & cards", "wallet|purse|card|cardholder|cash"],
    ["Bags", "bag|backpack|handbag|luggage|suitcase|tote|duffel|satchel|pouch"],
    ["Clothing", "jacket|coat|hoodie|sweater|sweatshirt|shirt|t-shirt|scarf|hat|cap|glove|shoe|sneaker|slipper|sandal|jersey|uniform|cardigan|jeans|pants|dress|sock|belt"],
    ["Glasses", "glasses|sunglass|eyeglass|spectacle"],
    ["Books & stationery", "book|notebook|textbook|pen|pencil|folder|binder|notepad|planner|ruler|marker"],
    ["Water bottles", "bottle|tumbler|flask|thermos|lunch ?box|mug|cup"],
    ["Umbrellas", "umbrella"],
    ["Bikes & sports", "bike|bicycle|helmet|ball|racket|racquet|skateboard|scooter"],
    ["Toys", "toy|doll|teddy|plush|lego"]
].map(([cat, words]) => [cat, new RegExp("\\b(?:" + words + ")(?:e?s)?\\b", "gi")]);

function guessCat(text) {
    let best = null,
        at = -1;
    for (const [cat, re] of GUESS) {
        let m, last = -1;
        re.lastIndex = 0;
        while ((m = re.exec(text))) last = m.index;
        if (last > at) {
            at = last;
            best = cat;
        }
    }
    return best;
}
const daysAgo = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};
let items = [],
    view = "all",
    loadingItems = false;
const API = "/api";
const getToken = () => { try { return sessionStorage.getItem("lf-token") || ""; } catch (e) { return ""; } };

function setToken(token) {
    try {
        if (token) sessionStorage.setItem("lf-token", token);
        else sessionStorage.removeItem("lf-token");
    } catch (e) {}
}
async function apiRequest(url, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API}${url}`, {...options, headers });
    let data = {};
    try { data = await response.json(); } catch (e) {}
    if (!response.ok) {
        if (response.status === 401) {
            setToken("");
            if (!document.body.classList.contains("locked")) lock();
        }
        throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
}
async function loadItems() {
    if (!getToken()) {
        items = [];
        render();
        return;
    }
    loadingItems = true;
    try {
        const data = await apiRequest("/items");
        items = Array.isArray(data) ? data : [];
        render();
    } catch (error) {
        toast(error.message || "Couldn't load items.");
    } finally { loadingItems = false; }
}

/** @param {string} s @returns {any} */
const $ = s => document.querySelector(s);
const state = i => i.status === "claimed" ? "claimed" : i.type;
const NAMES = { lost: "Lost", found: "Found", claimed: "Claimed" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = d => new Date(d + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function toast(m) {
    const t = $("#toast");
    t.textContent = m;
    t.classList.add("on");
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.remove("on"), 2400);
}

function matches(i) {
    if (!i || i.status === "claimed") return [];
    const words = i.name.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    return items.filter(o => o.id !== i.id && o.type !== i.type && o.status === "open" &&
        (o.cat === i.cat || words.some(w => o.name.toLowerCase().includes(w))));
}

function render() {
    const count = k => k === "all" ? items.length : items.filter(i => state(i) === k).length;
    const titles = { all: ["All items", "Everything logged at the desk."], lost: ["Lost items", "People are still looking for these."], found: ["Found items", "Waiting for their owners."], claimed: ["Claimed items", "Returned and closed."] };
    $("#title").textContent = titles[view][0];
    $("#subtitle").textContent = titles[view][1];

    const T = [
        ["all", "📋", "All"],
        ["lost", "🔴", "Lost"],
        ["found", "🟢", "Found"],
        ["claimed", "✅", "Claimed"]
    ];
    $("#nav").innerHTML = T.map(([k, e, t]) => `<button data-v="${k}" ${view===k?'aria-current="true"':''}><span>${e} ${t}</span><small>${count(k)}</small></button>`).join("");
    $("#tabs").innerHTML = T.map(([k, e, t]) => `<button data-v="${k}" ${view===k?'aria-current="true"':''}><span>${e}</span>${t}</button>`).join("");

    $("#stats").innerHTML = `
    <div class="stat lost"><div class="ico">🔍</div><div><b>${count("lost")}</b><span>Still missing</span></div></div>
    <div class="stat found"><div class="ico">📥</div><div><b>${count("found")}</b><span>Awaiting owner</span></div></div>
    <div class="stat claimed"><div class="ico">🤝</div><div><b>${count("claimed")}</b><span>Returned</span></div></div>`;

    const term = $("#q").value.trim().toLowerCase(),
        cat = $("#cat").value,
        sort = $("#sort").value;
    let rows = items.filter(i => (view === "all" || state(i) === view) && (cat === "all" || i.cat === cat) &&
        (!term || (i.name + i.loc + i.desc).toLowerCase().includes(term)));
    rows.sort((a, b) => sort === "az" ? a.name.localeCompare(b.name) : sort === "old" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date) || b.id - a.id);

    $("#list").innerHTML = rows.length ? rows.map(i => `
    <button class="item ${state(i)}" data-id="${i.id}">
      <div class="ico">${icon(i.cat)}</div>
      <div><span class="badge">${NAMES[state(i)]}</span><h3>${esc(i.name)}</h3>
      <p>📍 ${esc(i.loc)}</p><p>${fmt(i.date)} · #${i.id}</p></div>
    </button>`).join("") : `<div class="empty"><h3>${loadingItems ? "Loading items…" : "No items to show"}</h3><p>${loadingItems ? "Getting records from the database." : "Try a different search or filter, or log a new item."}</p><button class="btn" data-a="new">Log an item</button></div>`;
}

function openPanel(html) {
    const p = $("#panel");
    p.innerHTML = html;
    p.classList.add("on");
    p.setAttribute("aria-hidden", "false");
    $("#scrim").classList.add("on");
}

function closePanel() {
    $("#panel").classList.remove("on");
    $("#panel").setAttribute("aria-hidden", "true");
    $("#scrim").classList.remove("on");
}

function showDetail(id) {
    const i = items.find(x => x.id === id),
        m = matches(i);
    openPanel(`
    <div class="${state(i)}"><span class="badge">${NAMES[state(i)]}</span></div>
    <h2>${icon(i.cat)} ${esc(i.name)}</h2>
    <dl><dt>Reference</dt><dd>#${i.id}</dd><dt>Category</dt><dd>${esc(i.cat)}</dd><dt>Date</dt><dd>${fmt(i.date)}</dd>
    <dt>Where</dt><dd>${esc(i.loc)}</dd><dt>Details</dt><dd>${esc(i.desc||"None given")}</dd><dt>Contact</dt><dd>${esc(i.contact)}</dd></dl>
    ${m.length ? `<div class="match"><b>Possible matches</b>${m.map(o=>`<div>${icon(o.cat)} #${o.id} ${esc(o.name)} <span style="color:var(--mute)">(${esc(o.loc)})</span></div>`).join("")}</div>` : ""}
    <div class="acts">
      ${i.status==="open" ? `<button class="btn" data-a="claim" data-id="${id}">Mark as claimed</button>` : `<button class="btn" data-a="reopen" data-id="${id}">Reopen</button>`}
      <button class="btn danger" data-a="del" data-id="${id}">Delete</button>
      <button class="btn ghost" data-a="close">Close</button>
    </div>`);
}

function showForm(){
  openPanel(`
    <h2>Log an item</h2>
    <form id="frm">
      <label>What happened?</label>
      <div class="choice">
        <label><input type="radio" name="t" value="found" checked><span><b>📥 Found it</b><small>Someone handed it in</small></span></label>
        <label><input type="radio" name="t" value="lost"><span><b>🔍 Lost it</b><small>Someone is looking</small></span></label>
      </div>
      <label for="f-name">Item name</label>
      <div class="namerow"><span class="pick" id="f-ico" aria-hidden="true">📦</span><input id="f-name" required placeholder="Black leather wallet" autocomplete="off"></div>
      <span class="fnote">The icon follows the category. Typing "iPhone" or "wallet" picks it for you.</span>
      <div class="row">
        <div><label for="f-cat">Category</label><select id="f-cat">${Object.keys(CATS).map(c=>`<option value="${c}">${CATS[c]} ${c}</option>`).join("")}</select></div>
        <div><label for="f-date">Date</label><input id="f-date" type="date" required value="${daysAgo(0)}"></div>
      </div>
      <label for="f-loc">Where</label><input id="f-loc" required placeholder="Main library, 2nd floor">
      <label for="f-desc">Description</label><textarea id="f-desc" rows="3" placeholder="Colour, brand, marks, contents"></textarea>
      <label for="f-contact">Contact</label><input id="f-contact" required placeholder="Name and phone or email">
      <div class="acts"><button class="btn">Save item</button><button type="button" class="btn ghost" data-a="close">Cancel</button></div>
    </form>`);
  let catTouched = false;
  const syncIcon = () => { $("#f-ico").textContent = icon($("#f-cat").value); };
  $("#f-cat").value = "Other"; syncIcon();
  $("#f-cat").addEventListener("change", () => { catTouched = true; syncIcon(); });
  $("#f-name").addEventListener("input", () => {
    if(!catTouched){ const g = guessCat($("#f-name").value); $("#f-cat").value = g || "Other"; syncIcon(); }
  });
  setTimeout(()=>$("#f-name").focus(),260);
}

["#nav","#tabs"].forEach(s => $(s).addEventListener("click", e => { const b=e.target.closest("button"); if(b){ view=b.dataset.v; render(); window.scrollTo({top:0,behavior:"smooth"}); } }));
$("#list").addEventListener("click", e => { if(e.target.closest('[data-a="new"]')) showForm(); const b=e.target.closest(".item"); if(b) showDetail(+b.dataset.id); });
$("#fab").onclick = showForm; $("#add").onclick = showForm;
["#q","#cat","#sort"].forEach(s => $(s).addEventListener("input", render));
$("#scrim").onclick = closePanel; document.addEventListener("keydown", e => { if(e.key==="Escape") closePanel(); });
$("#panel").addEventListener("click", async e => {
 const button=e.target.closest("button[data-a]"); if(!button)return; const a=button.dataset.a, id=Number(button.dataset.id);
 if(a==="close")return closePanel();
 if(a==="pick")return $("#pf-file").click();
 if(a==="rmphoto")return removePhoto();
 if(a==="saveprof")return saveProfileName();
 if(a==="del"){ $("#panel .acts").innerHTML=`<div class="confirm">Delete this item? This can't be undone.</div><button class="btn danger" data-a="del2" data-id="${id}">Yes, delete</button><button class="btn ghost" data-a="close">Keep it</button>`;return; }
 try { if(a==="claim"||a==="reopen"){const updated=await apiRequest(`/items/${id}`,{method:"PATCH",body:JSON.stringify({status:a==="claim"?"claimed":"open"})});items=items.map(x=>x.id===id?updated:x);toast(a==="claim"?"Marked as claimed":"Item reopened");}
 else if(a==="del2"){await apiRequest(`/items/${id}`,{method:"DELETE"});items=items.filter(x=>x.id!==id);toast("Item deleted");}else return; closePanel();render();
 }catch(error){toast(error.message||"Couldn't update item.");}
});
$("#panel").addEventListener("submit", async e => { if(e.target.id!=="frm")return;e.preventDefault();
 const it={type:$("input[name=t]:checked").value,name:$("#f-name").value.trim(),cat:$("#f-cat").value,date:$("#f-date").value,loc:$("#f-loc").value.trim(),desc:$("#f-desc").value.trim(),contact:$("#f-contact").value.trim()};
 try{const saved=await apiRequest("/items",{method:"POST",body:JSON.stringify(it)});items.unshift(saved);closePanel();render();toast("Item saved to database");}catch(error){toast(error.message||"Couldn't save item.");}
});

const LS = {
  get(k){ try { return localStorage.getItem(k); } catch(e) { return null; } },
  set(k,v){ try { localStorage.setItem(k,v); return true; } catch(e) { return false; } }
};
let me = {username:"", name:"", avatar:""};
const initials = n => (n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("") || "?").toUpperCase();
const avatarHTML = size => `<span class="avatar ${size||""}">${me.avatar ? `<img src="${me.avatar}" alt="">` : esc(initials(me.name||me.username||"?"))}</span>`;

async function loadProfile(){
  if(!getToken()){ me = {username:"", name:"", avatar:""}; return paintMe(); }
  try {
    const p = await apiRequest("/profile");
    me = {username:p.username, name:p.name, avatar:p.avatar || ""};
    if(p.theme){ LS.set("lf-theme", p.theme); applyTheme(p.theme); }
    paintMe();
  } catch(error) { toast(error.message || "Couldn't load your profile."); }
}
async function saveProfile(patch){
  const p = await apiRequest("/profile", {method:"PATCH", body:JSON.stringify(patch)});
  me = {username:p.username, name:p.name, avatar:p.avatar || ""};
  paintMe(); refreshProfilePanel();
  return p;
}
function paintMe(){
  $("#me").innerHTML = `${avatarHTML()}<span><b>${esc(me.name||"Your profile")}</b><small>Profile &amp; theme</small></span>`;
  $("#mme").innerHTML = avatarHTML();
}
function refreshProfilePanel(){
  const holder = $("#pf-av"); if(holder) holder.innerHTML = avatarHTML("lg");
  const rm = $("#pf-rm"); if(rm) rm.hidden = !me.avatar;
}

function readAvatar(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
      const m = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, s, s);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", .85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image couldn't be read. Try a JPG or PNG.")); };
    img.src = url;
  });
}
async function pickPhoto(file){
  if(!file) return;
  try {
    if(!/^image\//.test(file.type)) throw new Error("Choose an image file (JPG, PNG or WebP).");
    await saveProfile({avatar: await readAvatar(file)});
    toast("Photo updated");
  } catch(error) { toast(error.message || "Couldn't update your photo."); }
}
async function removePhoto(){
  try { await saveProfile({avatar:""}); toast("Photo removed"); }
  catch(error) { toast(error.message || "Couldn't remove your photo."); }
}
async function saveProfileName(){
  const n = $("#pf-name").value.trim();
  if(!n) return toast("Enter a display name.");
  try { await saveProfile({name:n}); toast("Profile saved"); }
  catch(error) { toast(error.message || "Couldn't save your profile."); }
}

const THEMES = [["default","Default","Follows your device"],["light","Light","Always bright"],["dark","Dark","Easy on the eyes"]];
const getTheme = () => { const t = LS.get("lf-theme"); return t==="light"||t==="dark" ? t : "default"; };
function applyTheme(t){
  const root = document.documentElement;
  if(t==="light"||t==="dark") root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
}
async function setTheme(t){
  LS.set("lf-theme", t); applyTheme(t);
  try { await apiRequest("/profile", {method:"PATCH", body:JSON.stringify({theme:t})}); toast(`${THEMES.find(x=>x[0]===t)[1]} theme saved`); }
  catch(error) { toast(error.message || "Theme changed here, but couldn't be saved to your account."); }
}

function showProfile(){
  const t = getTheme();
  openPanel(`
    <h2>Profile &amp; appearance</h2>
    <div class="prof"><div id="pf-av">${avatarHTML("lg")}</div>
      <div class="prof-acts"><button class="btn" data-a="pick">Change photo</button><button class="btn ghost" id="pf-rm" data-a="rmphoto" ${me.avatar?"":"hidden"}>Remove</button></div></div>
    <input id="pf-file" type="file" accept="image/*" hidden>
    <label for="pf-name">Display name</label><input id="pf-name" maxlength="40" autocomplete="name" value="${esc(me.name)}">
    <label>Theme</label>
    <div class="choice three" role="radiogroup" aria-label="Theme">${THEMES.map(([v,n,d])=>`<label><input type="radio" name="theme" value="${v}" ${t===v?"checked":""}><span><b>${n}</b><small>${d}</small></span></label>`).join("")}</div>
    <div class="acts"><button class="btn" data-a="saveprof">Save changes</button><button class="btn ghost" data-a="close">Close</button></div>`);
}
$("#me").onclick = showProfile; $("#mme").onclick = showProfile;
$("#panel").addEventListener("change", e => {
  if(e.target.id==="pf-file"){ const f = e.target.files[0]; e.target.value = ""; pickPhoto(f); }
  else if(e.target.name==="theme") setTheme(e.target.value);
});

function setMode(m){const up=m==="up",rs=m==="rs",f=$("#lform");f.classList.toggle("up",up);f.classList.toggle("rs",rs);$("#m-in").setAttribute("aria-selected",m==="in");$("#m-up").setAttribute("aria-selected",up);$("#go").textContent=up?"Create account":rs?"Reset password":"Sign in";$("#lsub").textContent=up?"Create an account to start logging items.":rs?"Enter your username and full name, then choose a new password.":"Sign in to manage items at the desk.";$("#lpl").textContent=rs?"New password":"Password";$("#pw").autocomplete=(up||rs)?"new-password":"current-password";$("#err").textContent="";}
$("#lform").addEventListener("click",e=>{const mode=e.target.closest("[data-m]");if(mode)setMode(mode.dataset.m);});
function lock(){setToken("");me={username:"",name:"",avatar:""};paintMe();items=[];closePanel();document.body.classList.add("locked");$("#lform").reset();setMode("in");}
async function unlock(){document.body.classList.remove("locked");await Promise.all([loadProfile(),loadItems()]);}
$("#lform").addEventListener("submit",async e=>{e.preventDefault();const up=$("#lform").classList.contains("up"),rs=$("#lform").classList.contains("rs"),username=$("#u").value.trim().toLowerCase(),password=$("#pw").value,name=$("#nm").value.trim();const err=m=>$("#err").textContent=m;err("");
 try{
  if(rs){await apiRequest("/reset-password",{method:"POST",body:JSON.stringify({username,name,password})});setMode("in");$("#u").value=username;$("#pw").value="";toast("Password reset. Please sign in.");return;}
  if(up){const result=await apiRequest("/register",{method:"POST",body:JSON.stringify({username,name,password})});setToken(result.token);await unlock();toast("Account created. Welcome!");return;}
  const result=await apiRequest("/login",{method:"POST",body:JSON.stringify({username,password})});setToken(result.token);await unlock();toast("Welcome back!");
 }catch(error){err(error.message||"Request failed. Please try again.");}
});
$("#logout").onclick=lock;$("#logout2").onclick=lock;
$("#eye").onclick=()=>{const h=$("#pw").type==="password";$("#pw").type=h?"text":"password";$("#eye").textContent=h?"Hide":"Show";};

$("#cat").innerHTML=`<option value="all">All categories</option>`+Object.keys(CATS).map(c=>`<option value="${c}">${CATS[c]} ${c}</option>`).join("");
applyTheme(getTheme());paintMe();
render();if(getToken())unlock();else{document.body.classList.add("locked");$("#u").focus();}