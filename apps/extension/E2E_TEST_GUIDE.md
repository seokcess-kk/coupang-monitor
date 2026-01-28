# PriceWatch E2E 수동 테스트 가이드

크롤링 버그 수정(메시징 패턴, 대시보드 자동 갱신) 이후 전체 흐름을 수동으로 검증하기 위한 테스트 절차입니다.

---

## 1. 사전 준비

### 1.1 Docker & DB

1. Docker Desktop이 실행 중인지 확인
2. PostgreSQL 컨테이너 시작:
   ```bash
   docker compose up -d
   ```
3. 컨테이너 상태 확인:
   ```bash
   docker compose ps
   # db 서비스가 running 상태여야 함 (port 5433 → 5432)
   ```
4. DB 마이그레이션 적용:
   ```bash
   pnpm db:migrate
   ```

### 1.2 환경 변수

프로젝트 루트의 `.env` 파일에 다음 값이 설정되어 있는지 확인:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/pricewatch"
EXTENSION_API_KEY="dev_key_change_me"   # 원하는 값으로 변경 가능
PAGE_TIMEOUT_MS=20000
DEFAULT_VARIANT_PER_RUN=15
```

> `EXTENSION_API_KEY` 값을 기억해 두세요. Extension popup 설정에서 동일한 값을 입력해야 합니다.

### 1.3 서버 & Extension 빌드

```bash
# Next.js 개발 서버 시작
pnpm dev

# 별도 터미널에서 Extension 번들 빌드
pnpm --filter @pricewatch/extension build
```

서버가 `http://localhost:3000`에서 정상 응답하는지 브라우저에서 확인합니다.

---

## 2. Extension 설치

1. Chrome 브라우저에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 토글 ON
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. `apps/extension` 폴더 선택 (`manifest.json`이 위치한 디렉토리)
5. "PriceWatch - Coupang Monitor" 확장 프로그램이 목록에 나타나는지 확인
6. Extension 아이콘 클릭하여 Popup 열기
7. 설정 입력:
   - **API URL**: `http://localhost:3000`
   - **API Key**: `.env`의 `EXTENSION_API_KEY` 값 (예: `dev_key_change_me`)

---

## 3. 테스트 데이터 준비

### 3.1 CSV 파일 작성

다음 형식으로 CSV 파일을 준비합니다. 최소 **3개 이상**의 서로 다른 쿠팡 상품 URL을 포함해야 합니다.

```csv
name,url,group,memo
테스트상품1,https://www.coupang.com/vp/products/123456?itemId=111&vendorItemId=222,테스트,메모1
테스트상품2,https://www.coupang.com/vp/products/789012?itemId=333&vendorItemId=444,테스트,메모2
테스트상품3,https://www.coupang.com/vp/products/345678?itemId=555&vendorItemId=666,테스트,메모3
```

> 실제 존재하는 쿠팡 상품 URL로 교체하세요. 쿠팡에서 상품 페이지를 열고 주소창의 URL을 복사하면 됩니다.

### 3.2 CSV 업로드

1. 대시보드(`http://localhost:3000`) 접속
2. **"Upload CSV"** 버튼 클릭
3. 준비한 CSV 파일 선택
4. 업로드 결과 확인: `Created: 3` (또는 준비한 상품 수)
5. 대시보드 테이블에 업로드한 상품들이 표시되는지 확인

---

## 4. 테스트 시나리오

### 시나리오 A: 크롤링 정확성

**목적**: 각 상품이 고유한 가격을 정상적으로 반환하는지 검증 (메시징 패턴 버그 수정 확인)

| 단계 | 동작 | 예상 결과 |
|---|---|---|
| A-1 | 대시보드에서 **"Refresh All"** 클릭 | Job이 생성됨 (상품 수만큼) |
| A-2 | Extension popup에서 **"Start"** 클릭 | 상태가 "Active"로 변경됨 |
| A-3 | 쿠팡 상품 탭이 자동으로 열리고 닫히는 것을 관찰 | 각 상품 페이지가 순차적으로 열림 |
| A-4 | 모든 Job 완료 후 대시보드에서 상품별 가격 확인 | 각 상품에 서로 다른 가격이 표시됨 |
| A-5 | 상품 이름 클릭하여 상세 페이지(`/items/{id}`) 진입 | Variant 목록과 가격 이력이 표시됨 |
| A-6 | DevTools(F12) → Console 탭 확인 | `message channel closed` 에러 없음 |

### 시나리오 B: 대시보드 자동 갱신

**목적**: 크롤링 진행 중 대시보드가 페이지 새로고침 없이 자동 갱신되는지 검증

| 단계 | 동작 | 예상 결과 |
|---|---|---|
| B-1 | 대시보드(`localhost:3000`)를 열어 둠 | 상품 목록 표시됨 |
| B-2 | **"Refresh All"** 클릭 후 Extension **"Start"** | 크롤링 시작 |
| B-3 | 대시보드 테이블 관찰 (페이지 새로고침 하지 않음) | 5초 간격으로 테이블이 자동 갱신됨 |
| B-4 | 가격 컬럼이 빈 상태에서 점진적으로 채워지는지 확인 | 크롤링 완료된 상품부터 가격이 표시됨 |
| B-5 | 모든 크롤링 완료 후 갱신 중단 확인 | 모든 Job이 DONE이면 자동 갱신 중단 |

