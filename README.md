# potato-multiview

여러 스트리머의 방송을 **한 화면의 그리드**로 보는 웹페이지. https://multiview.ntdcoworks.com

- 스트리밍 서버가 없다. 영상은 각 사용자의 브라우저가 플랫폼에서 직접 받는다.
- 구성(프리셋)은 URL에 저장된다. 즐겨찾기하거나 링크로 공유하면 같은 화면이 열린다.
- 채팅은 로그인이 필요해서 지원하지 않는다.

## 지원 플랫폼

| 플랫폼 | 칸 표시 방식 | 칸 클릭 | 방송 상태 확인 |
|---|---|---|---|
| 치지직 | 우리 플레이어(`<video>` + hls.js)로 HLS 직접 재생 | 클릭: 소리 켜기/끄기, 더블클릭: 전체화면 | `/api/live/:id` |
| SOOP | 공식 퍼가기 플레이어(iframe) | SOOP 플레이어 자체 컨트롤 | `/api/soop/:id` |
| 쿠팡플레이 *(최소 지원)* | 빈 칸 + 그 자리에 맞춘 작은 새 창 | 칸 안 버튼 또는 칩의 ↗ | 없음(항상 표시) |
| YouTube | 예정 (공식 퍼가기 플레이어, 클릭을 가로채지 않음) | | |

치지직을 iframe으로 넣지 않는 이유: 치지직이 `frame-ancestors`로 naver.com 바깥에서 띄우는 것을 막는다.
쿠팡플레이는 iframe을 막고 DRM이 걸려 있으며, 플레이어가 PiP도 지원하지 않는다. 그래서 새 창을 연다.

## 사용법

1. 하단 입력창에 방송 주소를 붙여넣고 **＋ 추가**를 누른다.
   - 치지직: `https://chzzk.naver.com/live/{32자리 ID}`
   - SOOP: `https://play.sooplive.com/{아이디}/{방송번호}`, `ch.sooplive.com/{아이디}` 등
   - 쿠팡플레이: `https://www.coupangplay.com/...`
2. 상태바의 **칩**으로 관리한다.
   - 체크: 방송 중일 때 화면에 띄울지 정한다. 6명이 방송 중이어도 2명만 볼 수 있다.
   - 드래그 앤 드롭: 칩 순서가 곧 칸 순서다. 다른 칩의 왼쪽 절반에 놓으면 그 앞, 오른쪽 절반에 놓으면 그 뒤로 간다.
   - ✕: 프리셋에서 뺀다.
   - 오프라인: 회색 글자, 빈 점, 취소선. 방송을 시작하면 1분 안에 자동으로 칸이 생긴다.
3. **⭐ 이 구성 저장**: 즐겨찾기(Ctrl/⌘+D) 안내가 뜨고, 공유 링크가 클립보드에 복사된다.

### 프리셋 URL 형식
```
#chzzk:{id},~soop:{id},coupang:{경로}
```
- 쉼표로 구분하며, 순서가 곧 칸 순서다.
- 앞에 `~`가 붙은 항목은 목록에만 두고 화면에 띄우지 않는다(체크 해제 상태).

## 동작 원칙

- **트래픽 절약(예외 없음)**: 체크를 끄거나 오프라인이 된 칸은 플레이어를 완전히 제거한다(hls.js `destroy`). 치지직은 칸 크기보다 큰 화질을 받지 않는다(`capLevelToPlayerSize`).
- **재생 유지**: 다른 칸이 켜지고 꺼지거나 순서가 바뀌어도 남은 칸은 DOM에서 옮기지 않고 CSS `order`로 자리만 바꾼다. iframe은 옮기면 새로고침되기 때문이다.
- **소리**: 여러 칸을 동시에 재생할 수 있다. 치지직 칸은 음소거 상태로 시작하고, 음소거 중에는 오른쪽 위에 🔇가 보인다. 브라우저 자동재생 정책 때문이다.
- **캐시**: html/js/css는 `Cache-Control: no-cache`로 보낸다. 배포 직후에도 예전 파일이 남지 않는다.

## 구조

```
public/
  index.html      화면 뼈대 (그리드 + 하단 상태바)
  app.js          프리셋, 칩, 그리드, 플랫폼 정의(PROVIDERS)
  style.css
  _headers        UTF-8, 캐시 설정
src/worker.js     Cloudflare Worker: 정적 파일 + 방송 상태 중계 API
wrangler.jsonc    Worker 설정 (커스텀 도메인, 미리보기 주소)
```

### Worker API
브라우저에서 플랫폼 API를 직접 부르면 CORS로 막혀서, 상태 정보만 중계한다. 영상은 중계하지 않는다. 모두 **비공식 API**라 플랫폼이 바꾸면 깨질 수 있다.

| 경로 | 원본 | 응답 |
|---|---|---|
| `GET /api/live/:id` | `api.chzzk.naver.com/service/v3/channels/{id}/live-detail` | `{ live, name, hls }` |
| `GET /api/soop/:id` | `live.sooplive.com/afreeca/player_live_api.php` (실패 시 `.co.kr`) | `{ live, name }` |

### 플랫폼 추가하기
`app.js`의 `PROVIDERS`에 항목을 추가한다.

| 필드 | 설명 |
|---|---|
| `label` | 칩 아이콘 툴팁 이름. 아이콘은 `style.css`의 `.pf-{키}` |
| `kind` | `'live'`(실시간, 우리 `<video>`면 클릭 음소거) 또는 `'vod'`(업로드 영상, 마우스 이벤트를 가로채지 않음) |
| `parse(text)` | 붙여넣은 주소에서 ID를 꺼낸다. 아니면 `undefined` |
| `embed(id, status)` | 칸에 넣을 요소(`<video>`, `<iframe>` 등) |
| `status(id)` | `Promise<{ live, name, hls?, frame?, slot? }>`. `hls`/`frame`/`slot` 중 하나가 있어야 칸이 생긴다 |
| `link(id)` | *(선택)* 칩에 ↗를 붙이고 새 창으로 연다 |

## 개발 · 배포

### 브랜치
- `main` = 운영(자동 배포). 직접 푸시하지 않는다.
- `preview` = 확인용. 고정 주소: https://preview-potato-multiview.qudcjf153.workers.dev
- 작업 순서
  1. `main`에서 `feat/…`(기능) 또는 `fix/…`(수정) 브랜치를 만든다.
  2. 작업 브랜치 → `preview`로 PR을 열고 머지한다. 위 고정 주소에서 확인한다.
  3. 확인이 끝나면 `preview` → `main`으로 PR을 열고 **merge commit**으로 머지한다. squash로 머지하면 두 브랜치의 기록이 갈라진다. `preview` 브랜치는 지우지 않는다.

### Cloudflare 설정 (최초 1회)
1. Workers & Pages → Create → Import a repository → 이 저장소
2. Root directory: 비움 / Build command: 비움 / Deploy command: `npx wrangler deploy`
3. Worker 이름은 `wrangler.jsonc`의 `name`(`potato-multiview`)과 같아야 한다.
4. Settings → Builds에서 production 빌드와 non-production branch 빌드를 켠다.

도메인, 미리보기 주소, workers.dev 끄기는 `wrangler.jsonc`에서 관리한다. 대시보드에서만 바꾸면 다음 배포 때 파일 값으로 되돌아간다.

### 로컬 실행
```
npx wrangler dev
```

## 보류 · 예정
- YouTube 지원
- 모바일: 칩 드래그(Pointer Events), 좁은 화면 상태바 두 줄 배치, 세로 화면 그리드, iPhone 전체화면. 사용자가 늘면 진행한다.
