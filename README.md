# potato-multiview

치지직 방송 여러 개를 한 화면에서 보는 정적 웹페이지. 영상은 각 사용자의 브라우저가 치지직에서 직접 받는다.
(치지직 페이지는 iframe으로 넣을 수 없어서 영상 주소(HLS)를 hls.js로 직접 재생한다.)

## 구조
```
public/                 정적 파일 (html/css/js), 빌드 없음
src/worker.js           /api/live/:id — 방송 상태와 영상 주소를 알려주는 함수
wrangler.jsonc          Cloudflare Workers 설정
```

## 배포 (Cloudflare Workers, 최초 1회)
1. Cloudflare 대시보드 → Workers & Pages → Create → Import a repository → 이 저장소 선택
2. Build command: 비움 / Deploy command: `npx wrangler deploy`
3. Worker 이름은 `wrangler.jsonc`의 `name`과 같아야 한다.
4. Settings → Domains & Routes → Custom domain `multiview.ntdcoworks.com`

이후 `main`에 푸시하면 자동으로 배포된다. 다른 브랜치는 Settings → Builds에서 "non-production branch builds"를 켜면 미리보기 주소가 생긴다.

## 브랜치
- `main` = 운영. 직접 푸시하지 않는다.
- `preview` = 확인용. 주소가 바뀌지 않는다: https://preview-potato-multiview.qudcjf153.workers.dev
- 작업 순서
  1. `main`에서 `feat/…`(기능) 또는 `fix/…`(수정) 브랜치를 만든다.
  2. 작업 브랜치를 `preview`에 merge하고 푸시한다 → 위 고정 주소에서 확인한다.
  3. 확인이 끝나면 작업 브랜치 → `main`으로 PR → squash merge → 작업 브랜치 삭제.
- `preview`는 확인용이라 `main`으로 merge하지 않는다. 꼬이면 `main`에서 새로 만들어도 된다.

## 로컬 실행
```
npx wrangler dev
```
