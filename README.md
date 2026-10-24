# potato-multiview

치지직 방송 여러 개를 한 화면에서 보는 정적 웹페이지. 영상은 각 사용자의 브라우저가 치지직에서 직접 받는다.

## 구조
```
public/                 정적 파일 (html/css/js), 빌드 없음
functions/api/live/     방송 중인지 확인하는 함수 (Cloudflare Pages Functions)
```

## 배포 (Cloudflare Pages, 최초 1회)
1. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git → 이 저장소 선택
2. Build command: 비움 / Build output directory: `public`
3. Custom domains → `multiview.ntdcoworks.com` 추가 (DNS 레코드는 자동 생성)

이후 `main`에 푸시하면 자동으로 배포되고, 다른 브랜치를 푸시하면 미리보기 주소가 생긴다.

## 브랜치
- `main` = 운영. 직접 푸시하지 않는다.
- 작업은 `feat/…`, `fix/…` 브랜치 → PR(미리보기 주소로 확인) → squash merge → 브랜치 삭제

## 로컬 실행
```
npx wrangler pages dev public
```
