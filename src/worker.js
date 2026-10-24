// 정적 파일(public/)은 Cloudflare가 먼저 응답하고, 나머지 요청만 여기로 온다.
// GET /api/live/:id → { live, name, hls }
// 브라우저에서 치지직 API를 직접 부르면 CORS로 막히므로 상태와 영상 주소만 중계한다. (영상 자체는 중계하지 않음)
export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/api\/live\/([^/]+)$/);
    if (m && req.method === 'GET') return live(m[1]);
    return env.ASSETS.fetch(req);
  },
};

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