### 시나리오 C: 타임아웃 처리

**목적**: 페이지 로드 타임아웃 시 정상적으로 TIMEOUT 상태가 기록되고 탭이 정리되는지 검증

| 단계 | 동작 | 예상 결과 |
|---|---|---|
| C-1 | `.env`에서 `PAGE_TIMEOUT_MS=3000`으로 변경 | - |
| C-2 | 서버 재시작 (`Ctrl+C` → `pnpm dev`) | 변경된 설정 적용 |
| C-3 | **"Refresh All"** → Extension **"Start"** | 크롤링 시작 |
| C-4 | 3초 내에 페이지 로드가 완료되지 않는 상품 관찰 | TIMEOUT/FAILED 상태로 기록됨 |
| C-5 | 타임아웃된 탭이 정상적으로 닫히는지 확인 | 열린 탭이 자동으로 닫힘 |
| C-6 | 테스트 후 `.env`의 `PAGE_TIMEOUT_MS`를 `20000`으로 복원 | - |

### 시나리오 D: 에러 복구

**목적**: 서버 중단 시 Extension이 안정적으로 동작하고 서버 복구 후 정상 재개되는지 검증

| 단계 | 동작 | 예상 결과 |
|---|---|---|
| D-1 | **"Refresh All"** → Extension **"Start"** | 크롤링 정상 시작 |
| D-2 | 크롤링 진행 중 서버 중단 (`Ctrl+C`) | Extension이 에러 발생 |
| D-3 | DevTools Console에서 Extension 로그 확인 | 네트워크 에러 로그 출력, crash 없음 |
| D-4 | Extension이 계속 폴링을 재시도하는지 확인 | 주기적으로 재시도 로그 출력 |
| D-5 | 서버 재시작 (`pnpm dev`) | - |
| D-6 | Extension이 자동으로 다음 Job을 받아 처리하는지 확인 | 크롤링 정상 재개 |

---

## 5. 검증 체크리스트

테스트 실행 후 아래 항목을 체크하세요.

### 크롤링 정확성 (시나리오 A)

- [ ] 각 상품이 서로 다른 고유 가격을 반환함
- [ ] 상세 페이지에서 Variant 목록이 정상 표시됨
- [ ] DevTools 콘솔에 `message channel closed` 에러 없음
- [ ] 모든 Job이 DONE 상태로 완료됨

### 대시보드 자동 갱신 (시나리오 B)

- [ ] 페이지 새로고침 없이 테이블이 자동 갱신됨
- [ ] 가격이 점진적으로 채워짐
- [ ] 모든 Job 완료 후 자동 갱신이 중단됨

### 타임아웃 처리 (시나리오 C)

- [ ] 타임아웃 시 TIMEOUT/FAILED 상태 기록됨
- [ ] 타임아웃된 탭이 자동으로 닫힘
- [ ] 타임아웃 후 다음 Job으로 정상 진행됨

### 에러 복구 (시나리오 D)

- [ ] 서버 중단 시 Extension이 crash 없이 에러 로그 출력
- [ ] 서버 중단 중에도 폴링 재시도 지속
- [ ] 서버 재시작 후 크롤링 정상 재개

---

## 6. 트러블슈팅

### Extension 로드 실패

- Extension 빌드를 다시 실행합니다:
  ```bash
  pnpm --filter @pricewatch/extension build
  ```
- `chrome://extensions`에서 Extension을 제거 후 다시 로드합니다.
- `apps/extension/dist/` 디렉토리에 `service-worker.js`, `content-script.js` 파일이 있는지 확인합니다.

### DB 연결 실패

- Docker 컨테이너 상태 확인:
  ```bash
  docker compose ps
  ```
- 컨테이너가 중지된 경우 재시작:
  ```bash
  docker compose down && docker compose up -d
  ```
- `.env`의 `DATABASE_URL` 포트가 `5433`인지 확인합니다.

### API Key 불일치 (401 Unauthorized)

- `.env`의 `EXTENSION_API_KEY` 값과 Extension popup에 입력한 API Key가 동일한지 확인합니다.
- 서버를 재시작하여 최신 `.env` 값이 적용되었는지 확인합니다.

### 크롤링이 시작되지 않음

- Extension popup 상태가 "Active"인지 확인합니다.
- 대시보드에서 "Refresh All"을 눌러 Job이 생성되었는지 확인합니다.
- DevTools → Console에서 Extension의 service worker 로그를 확인합니다.
  - `chrome://extensions` → PriceWatch → "서비스 워커" 링크 클릭

### 가격이 모두 동일하게 나옴

- 서로 다른 상품 URL을 사용했는지 확인합니다.
- Extension 빌드가 최신인지 확인합니다 (`pnpm --filter @pricewatch/extension build` 재실행).
- content script가 정상 주입되었는지 DevTools Console에서 확인합니다.
