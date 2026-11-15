/* Shared board logic: state, URL sync, filtering, grouping, time helpers.
   Each template supplies its own controls and row rendering. */
window.Board = (() => {
  const FILTERS = {
    posted: [["all","All"],["hour","Last hour"],["today","Today"],["week","This week"]],
    degree: [["any","Any degree"],["Bachelor's","Bachelor's"],["Master's","Master's"],["PhD","PhD"],["none","Not specified"]],
    auth:   [["any","Any work auth"],["Authorization required","Authorization required"],["Sponsorship available","Sponsorship available"],["Not specified","Not specified"]],
    model:  [["any","Any work model"],["Remote","Remote"],["Hybrid","Hybrid"],["Onsite","Onsite"]],
    source: [["any","Both sources"],["LinkedIn","LinkedIn"],["Jobright","Jobright"]],
  };
  const LABELS = {posted:"Posted", degree:"Degree", auth:"Work auth", model:"Work model", source:"Source"};
  const DEFAULTS = {q:"", posted:"all", degree:"any", auth:"any", model:"any", source:"any", sort:"new"};
  const state = {...DEFAULTS};
  const TZ = "America/New_York";
  const dayKey = d => new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  const dayFmt = new Intl.DateTimeFormat("en-US",{timeZone:TZ,weekday:"long",month:"long",day:"numeric"});
  const shortDayFmt = new Intl.DateTimeFormat("en-US",{timeZone:TZ,month:"short",day:"numeric"});
  const timeFmt = new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour:"numeric",minute:"2-digit"});
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  function rel(d, now){
    const m = Math.max(0, Math.round((now - d) / 60000));
    if (m < 60) return m <= 1 ? "just now" : `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const days = Math.round(h / 24);
    return days === 1 ? "yesterday" : `${days} days ago`;
  }
  function dayLabel(key, now){
    if (key === dayKey(now)) return "Today";
    if (key === dayKey(new Date(now - 86400000))) return "Yesterday";
    const [y, mo, da] = key.split("-").map(Number);
    return dayFmt.format(new Date(Date.UTC(y, mo - 1, da, 17)));
  }
  function readURL(){ const p = new URLSearchParams(location.search); for (const k in DEFAULTS) if (p.has(k)) state[k] = p.get(k); }
  function writeURL(){
    const p = new URLSearchParams(); for (const k in DEFAULTS) if (state[k] !== DEFAULTS[k]) p.set(k, state[k]);
    const qs = p.toString(); history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }
  function matches(j, now){
    const q = state.q.trim().toLowerCase();
    if (q && !(j.title + " " + j.company + " " + j.location).toLowerCase().includes(q)) return false;
    const age = now - new Date(j.posted_at);
    if (state.posted === "hour" && age > 3600000) return false;
    if (state.posted === "today" && dayKey(new Date(j.posted_at)) !== dayKey(now)) return false;
    if (state.posted === "week" && age > 7 * 86400000) return false;
    if (state.degree === "none" ? j.degrees.length : (state.degree !== "any" && !j.degrees.includes(state.degree))) return false;
    if (state.auth !== "any" && j.work_auth !== state.auth) return false;
    if (state.model !== "any" && j.work_model !== state.model) return false;
    if (state.source !== "any" && j.source !== state.source) return false;
    return true;
  }
  function isDefault(){ return Object.keys(DEFAULTS).every(k => state[k] === DEFAULTS[k]); }
  function clear(){ Object.assign(state, DEFAULTS); }

  // Controls: style = "chips" (segmented buttons) | "selects" (dropdowns) | "list" (vertical option lists)
  function mountControls(container, style, onChange, keys = Object.keys(FILTERS)){
    container.innerHTML = "";
    for (const key of keys) {
      const opts = FILTERS[key];
      const wrap = document.createElement("div"); wrap.className = "f f-" + key;
      if (style === "selects") {
        const sel = document.createElement("select"); sel.setAttribute("aria-label", LABELS[key]);
        for (const [v, l] of opts) { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); }
        sel.addEventListener("change", () => { state[key] = sel.value; onChange(); });
        wrap.appendChild(sel);
      } else {
        const name = document.createElement("div"); name.className = "f-name"; name.textContent = LABELS[key]; wrap.appendChild(name);
        const box = document.createElement("div"); box.className = "f-opts"; box.setAttribute("role", "group"); box.setAttribute("aria-label", LABELS[key]);
        for (const [v, l] of opts) {
          const b = document.createElement("button"); b.type = "button"; b.dataset.key = key; b.dataset.val = v;
          b.textContent = v === "any" ? "Any" : l;
          b.addEventListener("click", () => { state[key] = v; onChange(); });
          box.appendChild(b);
        }
        wrap.appendChild(box);
      }
      container.appendChild(wrap);
    }
  }
  function syncControls(container){
    container.querySelectorAll("select").forEach(sel => { const key = sel.closest(".f").className.match(/f-(\w+)/)[1]; sel.value = state[key]; });
    container.querySelectorAll("button[data-key]").forEach(b => b.setAttribute("aria-pressed", String(state[b.dataset.key] === b.dataset.val)));
  }
  function load(){ return fetch("jobs.json?t=" + Math.floor(Date.now() / 300000)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function group(shown){
    const groups = new Map();
    for (const j of shown) { const k = dayKey(new Date(j.posted_at)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(j); }
    return groups;
  }
  function sort(list){
    if (state.sort === "score") return [...list].sort((a, b) => (b.score || 0) - (a.score || 0) || (new Date(b.posted_at) - new Date(a.posted_at)));
    return [...list].sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
  }
  return {FILTERS, LABELS, DEFAULTS, state, dayKey, dayLabel, shortDayFmt, timeFmt, rel, esc, readURL, writeURL, matches, isDefault, clear, mountControls, syncControls, load, group, sort};
})();
