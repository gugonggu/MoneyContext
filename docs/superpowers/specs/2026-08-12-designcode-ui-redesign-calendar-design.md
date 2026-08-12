# DesignCode UI 리디자인 + 달력 기록 뷰 — 설계

작성일: 2026-08-12

참조 디자인: [DesignCode UI — Figma Design UI Kit (Community)](https://www.figma.com/design/H4r8Mpw9d8DxA8sfKD1OqS/DesignCode-UI---Figma-Design-UI-Kit---Design-System--Community-?node-id=0-1)

## 1. 목표

두 가지를 한 번에 달성한다.

1. DesignCode UI 킷의 시각 언어(글래스 서피스, 큰 라운드, 레이어드 섀도, 절제된 그라디언트)를 Money Context 전 화면에 일관되게 적용한다.
2. 사용자가 자신의 기록을 달력으로 회고할 수 있는 `/calendar` 페이지를 신설하고, 홈에 진입점 역할의 미니 위젯을 둔다.

### 확정된 방향

| 항목 | 결정 |
|---|---|
| 달력 위치 | 독립 페이지 `/calendar` + 홈 미니 위젯 |
| 비주얼 강도 | 절제된 DesignCode — 그라디언트는 히어로/Primary에만, 숫자 위계 우선 |
| 적용 범위 | 전 화면 레이아웃 (13개 라우트) |
| 달력 셀 정보 | 수입/지출 두 줄 + 지출 히트맵 배경 |
| 미래 표시 | 예정 거래·카드 결제일·반복 고정비를 표시하되 시각적으로 분리하고 합계에서 제외 |

### 비목표 (YAGNI)

- 차트 라이브러리 도입 (Recharts, Chart.js 등) — SVG로 직접 그린다.
- 아이콘 라이브러리 도입 — 필요한 소수의 아이콘은 인라인 SVG로 둔다.
- 드래그로 거래 이동, 달력에서 인라인 편집 — 상세 패널에서 기존 편집 화면으로 보낸다.
- 주간 뷰의 시간축(타임라인) 표현 — 주간 뷰는 월간과 동일한 셀을 7칸으로 넓게 보여주는 수준까지만.

## 2. 제약과 기존 규칙

- `AGENTS.md` 3항: 재정 계산은 React 컴포넌트가 아니라 `domain` / `services`에 둔다. UI는 표시와 입력 수집만 한다.
- `AGENTS.md` 4항 재정 규칙 중 달력에 직접 걸리는 것:
  - 1번 — 이체는 수입도 지출도 아니다 → 달력 합계에서 제외.
  - 6번 — 잔액조정은 수입/소비 통계에 포함하지 않는다 → 달력 합계에서 제외.
  - 7번 — 예정 거래는 확정 전 실제 통계에 포함하지 않는다 → 달력 합계에서 제외하고 마커로만 표시.
  - 9번 — 과거 외화 거래는 저장 당시 `base_amount`로 분석한다 → 달력 집계는 `base_amount` 사용.
- `AGENTS.md` 3항: 날짜/기간 계산은 `Asia/Seoul` 기준을 명시적으로 적용한다.
- `AGENTS.md` 5항: 테스트를 삭제하거나 완화해서 구현을 통과시키지 않는다.
- `UI_UX.md` 14항: 색상만으로 수입/지출/위험을 구분하지 않는다.
- `UI_UX.md` 15항: 은행 앱처럼 무겁지 않게, 숫자 위계가 분명하게, 경고 색상 남용 금지.
- Next 16 App Router. Server Component가 기본이며 상호작용이 필요한 영역만 Client Component로 만든다.

## 3. 디자인 시스템

### 3.1 토큰 (`src/app/globals.css`)

현재는 화면마다 `slate-*` / `brand-*` 유틸리티를 직접 쓰고 있어 같은 역할의 표면이 화면마다 다른 색을 갖는다. 의미 기반 토큰을 한 겹 올린다.

추가할 토큰 그룹:

```text
표면    --color-surface-base      페이지 배경
        --color-surface-raised    카드
        --color-surface-overlay   시트/팝오버 (반투명)
경계    --color-border-subtle     카드 테두리
        --color-border-strong     구분선, 입력 테두리
텍스트  --color-text-primary      금액, 제목
        --color-text-secondary    라벨
        --color-text-muted        보조 설명
반경    --radius-card  20px       --radius-tile 16px   --radius-pill 999px
그림자  --shadow-card             낮은 알파 3겹 레이어드
        --shadow-lifted           호버/시트용
모션    --ease-soft / --ease-snappy   --duration-fast(120ms) / --duration-base(220ms)
```

라이트/다크 두 세트를 정의하고, 기존 `@custom-variant dark` 규칙을 그대로 사용한다. 기존 `brand` / `positive` / `negative` 팔레트는 유지한다.

### 3.2 시각 언어 3요소

DesignCode 킷에서 가져올 것을 세 가지로 한정한다.

1. **큰 라운드** — 카드 20px, 타일 16px. 현재 `rounded-xl`(12px)보다 확실히 부드럽다.
2. **레이어드 섀도** — 단일 `shadow-sm` 대신 낮은 알파 3겹을 쌓아 깊이를 만든다.
3. **글래스 서피스** — 반투명 배경 + `backdrop-blur` + 1px 인셋 하이라이트 보더. 시트, 상단바, 하단탭, 히어로 위 오버레이 카드에 사용한다.

**그라디언트는 히어로 카드와 Primary 버튼에만 쓴다.** 메시 그라디언트 배경, 노이즈 텍스처, 컬러 글로우는 쓰지 않는다. 금액 숫자가 주인공이고 색은 조연이라는 원칙을 유지한다.

### 3.3 프리미티브

기존 파일 확장:

| 파일 | 변경 |
|---|---|
| `ui/Card.tsx` | `variant: "plain" \| "glass" \| "gradient"` 추가, 라운드/섀도 토큰화 |
| `ui/Button.tsx` | 기존 4 variant 유지, `size` 추가, press 상태 스케일 |
| `ui/TextField.tsx` `ui/Select.tsx` `ui/Checkbox.tsx` `ui/ToggleButton.tsx` `ui/Alert.tsx` `ui/PageHeader.tsx` | 토큰 기반으로 재작성. **props 시그니처는 유지**하여 호출부 변경을 최소화한다 |

신규 파일:

| 파일 | 책임 |
|---|---|
| `ui/Surface.tsx` | 글래스 래퍼 (blur 강도 prop) |
| `ui/StatTile.tsx` | 라벨 + 큰 숫자 + 선택적 델타/보조문구 |
| `ui/Sparkline.tsx` | 순수 SVG 라인. 값 배열과 접근성 요약 텍스트를 받는다 |
| `ui/Ring.tsx` | 순수 SVG 진행 링 (예산 사용률, 카드 한도) |
| `ui/Segmented.tsx` | 탭 토글. 선택 인디케이터는 motion `layoutId` |
| `ui/Sheet.tsx` | 모바일 바텀시트 / 데스크톱 우측 사이드 패널. `AnimatePresence` |
| `ui/Skeleton.tsx` | 로딩 자리표시 |

`Sparkline`과 `Ring`은 `UI_UX.md` 10항에 따라 **항상 숫자를 병기**하고, `aria-label`로 텍스트 요약을 제공한다.

### 3.4 모션 (`motion` 라이브러리)

의존성: `motion` (구 `framer-motion`) **1개만** 추가한다.

**격리 규칙**: `motion`에서 import하는 코드는 `src/components/motion/` 디렉터리 안에만 둔다. 각 래퍼가 `"use client"`를 지고, 페이지는 Server Component로 유지한 채 데이터만 내려보낸다. 이렇게 하지 않으면 페이지 전체가 클라이언트로 끌려간다.

| 파일 | 책임 |
|---|---|
| `motion/MotionProvider.tsx` | `<MotionConfig reducedMotion="user">`. 루트 레이아웃에서 한 번 감싼다 |
| `motion/presets.ts` | spring 프리셋 3종(soft / snappy / gentle)과 transition 상수 |
| `motion/FadeIn.tsx` | 진입 fade + slide-up. `delay` prop으로 stagger |
| `motion/Stagger.tsx` | 자식 순차 진입 컨테이너 |
| `motion/PageTransition.tsx` | 라우트 전환 래퍼. `key={pathname}` |
| `motion/Pressable.tsx` | `whileTap` 스케일 |

**접근성**: `reducedMotion="user"`가 `prefers-reduced-motion: reduce`를 전역으로 존중한다. 이 설정 아래에서는 위치/스케일 애니메이션이 제거되고 opacity만 남는다.

**모션 적용 원칙** — 다음에만 쓴다.

- 상태 변화를 설명할 때 (달력 월 이동 방향, 탭 인디케이터 이동, 시트 열림)
- 진입 시 위계를 만들 때 (히어로 → 스탯 → 리스트 순차 진입, 총 300ms 이내)
- 터치 피드백 (press 스케일)

장식용 무한 루프 애니메이션, 스크롤 패럴랙스, 숫자 카운트업은 쓰지 않는다.

## 4. 셸 / 네비게이션

`components/nav/AppShell.tsx` 재작성.

- **사이드바**: 아이콘 + 라벨. active 표시를 motion `layoutId` 필로 미끄러지게 한다. 상단 로고, 하단 테마 토글은 유지.
- **데스크톱 상단바 신설**: 페이지 타이틀 + 페이지 액션 + 알림 벨. 현재 알림은 `/notifications` 라우트에만 있어 접근성이 낮다. 벨은 링크이며 미확인 건수 배지를 붙인다.
- **모바일 하단탭**: 중앙 `+ 입력`을 FAB로 띄워 `UI_UX.md` 2장의 Primary Action 원칙을 시각적으로 실현한다. active 인디케이터는 `layoutId`.
- **콘텐츠 폭**: `max-w-3xl` → `max-w-5xl`. 데스크톱 여백이 과하고 카드 그리드를 못 쓰고 있다.
- **라우트 전환**: `PageTransition`으로 fade + 8px slide-up, 120ms.

`nav-items.ts`에 달력 항목을 추가한다.

```text
사이드바: 홈 · 거래내역 · 달력 · 자산 · 계획 · 통계 · AI Export · 설정
하단탭:   홈 · 내역 · [+ 입력] · 달력 · 더보기
```

하단탭에서 `계획`을 `달력`으로 교체한다. 계획은 `더보기`에서 접근한다. 모바일에서는 회고(달력)가 계획보다 사용 빈도가 높다는 판단이며, 계획 화면 자체는 그대로 유지된다.

## 5. 달력

### 5.1 도메인 계층 (순수 함수)

**`src/domain/calendar/month.ts`**

```ts
type CalendarDay = {
  date: string;          // YYYY-MM-DD (Asia/Seoul)
  inCurrentMonth: boolean;
  isToday: boolean;
  weekday: number;       // 0=일 .. 6=토
};

type DailyTotals = { income: number; expense: number };

type CalendarCell = CalendarDay & {
  totals: DailyTotals;
  heatLevel: 0 | 1 | 2 | 3 | 4;
  upcoming: readonly UpcomingMarker[];
};

buildMonthGrid(year, month, today): readonly CalendarDay[]   // 항상 42칸(6주)
aggregateDailyTotals(transactions): ReadonlyMap<string, DailyTotals>
heatLevels(expenseByDate): ReadonlyMap<string, 0|1|2|3|4>
buildCalendarMonth(...): { cells, summary }
```

집계 규칙:

- `status === "CONFIRMED"` 이며 `type`이 `INCOME` 또는 `EXPENSE`인 거래만 합산한다. `TRANSFER`와 `ADJUSTMENT`는 제외한다 (재정 규칙 1·6).
- 금액은 `baseAmount`를 쓴다 (재정 규칙 9).
- 날짜 키는 `transactionAt`(timestamptz)을 **Asia/Seoul로 변환한 뒤** `YYYY-MM-DD`로 자른다. 현재 `group-by-date.ts`처럼 `slice(0, 10)`으로 자르면 UTC 기준이 되어 한국 시간 오전 9시 이전 거래가 전날로 밀린다. 달력에서는 이 오차가 눈에 보이므로 변환을 명시한다.

히트맵:

- 해당 월에 지출이 있는 날들의 지출액만 모아 **분위수**로 4구간을 만든다. 최댓값 대비 선형 스케일을 쓰면 급여일 등 이상치 하나에 나머지 날이 전부 0단계로 눌린다.
- 지출이 0인 날은 항상 레벨 0.

**`src/domain/calendar/upcoming.ts`**

```ts
type UpcomingMarker = {
  kind: "PLANNED" | "CARD_PAYMENT" | "RECURRING";
  label: string;
  amount?: number;   // 표시용. 합계에는 절대 넣지 않는다
};

collectUpcomingMarkers(input, rangeStart, rangeEnd): ReadonlyMap<string, UpcomingMarker[]>
```

- `PLANNED` — `status === "PLANNED"`인 예정 거래의 `scheduledDate`.
- `CARD_PAYMENT` — `credit_card_settings.payment_day`를 해당 월에 대입. 말일 보정(예: 31일 결제일 + 2월)을 한다.
- `RECURRING` — 활성 반복 규칙을 조회 범위 안에서 전개한다. 기존 `domain/recurring/schedule.ts`의 `nextOccurrenceDate`를 재사용하며 새 스케줄 로직을 만들지 않는다.
- 이미 확정 거래로 생성된 반복 발생일은 중복 표시하지 않는다 (같은 날짜에 해당 `recurringRuleId`의 CONFIRMED 거래가 있으면 마커를 생략).

**이 마커들은 `summary`와 셀의 `totals`에 절대 합산되지 않는다** (재정 규칙 7).

**`src/lib/dates/seoul.ts`** (신규, 공유)

`toSeoulDate(isoTimestamp): string`. 현재 `server/notifications/repository.ts`에 같은 로직이 비공개 함수로 있다. 달력이 동일한 변환을 필요로 하므로 공유 위치로 추출하고, 알림 리포지토리도 이 함수를 import하도록 바꾼다. `tests/integration/notifications.test.ts`가 안전망이 된다. 그 외 리팩터링은 하지 않는다.

### 5.2 서버 계층

`src/server/calendar/{index,repository,service}.ts`

기존 `searchTransactionsForCurrentUser`는 `limit` 상한이 100이라 한 달치 거래를 보장하지 못한다. 달력 전용 조회를 둔다.

```ts
getCalendarMonthForCurrentUser(year: number, month: number): Promise<CalendarMonthData>
```

한 번의 병렬 조회로 아래를 가져온다. 범위는 Asia/Seoul 기준 해당 월 1일 00:00부터 말일 24:00까지이며, 그리드 앞뒤로 걸친 이웃 달 날짜도 포함하도록 42칸 범위로 잡는다.

- `transactions` — 범위 내, `CONFIRMED`, `INCOME`/`EXPENSE`. 필요한 컬럼만 (`id,type,transaction_at,base_amount,memo,category_id,account_id,recurring_rule_id`)
- `planned_transactions` — 범위 내 `PLANNED`
- `credit_card_settings` — `account_id,payment_day`
- `recurring_rules` — 활성 규칙
- `categories`, `accounts` — 상세 패널 라벨용 이름 맵

서비스는 조회 결과를 도메인 함수에 넘겨 `CalendarMonthData`를 만들어 반환한다. 계산은 서비스가 아니라 도메인에 있다.

### 5.3 UI

**`src/app/(app)/(shell)/calendar/page.tsx`** — Server Component. `?ym=YYYY-MM` 쿼리를 읽어 서비스를 호출하고 결과를 클라이언트 컴포넌트에 넘긴다. 잘못된 `ym`은 이번 달로 폴백한다.

**`src/components/calendar/CalendarMonth.tsx`** — Client Component.

레이아웃:

```text
┌─────────────────────────────────────────────┐
│ ◀  2026년 8월  ▶            [ 월 | 주 ]     │
│ 수입 3,240,000  지출 1,912,400  순 +1,327,600│
├───┬───┬───┬───┬───┬───┬───┤
│ 일 │ 월 │ 화 │ 수 │ 목 │ 금 │ 토 │
├───┼───┼───┼───┼───┼───┼───┤
│   │   │   │   │   │ 1 │ 2 │
│   │   │   │   │   │   │   │
├───┼───┼───┼───┼───┼───┼───┤
│ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │
│   │   │   │+2,500,000│ │ │ │   ← 수입 있는 날만 윗줄
│   │-8,200│-47,000│-132,000│ │ │  ← 지출 아랫줄
└───┴───┴───┴───┴───┴───┴───┘
```

셀 규격:

- 날짜 숫자 (오늘은 필 배경, 이웃 달은 흐리게)
- 수입이 있으면 초록 계열 윗줄 `+금액`
- 지출이 있으면 기본 텍스트색 아랫줄 `-금액`
- 배경은 지출 히트맵 0–4단계
- 예정 마커가 있으면 **점선 하단 보더 + 점(dot)**. 확정은 실선 영역, 예정은 점선으로 구분한다
- 토요일/일요일 날짜 숫자 색 구분

월 이동:

- `◀ ▶` 버튼과 좌우 방향키. `AnimatePresence`로 이동 방향에 맞춰 슬라이드 + fade.
- URL을 `?ym=2026-08`로 바꾼다. 뒤로가기, 새로고침, 링크 공유가 모두 동작해야 한다.
- 주간 뷰는 `?ym`에 더해 `?w=YYYY-MM-DD`(주 시작일)를 쓴다.

날짜 상세:

- 셀 클릭 → `Sheet` 열림. 그날의 확정 거래 목록(메모/카테고리/결제수단/금액)과 예정 항목을 **구분된 섹션**으로 보여준다.
- `이 날짜로 기록` 버튼 → `/transactions/new?date=YYYY-MM-DD`. 기존 `QuickEntryForm`이 `date` 쿼리를 초기값으로 받도록 확장한다.
- 각 거래 행에서 기존 `/transactions/{id}/edit`로 이동할 수 있다.

접근성:

- 그리드는 `role="grid"`, 셀은 `role="gridcell"`. 방향키로 셀 간 이동, `Enter`/`Space`로 상세 열기, `Esc`로 닫기.
- 각 셀 `aria-label` 예: `"8월 5일 화요일, 지출 47,000원, 예정 1건"`. 히트맵 색과 점선에만 의존하지 않는다 (`UI_UX.md` 14항).
- `Sheet`는 열릴 때 포커스를 가두고 닫힐 때 트리거로 되돌린다.

빈 상태:

> 이번 달 기록이 아직 없어요.
> 첫 지출을 기록하면 이 달력에 소비 흐름이 그려집니다.
> [첫 거래 기록]

**`src/components/calendar/CalendarStrip.tsx`** — 홈 미니 위젯. 최근 14일 히트 스트립 + 오늘 요약. 클릭 시 `/calendar`. 데이터는 대시보드 서비스가 아니라 달력 서비스의 범위 조회를 재사용한다.

## 6. 화면별 적용

### 홈 `/home`

```text
[히어로 — gradient Card]
  여유 지출액  1,240,000원          (가장 큰 숫자)
  일일 지출 가능액  41,300원
  최근 30일 지출 스파크라인
[스탯 그리드 — StatTile × 6]
  수입 / 지출 / 예산 사용액 / 유동자산 / 순자산 / 카드 미결제
[달력 스트립]  최근 14일 + 오늘 요약 → /calendar
[예산 위험]    80% 이상 사용 카테고리만 (UI_UX.md 3장)
[다가올 일정]  카드 결제 · 반복 고정비 · 예정 거래
```

현재 `DashboardOverview`는 스탯 8개를 균등 나열해 위계가 없다. 히어로 2개와 타일 6개로 나눈다. 예산 위험과 다가올 일정은 대시보드 서비스에 필드가 없으므로 **기존 계획/알림 서비스의 읽기 함수를 재사용**한다. 새 계산 로직을 만들지 않는다.

### 거래내역 `/transactions`

- 필터 폼을 접이식 툴바로 바꾸고, 적용 중인 필터를 칩으로 상단에 노출한다. 현재는 10개 필드가 항상 펼쳐져 리스트를 밀어낸다.
- 데스크톱 테이블: 토큰 기반 재작성, 금액 우측 정렬, 행 호버.
- 모바일: 날짜 그룹 카드 유지, 간격/타이포 정돈.
- 상단에 `달력으로 보기` 링크를 둔다.

### 달력 `/calendar` — 5장

### 자산 `/assets`

총자산·부채·순자산 히어로 + 그룹 섹션(은행/현금 · 체크 · 신용카드 · 일반부채). 카드에는 `Ring`으로 한도 사용률을 표시한다.

### 계획 `/plans`

`Segmented` 탭(예산 / 저축 목표 / 미래 현금흐름). 예산은 진행바, 현금흐름은 확정/예정을 시각적으로 구분한 워터폴 스타일 리스트 (`UI_UX.md` 9장).

### 통계 `/statistics`

`Sparkline`과 도넛으로 월별 추세·카테고리 비율을 그리되 **수치를 항상 병기**한다 (`UI_UX.md` 10장).

### 나머지

`/export`, `/settings`, `/more`, `/notifications`, `/onboarding`, `/transactions/new`, `/transactions/[id]/edit`, `/transactions/planned`, `/transactions/recurring` — 새 프리미티브 적용과 폼/리스트 간격 정돈. 정보 구조는 바꾸지 않는다.

## 7. 단계 분할

각 단계는 독립적으로 검증 가능하며 단계 끝에서 커밋한다.

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1 | `motion` 설치, 토큰, 프리미티브 확장/신규, motion 래퍼 | typecheck/lint 통과, 기존 화면이 깨지지 않음 |
| 2 | AppShell·상단바·하단탭·nav-items·PageTransition | `app-shell.test.tsx` 갱신 후 통과 |
| 3 | `lib/dates/seoul.ts`, `domain/calendar/*`, `server/calendar/*` | 신규 유닛 테스트 통과 |
| 4 | `/calendar` 페이지, `CalendarMonth`, `Sheet` 상세, 홈 `CalendarStrip` | 컴포넌트 테스트 + E2E 통과 |
| 5 | 홈·거래내역·통계 레이아웃 | 관련 테스트 갱신 후 통과 |
| 6 | 자산·계획·나머지 9개 화면 | 전체 게이트 통과 |

## 8. 테스트

### 신규 유닛

`tests/unit/calendar-month.test.ts`

- 42칸 그리드 생성: 1일이 일요일인 달, 토요일인 달, 2월(28/29일), 12월→1월 경계
- `inCurrentMonth` 플래그가 이웃 달 날짜에서 false
- 집계: `TRANSFER`와 `ADJUSTMENT`가 합계에 들어가지 않는다
- 집계: `PENDING` / `CANCELLED` 거래가 합계에 들어가지 않는다
- 집계: 외화 거래는 `amount`가 아니라 `baseAmount`로 합산된다
- Asia/Seoul 경계: `2026-08-05T15:30:00Z`(한국 8월 6일 00:30)가 `2026-08-06` 칸에 들어간다
- 히트맵: 이상치가 하나 있어도 나머지 날들이 0단계로 붕괴하지 않는다
- 히트맵: 지출 0인 날은 레벨 0

`tests/unit/calendar-upcoming.test.ts`

- 예정 거래가 마커로 잡히되 `summary`와 `totals`에는 들어가지 않는다
- 카드 결제일 31일 + 2월 → 말일로 보정된다
- 반복 규칙이 조회 범위 안에서 전개된다
- 이미 확정 거래로 생성된 반복 발생일은 마커가 중복 생성되지 않는다

`tests/unit/seoul-date.test.ts`

- UTC 자정 전후 변환, DST 없음 확인

### 신규 컴포넌트 테스트

`tests/unit/calendar-month.test.tsx`

- 수입 있는 날에만 수입 줄이 렌더된다
- 예정 마커가 있는 셀에 예정 표시가 렌더된다
- 셀 `aria-label`에 날짜·지출액·예정 건수가 텍스트로 들어간다
- 방향키로 포커스가 이동하고 `Enter`로 상세가 열린다
- 빈 달에 빈 상태 문구와 CTA가 렌더된다

### 신규 E2E

`tests/e2e/calendar.spec.ts` — 로그인 → `/calendar` 진입 → 이전 달 이동(URL `?ym` 확인) → 거래가 있는 날 클릭 → 상세 패널에 해당 거래 표시.

### 갱신이 필요한 기존 테스트

`app-shell.test.tsx`, `dashboard-overview.test.tsx`, `home-page.test.tsx`, `asset-overview.test.tsx`, `planning-overview.test.tsx`, `notification-center.test.tsx`, `quick-entry-form.test.tsx`, `edit-transaction-form.test.tsx`, `markdown-export.test.tsx`, `export-download-controls.test.tsx`, `backup-restore.test.tsx`, `delete-account.test.tsx`, `admin-invite-settings.test.tsx`

이 테스트들은 마크업 구조나 클래스에 의존하는 부분에서 깨진다. **기대값은 명세와 재정 규칙에 부합하는 범위에서만 조정하고, 검증 자체를 삭제하거나 완화하지 않는다** (`AGENTS.md` 5항). 재정 계산을 검증하는 단언은 그대로 둔다.

### 게이트

```text
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

## 9. 리스크

| 리스크 | 대응 |
|---|---|
| `motion`이 페이지를 클라이언트로 끌어당김 | import를 `components/motion/`에 격리, 페이지는 Server Component 유지 |
| UI 테스트 다수가 깨짐 | 단계별로 해당 테스트를 함께 갱신하고 단계 끝에서 전체 스위트를 돌린다 |
| 한 달 거래가 많은 사용자 | 달력 전용 리포지토리로 필요한 컬럼만, 범위 조건으로 조회. `search()`의 limit 100 우회 |
| 히트맵/점선이 색에만 의존 | 금액 텍스트 병기 + `aria-label` 텍스트 요약 |
| 범위가 커서 중간에 방향이 어긋남 | 6단계로 나누고 각 단계 끝에서 검증·커밋 |
| 예정 금액이 실제 통계에 섞임 | 도메인 타입에서 `totals`와 `upcoming`을 분리하고, 합산 금지를 유닛 테스트로 고정 |
