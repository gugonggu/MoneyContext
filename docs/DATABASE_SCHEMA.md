# Money Context Database Schema

이 문서는 PostgreSQL/Supabase 기준 논리 스키마를 정의한다. 실제 migration 작성 시 명세와 Business Rule을 함께 적용한다.

# 1. 공통 규칙

- PK: UUID
- 사용자 소유 테이블: `user_id uuid not null`
- 생성/수정: `created_at timestamptz`, `updated_at timestamptz`
- 모든 사용자 소유 테이블 RLS 활성화
- 금액: `numeric(18,2)` 또는 정수 최소단위 정책 중 하나를 프로젝트 전체에서 통일
- 통화: ISO 4217 3자리 문자열
- 물리 삭제보다 `is_active` 비활성화를 우선하는 설정성 엔티티 존재

# 2. Enum

```text
user_role: USER, ADMIN
account_type: BANK, CASH, DEBIT, CREDIT_CARD, LIABILITY
transaction_type: INCOME, EXPENSE, TRANSFER, ADJUSTMENT
transaction_status: PENDING, CONFIRMED, CANCELLED
confirmation_mode: AUTO_CONFIRM, REQUIRE_CONFIRMATION
planned_status: PLANNED, CONFIRMED, CANCELLED
installment_status: SCHEDULED, PAID, CANCELLED
notification_type: RECURRING_CONFIRMATION, PLANNED_DUE, CARD_PAYMENT_DUE, BUDGET_THRESHOLD, SAVINGS_RISK, SYSTEM
```

# 3. profiles

```text
id uuid pk references auth.users(id) on delete cascade
display_name text not null
role user_role not null default USER
base_currency char(3) not null default 'KRW'
salary_cycle_day smallint not null check 1..31
timezone text not null default 'Asia/Seoul'
onboarding_completed boolean not null default false
created_at timestamptz not null
updated_at timestamptz not null
```

# 4. app_settings

서비스 전역 설정. 일반 사용자가 직접 접근하지 않는다.

```text
id uuid pk
invite_code_hash text not null
signup_enabled boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

공용 초대코드 원문을 평문 저장하지 않는다.

# 5. accounts

```text
id uuid pk
user_id uuid not null references profiles(id) on delete cascade
name text not null
type account_type not null
initial_balance numeric(18,2) not null default 0
linked_account_id uuid null references accounts(id)
is_active boolean not null default true
sort_order integer not null default 0
created_at timestamptz not null
updated_at timestamptz not null
```

제약:

- DEBIT이면 `linked_account_id` 필수
- DEBIT의 linked account는 동일 user의 BANK여야 함
- CREDIT_CARD, LIABILITY는 linked_account_id 사용 안 함

Index:

```text
(user_id, is_active, sort_order)
(user_id, type)
```

# 6. credit_card_settings

```text
id uuid pk
user_id uuid not null
account_id uuid not null unique references accounts(id) on delete cascade
payment_day smallint not null check 1..31
payment_account_id uuid not null references accounts(id)
credit_limit numeric(18,2) null
billing_cycle_start_offset integer null
billing_cycle_end_offset integer null
billing_cycle_rule jsonb not null
created_at timestamptz not null
updated_at timestamptz not null
```

`billing_cycle_rule`은 카드 이용기간 규칙을 직렬화한다. 규칙 파서는 별도 domain 모듈로 둔다.

# 7. categories

```text
id uuid pk
user_id uuid not null
name text not null
kind text not null check kind in ('INCOME','EXPENSE','BOTH')
is_system_default boolean not null default false
is_active boolean not null default true
sort_order integer not null default 0
created_at timestamptz not null
updated_at timestamptz not null
unique(user_id, lower(name))
```

# 8. tags

```text
id uuid pk
user_id uuid not null
name text not null
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
unique(user_id, lower(name))
```

# 9. recurring_transactions

```text
id uuid pk
user_id uuid not null
type transaction_type not null check type in ('INCOME','EXPENSE')
amount numeric(18,2) not null check (type = 'ADJUSTMENT' or amount >= 0)
currency char(3) not null
account_id uuid not null
category_id uuid null
memo text null
frequency text not null
interval_count integer not null default 1 check interval_count > 0
day_of_month smallint null
start_date date not null
end_date date null
next_run_date date not null
confirmation_mode confirmation_mode not null
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

# 10. planned_transactions

```text
id uuid pk
user_id uuid not null
type transaction_type not null check type in ('INCOME','EXPENSE')
status planned_status not null default PLANNED
scheduled_date date not null
amount numeric(18,2) not null
currency char(3) not null
base_amount numeric(18,2) null
base_currency char(3) not null default 'KRW'
exchange_rate numeric(24,10) null
account_id uuid null
category_id uuid null
memo text null
converted_transaction_id uuid null
created_at timestamptz not null
updated_at timestamptz not null
```

# 11. transactions

```text
id uuid pk
user_id uuid not null
type transaction_type not null
status transaction_status not null default CONFIRMED
transaction_at timestamptz not null
amount numeric(18,2) not null check amount >= 0
currency char(3) not null default 'KRW'
base_amount numeric(18,2) not null check (type = 'ADJUSTMENT' or base_amount >= 0)
base_currency char(3) not null default 'KRW'
exchange_rate numeric(24,10) null
category_id uuid null
account_id uuid null
from_account_id uuid null
to_account_id uuid null
memo text null
recurring_rule_id uuid null
recurring_occurrence_date date null
planned_transaction_id uuid null
created_at timestamptz not null
updated_at timestamptz not null
```

