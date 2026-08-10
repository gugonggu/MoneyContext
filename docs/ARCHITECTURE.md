# Money Context Architecture

# 1. 목표

Money Context는 UI보다 재정 도메인 로직의 일관성이 중요한 애플리케이션이다. 따라서 화면, DB 접근, 계산 엔진을 분리하고 한 기능의 변경이 다른 영역에 암묵적으로 퍼지지 않도록 구성한다.

# 2. 권장 구조

```text
src/
├─ app/
│  ├─ (public)/
│  ├─ (auth)/
│  ├─ (app)/
│  └─ api/
├─ features/
│  ├─ accounts/
│  ├─ transactions/
│  ├─ cards/
│  ├─ budgets/
│  ├─ savings/
│  ├─ forecasts/
│  ├─ statistics/
│  ├─ exports/
│  └─ settings/
├─ domain/
│  ├─ money/
│  ├─ transactions/
│  ├─ accounts/
│  ├─ cards/
│  ├─ budgets/
│  ├─ savings/
│  └─ forecasts/
├─ server/
│  ├─ auth/
│  ├─ repositories/
│  ├─ services/
│  └─ supabase/
├─ components/
│  ├─ ui/
│  └─ layout/
├─ lib/
│  ├─ dates/
│  ├─ validation/
│  └─ utils/
└─ types/
```

기존 프로젝트 구조가 이미 있다면 위 구조를 기계적으로 강제하지 말고 동일한 책임 경계를 유지하는 방향으로 맞춘다.

# 3. 계층 책임

## app

Routing, Layout, Page composition을 담당한다. 도메인 계산 구현을 넣지 않는다.

## features

화면 단위 사용자 기능을 묶는다. Form, client interaction, feature-specific component를 포함할 수 있다.

## domain

Money Context의 핵심 계산 규칙을 구현한다.

예:

```text
calculateAccountBalance
calculateNetWorth
calculateCreditCardOutstanding
calculateBudgetUsage
calculateSalaryCycle
calculateSpendableAmount
calculateSavingsProjection
```

DB/API를 직접 호출하지 않는 순수 함수가 기본이다.

## server/repositories

Supabase query와 persistence를 담당한다.

예:

```text
TransactionRepository
AccountRepository
BudgetRepository
SavingsRepository
```

## server/services

여러 repository와 domain 함수를 조합해야 하는 use case를 담당한다.

예:

```text
CreateTransactionService
ConfirmPlannedTransactionService
GenerateRecurringTransactionsService
BuildDashboardService
BuildExportService
RestoreBackupService
```

# 4. 데이터 흐름 예시

## 지출 등록

```text
UI Form
→ server action / route handler
→ validation
→ CreateTransactionService
→ repository insert
→ domain invariants 검증
→ revalidate
→ dashboard/read model 재조회
```

## 대시보드

```text
Server Component
→ BuildDashboardService
→ repositories에서 필요한 최소 데이터 조회
→ domain calculation
→ Dashboard DTO
→ UI render
```

# 5. Read Model

복잡한 화면에서 raw table row를 그대로 UI에 전달하지 않는다.

예:

```ts
DashboardSummary
AccountOverview
CardOverview
BudgetOverview
SavingsGoalOverview
ForecastOverview
```

형태의 DTO를 사용한다.

# 6. 금액 타입

애플리케이션 내부에서 금액은 가능한 한 정수 KRW 최소단위로 다룬다.

외화는 원통화 amount와 KRW base_amount를 분리한다.

DB 타입은 PostgreSQL `numeric` 또는 충분한 범위의 integer 전략을 선택하되, 애플리케이션에서 JS floating point 오차가 발생하지 않게 한다.

# 7. 날짜 타입

- 거래 날짜: 사용자 관점의 `Asia/Seoul` 날짜/시간
- 생성/수정 timestamp: UTC 저장 가능
- 달력 월/급여 사이클 경계 계산: 반드시 `Asia/Seoul`

# 8. 자동/예약 작업

반복 거래 생성은 Vercel Cron 또는 Supabase Cron/Edge Function 중 하나로 구현 가능하다.

선택 원칙:

- DB와 가장 가까운 곳에서 안정적으로 실행할 수 있을 것
- 중복 실행에 안전한 idempotent 로직일 것
- 실패 후 다시 실행해도 동일 거래가 중복 생성되지 않을 것

`recurring_rule_id + scheduled occurrence date`의 unique constraint 또는 별도 occurrence key를 사용한다.

# 9. 캐시

초기에는 계산의 정확성을 우선해 source transaction 기반 계산을 사용한다.

데이터량이 증가해 성능 문제가 확인된 이후에만 다음을 고려한다.

- materialized view
- summary table
- current_balance_cache

캐시를 추가하면 원본 거래가 source of truth라는 원칙을 유지한다.

# 10. 에러 처리

에러를 최소한 다음으로 구분한다.

```text
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
DomainRuleError
InfrastructureError
```

사용자 화면에는 내부 SQL/Stack trace를 노출하지 않는다.

# 11. Observability

최소한 다음을 로깅한다.

- 요청/기능 이름
- 사용자 식별자는 내부 UUID의 최소 필요 형태
- 오류 코드
- correlation/request id

다음을 로그에 남기지 않는다.

- OAuth token
- Service Role Key
- 전체 Export/Backup 내용
- 사용자의 상세 금융 거래 메모 및 금액을 불필요하게 포함한 payload
