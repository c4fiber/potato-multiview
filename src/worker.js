// 정적 파일(public/)은 Cloudflare가 먼저 응답하고, 나머지 요청만 여기로 온다.
// GET /api/live/:id → { live, name, hls }   (치지직)
// GET /api/soop/:id → { live, name }        (SOOP)
// 브라우저에서 치지직 API를 직접 부르면 CORS로 막히므로 상태와 영상 주소만 중계한다. (영상 자체는 중계하지 않음)
export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    let m;
    if (req.method === 'GET' && (m = path.match(/^\/api\/live\/([^/]+)$/))) return live(m[1]);
    if (req.method === 'GET' && (m = path.match(/^\/api\/soop\/([^/]+)$/))) return soop(m[1]);
    return env.ASSETS.fetch(req);
  },
};

// SOOP(구 아프리카TV) 방송 상태. 비공식 API: CHANNEL.RESULT === 1 이면 방송 중
async function soop(id) {
  if (!/^[a-z0-9_]{3,20}$/i.test(id)) return json({ error: 'bad id' }, 400);
  // 도메인이 sooplive.com으로 바뀌는 중이라 새 주소를 먼저 쓰고, 실패하면 예전 주소로 한 번 더 시도한다
  let res;
  for (const host of ['live.sooplive.com', 'live.sooplive.co.kr']) {
    res = await fetch(`https://${host}/afreeca/player_live_api.php`, {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `bid=${id}&type=live&player_type=html5`,
    }).catch(() => null);
    if (res?.ok) break;
  }
  if (!res?.ok) return json({ error: 'upstream' }, 502);
  const c = (await res.json()).CHANNEL || {};
  return json({ live: c.RESULT === 1, name: c.BJNICK || null });
}

async function live(id) {
  if (!/^[0-9a-f]{32}$/i.test(id)) return json({ error: 'bad id' }, 400);

  const res = await fetch(`https://api.chzzk.naver.com/service/v3/channels/${id}/live-detail`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cf: { cacheTtl: 30, cacheEverything: true }, // 같은 채널은 30초간 엣지 캐시
  });
  if (!res.ok) return json({ error: 'upstream' }, 502);
  const c = (await res.json()).content || {};
  const isLive = c.status === 'OPEN';
  return json({ live: isLive, name: c.channel?.channelName || null, hls: isLive ? hlsUrl(c.livePlaybackJson) : null });
}

// livePlaybackJson은 JSON 문자열. media 중 일반 HLS를 우선 쓴다.
function hlsUrl(playback) {
  try {
    const media = JSON.parse(playback).media || [];
    return (media.find(m => m.mediaId === 'HLS') || media.find(m => m.mediaId === 'LLHLS'))?.path || null;
  } catch { return null; }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
});
