// Cloudflare Pages Function: GET /api/live/:id → { live, name }
// 브라우저에서 치지직 API를 직접 부르면 CORS로 막히므로, 상태 확인만 중계한다. (영상은 중계하지 않음)
export async function onRequestGet({ params }) {
  const id = String(params.id);
  if (!/^[0-9a-f]{32}$/i.test(id)) return json({ error: 'bad id' }, 400);

  const res = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cf: { cacheTtl: 30, cacheEverything: true }, // 같은 채널은 30초간 엣지 캐시
  });
  if (!res.ok) return json({ error: 'upstream' }, 502);
  const c = (await res.json()).content || {};
  return json({ live: !!c.openLive, name: c.channelName || null });
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
});