거래 유형 제약:

- INCOME: account_id 필수, from/to null
- EXPENSE: account_id 필수, from/to null
- TRANSFER: from_account_id와 to_account_id 필수, 서로 달라야 함
- ADJUSTMENT: account_id 필수

반복거래 중복 방지:

```text
unique(user_id, recurring_rule_id, recurring_occurrence_date)
where recurring_rule_id is not null
```

Index:

```text
(user_id, transaction_at desc)
(user_id, type, transaction_at desc)
(user_id, account_id, transaction_at desc)
(user_id, category_id, transaction_at desc)
```

# 12. transaction_tags

```text
transaction_id uuid not null references transactions(id) on delete cascade
tag_id uuid not null references tags(id) on delete cascade
primary key(transaction_id, tag_id)
```

RLS는 transaction 소유권과 tag 소유권이 동일 user임을 보장한다.

> **2026-08-12 정정:** `tag_id`도 `on delete cascade`가 필요하다. 원래 문서에는 누락되어 있었고, 실제로 계정 삭제(profiles → tags cascade)가 `transactions`를 거치는 별도 cascade 경로와 겹치면서 "still referenced from table transaction_tags" 오류로 삭제 자체가 실패하는 문제가 실사용 중 발견되었다 (`supabase/migrations/20260812140000_cascade_transaction_tags_tag_id.sql`).

# 13. installment_plans

```text
id uuid pk
user_id uuid not null
transaction_id uuid not null unique references transactions(id) on delete cascade
total_amount numeric(18,2) not null
installment_count integer not null check installment_count > 1
interest_type text not null check interest_type in ('INTEREST_FREE','INTEREST_BEARING')
start_month date not null
created_at timestamptz not null
updated_at timestamptz not null
```

# 14. installment_payments

```text
id uuid pk
user_id uuid not null
installment_plan_id uuid not null references installment_plans(id) on delete cascade
sequence integer not null
scheduled_date date not null
principal_amount numeric(18,2) not null
fee_amount numeric(18,2) not null default 0
status installment_status not null default SCHEDULED
settlement_transfer_id uuid null references transactions(id)
created_at timestamptz not null
updated_at timestamptz not null
unique(installment_plan_id, sequence)
```

# 15. monthly_budgets

```text
id uuid pk
user_id uuid not null
year smallint not null
month smallint not null check 1..12
total_budget numeric(18,2) not null check total_budget >= 0
created_at timestamptz not null
updated_at timestamptz not null
unique(user_id, year, month)
```

# 16. category_budgets

```text
id uuid pk
user_id uuid not null
year smallint not null
month smallint not null
category_id uuid not null
base_budget numeric(18,2) not null check base_budget >= 0
rollover_enabled boolean not null default false
rollover_amount numeric(18,2) not null default 0
created_at timestamptz not null
updated_at timestamptz not null
unique(user_id, year, month, category_id)
```

# 17. savings_goals

```text
id uuid pk
user_id uuid not null
name text not null
target_amount numeric(18,2) not null check target_amount > 0
target_date date not null
monthly_contribution_plan numeric(18,2) not null default 0
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

# 18. savings_contributions

```text
id uuid pk
user_id uuid not null
goal_id uuid not null references savings_goals(id) on delete cascade
amount numeric(18,2) not null check amount > 0
contribution_date date not null
transaction_id uuid null references transactions(id)
created_at timestamptz not null
```

한 contribution은 하나의 실제 transfer 또는 별도 적립 기록과 연결될 수 있다. 구현에서는 이중 집계를 막는다.

# 19. notifications

```text
id uuid pk
user_id uuid not null
type notification_type not null
title text not null
message text not null
related_entity_type text null
related_entity_id uuid null
dedupe_key text not null check trimmed non-empty
dedupe_day date not null
is_read boolean not null default false
created_at timestamptz not null
read_at timestamptz null
unique(user_id, dedupe_key, dedupe_day)
```

# 20. RLS 기본 패턴

사용자 소유 테이블 기본 정책:

```sql
using (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

`profiles`는 `id = auth.uid()` 기준.

ADMIN 기능은 브라우저에서 role 문자열만 믿지 않고 서버에서 세션 및 profile role을 검증한다.

# 21. Cross-user FK 방지

단순 FK만으로는 A 사용자의 account_id에 B 사용자의 account를 연결할 수 있는 문제가 생길 수 있다.

이를 막기 위해 다음 중 하나를 일관되게 사용한다.

1. composite ownership constraint/trigger
2. security definer 검증 함수
3. 서버 쓰기 서비스에서 ownership 검증 + DB trigger 방어

Money Context는 **서버 검증 + DB trigger/constraint 방어**를 권장한다.

# 22. 삭제 정책

- auth user 삭제 → profile 및 user-owned data cascade 가능
- category/tag/account는 사용 이력이 있으면 inactive 우선
- transaction hard delete는 사용자 명시 삭제 시 허용하되 연결된 installment/goal contribution 정합성을 transactionally 처리
- 계정 전체 삭제는 서버 전용 관리 작업으로 수행
