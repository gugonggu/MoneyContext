# Money Context Export & Backup Formats

# 1. 목적 구분

Money Context에는 세 종류의 데이터 내보내기가 있다.

1. GPT Markdown Export — 사람이 복사해 AI에 붙여넣기 위한 문맥
2. Analysis JSON/CSV — 구조화 분석용 데이터
3. Full Backup JSON — 복구 가능한 전체 데이터

서로 같은 포맷으로 취급하지 않는다.

# 2. GPT Markdown

## Header

```markdown
# Money Context 재정 데이터

생성일: 2026-08-10T15:00:00+09:00
기준 통화: KRW
분석 기간: 2026-08-01 ~ 2026-08-31
분석 목적: 이번 달 소비 분석
```

## 포함 가능한 섹션

```text
재정 상태
기간 요약(수입/지출/기간 잉여금/수입 대비 잉여율/저축 목표 적립액/저축 목표 적립률)
예산
카테고리별 소비
태그별 소비
결제수단별 소비
외부 자금 이동(위 수입/지출에 이미 포함)
소비 성격(반복성/일회성/미분류)
고정비/변동비
예정 현금흐름
카드 현황
저축 목표
거래 내역
데이터 해석 주의사항
```

분석 목적에 따라 불필요한 섹션은 생략한다.

## 기간 요약 — 잉여금과 저축 목표 적립액 분리

`수입 - 지출`은 **기간 잉여금**이며 저축이 아니다. **저축 목표 적립액**은 분석 기간 내 `savings_contributions` 합계만 사용하며, Money Context 저축 목표에 연결된 적립만 포함한다(목표에 연결되지 않은 별도 저축은 반영하지 않는다). 두 값을 같은 이름으로 표시하지 않는다. 자세한 계산식은 `BUSINESS_RULES.md` 17장을 따른다.

```text
## 기간 내 현황
- 수입: 1,573,180 KRW
- 지출: 1,382,188 KRW
- 기간 잉여금: 190,992 KRW
- 수입 대비 잉여율: 12%
- 저축 목표 적립액: 0 KRW
- 저축 목표 적립률: 0%
```

## 결제수단별 소비 — "미지정"과 "외부 자금 이동" 분리

계좌 정보가 없는 진짜 데이터 누락은 "미지정"으로, 외부 송금/수신처럼 계좌 개념이 없는 자금 이동은 "외부 자금 이동"으로 구분한다. 실제 출금 계좌를 알 수 있는 외부 송금은 그 계좌로 정상 집계한다. 자세한 규칙은 `BUSINESS_RULES.md` 18장을 따른다.

## 외부 자금 이동 — 수입/지출에 이미 포함된 부분집합

"외부 자금 이동" 섹션의 금액은 위 "기간 내 현황"의 수입/지출과 **별개로 더해야 하는 금액이 아니다**. 이미 수입/지출 합계 안에 포함된 부분집합이므로, 외부 AI가 이를 추가 지출/수입으로 다시 더해서는 안 된다. 이 의미가 드러나도록 섹션 제목에 "(위 수입/지출에 이미 포함)"을 명시한다.

```text
## 외부 자금 이동 (위 수입/지출에 이미 포함)
- 외부 송금: 600,000 KRW
- 외부 수입: 13,060 KRW
```

## 소비 성격 — 반복성/일회성 구분

```text
## 소비 성격
- 반복성 지출: 7,890 KRW
- 일회성 지출: 1,317,620 KRW
- 분류되지 않은 지출: 56,678 KRW
```

`RECURRING`/`ONE_TIME`/`UNKNOWN` 판정 기준은 `BUSINESS_RULES.md` 19장을 따른다. `예정 거래(planned transaction)`와 `반복 거래(recurring transaction)`는 다른 개념이므로, 예정 거래에서 확정되었다는 이유만으로 RECURRING으로 분류하지 않는다(항상 ONE_TIME). 근거 없이 UNKNOWN을 ONE_TIME으로 추정하지도 않는다.

## 해석 주의사항

Markdown 마지막에 최소한 다음 의미를 넣는다.

```text
- 내 계좌 간 이체는 수입/지출에 포함하지 않음
- 외부 자금 이동은 기간 내 수입/지출에 이미 포함된 부분집합이며 별도로 더하지 않음
- 카드대금 납부는 추가 소비가 아님
- 할부 구매 소비는 구매일에 전액 인식됨
- 예정 거래는 실제 소비가 아니라 미래 계획임
- 모든 외화 통계는 거래 당시 KRW 환산값 기준
- 기간 잉여금은 저축 목표 적립액이 아님
- 저축 목표 적립액은 Money Context 저축 목표에 연결된 적립 내역만 의미함
- 반복성 지출은 반복 거래 규칙 또는 사용자의 명시적 반복성 지정에 근거함
- 예정 거래라는 이유만으로 반복성 지출이 되지 않음
- 분류되지 않은 지출은 반복 여부를 확인할 근거가 부족한 것이며 일회성이라는 의미가 아님
- 카테고리는 소비 대상, 태그는 소비 맥락을 나타냄
- '미지정'과 '외부 자금 이동'은 서로 다른 의미임
```

