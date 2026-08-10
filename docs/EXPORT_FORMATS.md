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
기간 요약
예산
카테고리별 소비
태그별 소비
결제수단별 소비
고정비/변동비
예정 현금흐름
카드 현황
저축 목표
거래 내역
데이터 해석 주의사항
```

분석 목적에 따라 불필요한 섹션은 생략한다.

## 해석 주의사항

Markdown 마지막에 최소한 다음 의미를 넣는다.

```text
- 이체는 수입/지출에 포함되지 않음
- 카드대금 납부는 추가 소비가 아님
- 할부 구매 소비는 구매일에 전액 인식됨
- 예정 거래는 실제 소비가 아니라 미래 계획임
- 모든 외화 통계는 거래 당시 KRW 환산값 기준
```

# 3. Analysis JSON

권장 top-level:

```json
{
  "metadata": {},
  "period": {},
  "financial_position": {},
  "period_summary": {},
  "budgets": {},
  "credit_cards": [],
  "savings_goals": [],
  "planned_cashflows": [],
  "statistics": {},
  "transactions": []
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
