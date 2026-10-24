// 플랫폼 정의. 새 플랫폼은 여기에 추가한다.
const PROVIDERS = {
  chzzk: {
    parse: s => (s.match(/chzzk\.naver\.com\/(?:live\/)?([0-9a-f]{32})/i) || s.match(/^\s*([0-9a-f]{32})\s*$/i) || [])[1],
    embed: (id, s) => hlsPlayer(s.hls),
    status: id => fetch(`/api/live/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.status)), // { live, name, hls }
  },
};
const POLL_MS = 60_000;

// 치지직 페이지는 다른 사이트에서 iframe으로 열 수 없어서(frame-ancestors), 영상 주소(HLS)를 직접 재생한다.
// 영상은 브라우저가 네이버 서버에서 바로 받는다. 자동재생이 막히지 않도록 음소거로 시작.
function hlsPlayer(src) {
  const v = Object.assign(document.createElement('video'), { muted: true, autoplay: true, playsInline: true, controls: true });
  if (window.Hls?.isSupported()) { const h = new Hls(); h.loadSource(src); h.attachMedia(v); }
  else v.src = src; // Safari는 HLS 기본 지원
  return v;
}

const $ = id => document.getElementById(id);
const status = {}; // key -> { live: true|false|undefined, name }

// 구성은 주소창 #뒤에 저장 → 그대로 즐겨찾기/공유 가능
const getList = () => decodeURIComponent(location.hash.slice(1)).split(',').filter(k => PROVIDERS[k.split(':')[0]]);
const setList = list => { location.hash = list.join(','); };

function add(text) {
  for (const [p, def] of Object.entries(PROVIDERS)) {
    const id = def.parse(text);
    if (!id) continue;
    const key = `${p}:${id}`;
    if (getList().includes(key)) return toast('이미 추가된 방송이에요.');
    setList([...getList(), key]);
    return true;
  }
  toast('치지직 방송 주소를 붙여넣어 주세요.<br>예) https://chzzk.naver.com/live/…');
}
const remove = key => setList(getList().filter(k => k !== key));

// 렌더링: 방송 중인 채널만 그리드에 표시 (아직 확인 전인 채널은 칩만 보임)
const frames = {}; // 같은 플레이어 재사용 → 렌더링 때마다 재생이 끊기지 않게
function render() {
  const list = getList();
  const onAir = list.filter(k => status[k]?.live && status[k].hls);
  const pending = list.filter(k => status[k]?.live === undefined);
  const offAir = list.filter(k => status[k]?.live === false);

  const grid = $('grid');
  const cols = Math.ceil(Math.sqrt(onAir.length)) || 1;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${Math.ceil(onAir.length / cols) || 1}, 1fr)`;
  if (!onAir.length) {
    grid.innerHTML = `<div class="empty">${pending.length ? '방송 상태를 확인하는 중…' : list.length ? '지금 방송 중인 스트리머가 없어요.' : '아래 입력창에 치지직 방송 주소를 붙여넣고<br><b>＋ 추가</b>를 누르세요.'}</div>`;
  } else {
    grid.querySelector('.empty')?.remove();
    for (const k of Object.keys(frames)) if (!onAir.includes(k)) { frames[k].querySelector('video').src = ''; frames[k].remove(); delete frames[k]; }
    onAir.forEach(k => {
      if (!frames[k]) {
        const [p, id] = k.split(':');
        frames[k] = Object.assign(document.createElement('div'), { className: 'cell' });
        frames[k].appendChild(PROVIDERS[p].embed(id, status[k]));
      }
      grid.appendChild(frames[k]); // 순서 유지
    });
  }

  $('live-chips').replaceChildren(...list.filter(k => status[k]?.live !== false).map(chip));
  $('offline-panel').replaceChildren(
    Object.assign(document.createElement('div'), { className: 'title', textContent: '방송 중이 아니라 화면에서 빠진 스트리머 (방송을 시작하면 자동으로 다시 나타나요)' }),
    ...offAir.map(chip));
  const t = $('offline-toggle');
  t.hidden = !offAir.length;
  if (!offAir.length) $('offline-panel').hidden = true;
  t.textContent = `○ 오프라인 ${offAir.length} ${$('offline-panel').hidden ? '▴' : '▾'}`;
}

function chip(key) {
  const s = status[key] || {};
  const el = document.createElement('span');
  el.className = 'chip' + (s.live === false ? ' off' : '');
  el.innerHTML = `<span class="dot"></span><span class="name"></span><button class="x" title="빼기">✕</button>`;
  el.querySelector('.name').textContent = s.name || key.split(':')[1].slice(0, 8);
  el.querySelector('.x').onclick = () => remove(key);
  return el;
}

async function refresh() {
  await Promise.all(getList().map(async k => {
    const [p, id] = k.split(':');
    try { status[k] = await PROVIDERS[p].status(id); } catch { /* 확인 실패 시 이전 상태 유지 */ }
  }));
  render();
}

let toastTimer;
function toast(html, ms = 3000) {
  const t = $('toast');
  t.innerHTML = html; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, ms);
}

async function save() {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  let copied = false;
  try { await navigator.clipboard.writeText(location.href); copied = true; } catch {}
  toast(`<b>${mac ? '⌘ + D' : 'Ctrl + D'}</b> 를 누르면 지금 구성이 즐겨찾기에 저장돼요.<br>`
      + `다음에 즐겨찾기를 누르면 같은 화면이 열려요.${copied ? '<br>(친구에게 보낼 링크도 복사됐어요 — 붙여넣기만 하세요)' : ''}`, 7000);
}

$('add-form').onsubmit = e => {
  e.preventDefault();
  if (add($('add-input').value)) $('add-input').value = '';
};
$('offline-toggle').onclick = () => { $('offline-panel').hidden = !$('offline-panel').hidden; render(); };
$('save').onclick = save;
window.addEventListener('hashchange', () => { render(); refresh(); });

render();
refresh();
setInterval(refresh, POLL_MS);