# 3. Analysis JSON

권장 top-level:

```json
{
  "metadata": {},
  "period": {},
  "financial_position": {},
  "period_summary": {},
  "external_flows": {},
  "expense_nature": {},
  "budgets": {},
  "credit_cards": [],
  "savings_goals": [],
  "planned_cashflows": [],
  "statistics": {},
  "transactions": []
}
```

## period_summary (schema v1, 필드 추가/명칭 정리)

```json
{
  "income_base_amount": 1573180,
  "expense_base_amount": 1382188,
  "net_cashflow_base_amount": 190992,
  "period_surplus_base_amount": 190992,
  "surplus_rate": 0.12,
  "savings_goal_contribution_base_amount": 0,
  "savings_goal_contribution_rate": 0
}
```

`net_cashflow_base_amount`은 이 필드가 도입되기 이전부터 있던 기존 소비자와의 호환을 위해 유지하며 `period_surplus_base_amount`와 항상 같은 값이다. `savings_goal_contribution_base_amount`/`savings_goal_contribution_rate`는 저축 목표에 연결된 적립액만 의미하며, "사용자의 모든 저축 행위"를 뜻하지 않는다. 이 두 필드는 직전 작업에서 새로 추가되어 아직 외부에 공개된 적 없는 필드이므로 `actual_savings_*`라는 이전 이름을 별칭으로 남기지 않고 바로 이 이름으로 정리했다. `schema_version`은 필드 제거가 없었던 이전 변경과 마찬가지로 올리지 않는다.

## external_flows

```json
{
  "included_in_period_totals": true,
  "outgoing_base_amount": 600000,
  "incoming_base_amount": 13060
}
```

`included_in_period_totals: true`는 `outgoing_base_amount`/`incoming_base_amount`가 `period_summary`의 수입/지출 합계에 이미 포함된 부분집합이며, 별도로 더해서는 안 된다는 의미다.

## expense_nature

```json
{
  "recurring_base_amount": 7890,
  "one_time_base_amount": 1317620,
  "unknown_base_amount": 56678
}
```

## metadata

```json
{
  "schema": "money-context-analysis",
  "schema_version": 1,
  "generated_at": "2026-08-10T15:00:00+09:00",
  "base_currency": "KRW",
  "timezone": "Asia/Seoul",
  "preset": "MONTHLY_SPENDING_ANALYSIS"
}
```

개인 식별이 분석에 필요하지 않다면 이메일/OAuth 정보는 포함하지 않는다.

# 4. CSV

거래 분석용 CSV 컬럼:

```text
transaction_date
transaction_type
status
memo
category
tags
account
from_account
to_account
original_amount
original_currency
base_amount
base_currency
```

CSV에서 카드대금 이체와 일반 지출을 구분할 수 있도록 `transaction_type`과 account type 정보가 필요하다.

# 5. Full Backup JSON

Top-level:

```json
{
  "metadata": {},
  "profile": {},
  "accounts": [],
  "credit_card_settings": [],
  "categories": [],
  "tags": [],
  "transactions": [],
  "transaction_tags": [],
  "recurring_transactions": [],
  "planned_transactions": [],
  "installment_plans": [],
  "installment_payments": [],
  "monthly_budgets": [],
  "category_budgets": [],
  "savings_goals": [],
  "savings_contributions": []
}
```

Backup metadata:

```json
{
  "schema": "money-context-backup",
  "schema_version": 1,
  "exported_at": "2026-08-10T15:00:00+09:00",
  "base_currency": "KRW",
  "timezone": "Asia/Seoul"
}
```

포함 금지:

- OAuth token
- auth provider secret
- service role key
- invite code
- 다른 사용자 데이터

# 6. Restore

Restore 순서 권장:

1. metadata/schema 검증
2. 파일 전체 validation
3. 현재 사용자 확인
4. 새 UUID mapping 생성
5. accounts/categories/tags
6. transactions
7. transaction_tags
8. card/installment
9. budgets/savings/recurring/planned
10. 전체 정합성 검증
11. commit

Restore 중 오류가 발생하면 전체 rollback.

# 7. Privacy 옵션

GPT Export에는 다음 선택 옵션을 제공할 수 있다.

- 거래 memo 포함/제외
- 개별 거래 포함/요약만
- 계좌 실명 대신 유형만

단, 기본 제품 요구사항은 완전한 Export이며 Privacy 옵션은 구현 시 UI 복잡도가 과도하지 않을 때 제공한다.
