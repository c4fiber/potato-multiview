// 플랫폼 정의. 새 플랫폼은 여기에 추가한다.
// embed: 칸에 넣을 요소, status: { live, name, hls? } — 방송 중이면 그리드에 나타난다.
// link가 있으면 칩에 ↗가 붙고, 누르면 작은 새 창을 연다.
const PROVIDERS = {
  chzzk: {
    label: '치지직',
    parse: s => (s.match(/chzzk\.naver\.com\/(?:live\/)?([0-9a-f]{32})/i) || s.match(/^\s*([0-9a-f]{32})\s*$/i) || [])[1],
    embed: (id, s) => hlsPlayer(s.hls),
    status: id => fetch(`/api/live/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.status)), // { live, name, hls }
  },
  // SOOP은 공식 퍼가기 플레이어(iframe)를 제공한다. 상태는 /api/soop 이 중계한다.
  soop: {
    label: 'SOOP',
    parse: s => (s.match(/(?:sooplive\.(?:com|co\.kr)|afreecatv\.com)\/(?:station\/)?([a-z0-9_]{3,20})(?:[/?#]|$)/i) || [])[1]?.toLowerCase(),
    embed: id => Object.assign(document.createElement('iframe'), {
      src: `https://play.sooplive.com/${id}/embed`, allow: 'autoplay; fullscreen', allowFullscreen: true }),
    status: id => fetch(`/api/soop/${id}`).then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(s => ({ ...s, frame: true })), // { live, name }
  },
  // 쿠팡플레이는 iframe을 막고 DRM이 걸려 있어 칸 안에서 재생할 수 없다.
  // 대신 그리드에 빈 칸(slot)을 만들고, 그 칸의 화면 위치·크기에 맞춰 작은 새 창을 연다.
  coupang: {
    label: '쿠팡플레이',
    parse: s => (s.match(/coupangplay\.com\/([^?#\s,]+)/i) || [])[1],
    link: id => `https://www.coupangplay.com/${id}`,
    embed: id => fitSlot(id),
    status: async () => ({ live: true, name: '쿠팡플레이', slot: true }), // 상태를 알 수 없으므로 항상 표시
  },
};
const splitKey = k => { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1)]; };
const POLL_MS = 60_000;

// 치지직 페이지는 다른 사이트에서 iframe으로 열 수 없어서(frame-ancestors), 영상 주소(HLS)를 직접 재생한다.
// 영상은 브라우저가 네이버 서버에서 바로 받는다. 자동재생이 막히지 않도록 음소거로 시작.
// 재생바는 숨긴다(멈추면 라이브 시점으로 돌아올 수 없으므로). 클릭 = 소리 켜기/끄기, 더블클릭 = 전체화면
function hlsPlayer(src) {
  const v = Object.assign(document.createElement('video'), { muted: true, autoplay: true, playsInline: true });
  v.onclick = () => {
    v.muted = !v.muted; v.play().catch(() => {});
    const c = v.parentElement;
    c.classList.toggle('muted', v.muted);
    c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); // 애니메이션 다시 시작
  };
  v.ondblclick = () => document.fullscreenElement ? document.exitFullscreen() : v.parentElement.requestFullscreen?.();
  if (window.Hls?.isSupported()) {
    // capLevelToPlayerSize: 칸 크기보다 큰 화질은 받지 않는다 (칸이 작을수록 트래픽 절약)
    v.hls = new Hls({ capLevelToPlayerSize: true });
    v.hls.loadSource(src); v.hls.attachMedia(v);
  }
  else v.src = src; // Safari는 HLS 기본 지원
  return v;
}

// 화면에서 빠진 플레이어는 다운로드까지 완전히 멈춘다 (hls.js는 destroy 해야 멈춤)
function stopPlayer(v) {
  v.hls?.destroy();
  v.removeAttribute('src'); v.load();
}

// 새 창의 위쪽 제목줄·주소줄 높이(추정). 창 내용이 칸 높이에 맞도록 이만큼 뺀다.
const POPUP_BAR = 60;
const popups = {}; // id -> 열린 창 (다시 맞출 때 닫고 새로 연다)

// 빈 칸의 화면 좌표를 계산해 그 자리에 창을 연다. 칸이 없으면 기본 크기로 연다.
function openCoupang(id) {
  const slot = frames[`coupang:${id}`];
  let feat = 'popup,width=960,height=600';
  if (slot) {
    const r = slot.getBoundingClientRect();
    const border = (outerWidth - innerWidth) / 2;          // 멀티뷰 창의 좌우 테두리
    const top = outerHeight - innerHeight - border;          // 멀티뷰 창의 탭·주소줄 높이
    feat = `popup,left=${Math.round(screenX + border + r.left)},top=${Math.round(screenY + top + r.top)}`
      + `,width=${Math.round(r.width)},height=${Math.max(200, Math.round(r.height - POPUP_BAR))}`;
  }
  popups[id]?.close();
  popups[id] = window.open(PROVIDERS.coupang.link(id), `coupang:${id}`, feat);
}

// 그리드의 빈 칸: 이 자리에 쿠팡 창이 놓인다
function fitSlot(id) {
  const el = Object.assign(document.createElement('div'), { className: 'slot' });
  el.innerHTML = `<div><span class="pf pf-coupang"></span> 쿠팡플레이 자리</div><button>이 자리에 쿠팡플레이 띄우기 ↗</button><small>멀티뷰 창을 옮겼거나 칸 배치가 바뀌면 다시 누르세요</small>`;
  el.querySelector('button').onclick = () => openCoupang(id);
  return el;
}

const $ = id => document.getElementById(id);
const status = {}; // key -> { live: true|false|undefined, name }

// 구성은 주소창 #뒤에 저장 → 그대로 즐겨찾기/공유 가능
// 예) #chzzk:id1,~chzzk:id2  — 앞에 ~가 붙은 스트리머는 목록에만 두고 화면에는 띄우지 않는다
const entries = () => decodeURIComponent(location.hash.slice(1)).split(',')
  .map(e => ({ key: e.replace(/^~/, ''), shown: !e.startsWith('~') }))
  .filter(e => PROVIDERS[e.key.split(':')[0]]);
const getList = () => entries().map(e => e.key);
const isShown = key => entries().find(e => e.key === key)?.shown ?? true;
const save_ = es => { location.hash = es.map(e => (e.shown ? '' : '~') + e.key).join(','); };
const setList = list => save_(list.map(key => ({ key, shown: isShown(key) })));
const toggle = key => save_(entries().map(e => e.key === key ? { ...e, shown: !e.shown } : e));

function add(text) {
  for (const [p, def] of Object.entries(PROVIDERS)) {
    const id = def.parse(text);
    if (!id) continue;
    const key = `${p}:${id}`;
    if (getList().includes(key)) return toast('이미 추가된 방송이에요.');
    setList([...getList(), key]);
    return true;
  }
  toast('치지직 / SOOP / 쿠팡플레이 주소를 붙여넣어 주세요.<br>예) https://chzzk.naver.com/live/…');
}
const remove = key => setList(getList().filter(k => k !== key));

// 렌더링: 방송 중인 채널만 그리드에 표시 (아직 확인 전인 채널은 칩만 보임)
const frames = {}; // 같은 플레이어 재사용 → 렌더링 때마다 재생이 끊기지 않게
function render() {
  const list = getList();
  const live = list.filter(k => status[k]?.live && (status[k].hls || status[k].frame || status[k].slot));
  const onAir = live.filter(isShown); // 방송 중이면서 체크된 스트리머만 화면에 띄운다
  const pending = list.filter(k => status[k]?.live === undefined);

  const grid = $('grid');
  const cols = Math.ceil(Math.sqrt(onAir.length)) || 1;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${Math.ceil(onAir.length / cols) || 1}, 1fr)`;
  if (!onAir.length) {
    grid.innerHTML = `<div class="empty">${pending.length ? '방송 상태를 확인하는 중…' : live.length ? '아래에서 볼 스트리머 이름을 눌러 체크하세요.' : list.length ? '지금 방송 중인 스트리머가 없어요.' : '아래 입력창에 치지직 / SOOP 방송 주소를 붙여넣고<br><b>＋ 추가</b>를 누르세요.'}</div>`;
  } else {
    grid.querySelector('.empty')?.remove();
    for (const k of Object.keys(frames)) if (!onAir.includes(k)) { const v = frames[k].querySelector('video'); if (v) stopPlayer(v); frames[k].remove(); delete frames[k]; }
    onAir.forEach(k => {
      if (!frames[k]) {
        const [p, id] = splitKey(k);
        frames[k] = Object.assign(document.createElement('div'), { className: status[k].hls ? 'cell muted' : 'cell' });
        frames[k].appendChild(PROVIDERS[p].embed(id, status[k]));
      }
      grid.appendChild(frames[k]); // 순서 유지
    });
  }

  // 프리셋 전체를 한 줄로 보여준다. 오프라인은 취소선 칩, 많으면 좌우 스크롤
  $('chips').replaceChildren(...list.map(chip));
}

function chip(key) {
  const s = status[key] || {};
  const [p, id] = splitKey(key);
  const el = document.createElement('span');
  const pf = `<span class="pf pf-${p}" title="${PROVIDERS[p].label}"></span>`; // 플랫폼 아이콘
  el.className = 'chip' + (s.live === false ? ' off' : '') + (isShown(key) ? ' shown' : '');
  el.innerHTML = `<label><input type="checkbox">${pf}<span class="dot"></span><span class="name"></span></label><button class="x" title="목록에서 빼기">✕</button>`;
  const cb = el.querySelector('input');
  cb.checked = isShown(key);
  cb.title = '체크하면 방송 중일 때 화면에 띄워요';
  cb.onchange = () => toggle(key);
  el.querySelector('.name').textContent = s.name || id.slice(0, 8);
  if (PROVIDERS[p].link) {
    const open = Object.assign(document.createElement('button'), { className: 'open', title: '새 창으로 열기', textContent: '↗' });
    open.onclick = () => openCoupang(id);
    el.querySelector('.x').before(open);
  }
  el.querySelector('.x').onclick = () => remove(key);
  return el;
}

async function refresh() {
  await Promise.all(getList().map(async k => {
    const [p, id] = splitKey(k);
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
// 마우스 휠(세로)로도 칩 목록을 좌우로 넘길 수 있게
$('chips').addEventListener('wheel', e => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('chips').scrollLeft += e.deltaY; e.preventDefault(); }
}, { passive: false });
$('save').onclick = save;
window.addEventListener('hashchange', () => { render(); refresh(); });

render();
refresh();
setInterval(refresh, POLL_MS);
