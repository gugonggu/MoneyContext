# Money Context 개발 명세서

## 0. 문서 목적

**Money Context**는 개인의 수입·지출·자산·부채·예산·저축 계획을 관리하고, 축적된 재정 데이터를 ChatGPT 등 외부 AI가 분석하기 좋은 형태로 내보내는 개인 재정 관리 웹 애플리케이션이다.

이 프로젝트는 기능을 MVP/2차/3차처럼 별도 제품 단계로 나누지 않는다.

처음부터 최종 기능 범위를 기준으로 데이터 구조와 아키텍처를 설계하되, 실제 개발 작업만 작은 단위로 분리하여 순차적으로 구현한다.

각 구현 단계는 다음 원칙을 따른다.

1. 하나의 단계는 명확한 책임만 가진다.
2. 이전 단계가 정상 동작하고 테스트된 이후 다음 단계로 진행한다.
3. 임시 구현으로 다음 단계에 기술 부채를 넘기지 않는다.
4. 화면보다 재정 데이터 모델과 계산 정확성을 우선한다.
5. 소비, 현금흐름, 자산 상태, 미래 계획을 서로 혼동하지 않는다.

---

# 1. 프로젝트 기본 정보

## 프로젝트명

**Money Context**

## 한 줄 설명

개인 재정 기록, 자산·예산·저축 계획 관리와 GPT 분석용 데이터 Export를 제공하는 반응형 웹 가계부.

## 핵심 컨셉

Money Context는 단순히 돈을 기록하는 가계부가 아니다.

사용자가 자신의 재정 상태를 구조적으로 기록하고,

- 지금 얼마를 가지고 있는지
- 이번 달 얼마를 썼는지
- 앞으로 얼마를 써도 되는지
- 다음 급여일까지 얼마가 남는지
- 카드대금이 얼마나 예정되어 있는지
- 저축 목표를 현재 속도로 달성할 수 있는지

를 확인할 수 있어야 한다.

또한 필요할 때 전체 재정 데이터를 외부 AI에 전달하여 분석받을 수 있어야 한다.

---

# 2. 핵심 제품 원칙

## 2.1 기록은 빠르게

일반적인 지출 입력은 모바일 기준 최대한 적은 조작으로 끝나야 한다.

대표 흐름:

```text
+ 버튼
→ 금액 입력
→ 카테고리 선택
→ 결제수단 선택
→ 저장
```

메모, 태그, 외화, 할부 등의 옵션은 기본 화면에서 숨기고 필요할 때만 펼친다.

## 2.2 분석은 풍부하게

입력 UX는 단순하지만 기록된 데이터를 활용하는 기능은 충분히 제공한다.

- 월별 소비
- 자산/부채
- 예산
- 카드대금
- 저축
- 미래 현금흐름
- 통계
- GPT Export

## 2.3 네 가지 재정 개념을 분리

### 소비
사용자가 실제로 무엇에 얼마를 소비했는가.

### 현금흐름
실제로 언제 돈이 들어오거나 빠져나가는가.

### 재정 상태
현재 자산, 부채, 카드 미결제액 등을 반영했을 때 순자산이 얼마인가.

### 미래 계획
예산, 예정 거래, 반복 거래, 저축 계획 등을 반영했을 때 앞으로 돈이 어떻게 움직일 것인가.

---

# 3. 기술 스택

## Frontend / Backend
- Next.js App Router
- React
- TypeScript
- Server Components 적극 활용
- 필요한 인터랙션만 Client Component 사용

## Database / Authentication
- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security

## Login Provider
- Google

Kakao와 네이버 로그인은 초기 범위에서 제외한다.

추후 OAuth Provider 추가가 가능하도록 인증 코드는 특정 Provider에 강하게 결합하지 않는다.

## Deployment
- Vercel
- Supabase Cloud

## 기준 시간대
`Asia/Seoul`

## 기본 통화
`KRW`

---

# 4. 명시적으로 구현하지 않는 기능

현재 범위에는 다음 기능을 포함하지 않는다.

- 은행 계좌 자동 연동
- 카드사 자동 연동
- 금융 마이데이터 연동
- 카드/은행 CSV 자동 가져오기
- OpenAI API 직접 연동
- 앱 내부 AI Chat
- 영수증 이미지 첨부
- OCR
- 공동 가계부
- 이메일 알림
- 브라우저 Push 알림
- 실시간 환율 기반 자산 평가
- Naver 로그인

Money Context의 AI 기능은 **Export 기능까지만** 담당한다.

---

# 5. 사용자 및 인증

## 5.1 가입 구조

Money Context는 완전 공개 가입 서비스가 아니다.

공용 초대코드를 알고 있는 사용자만 가입할 수 있다.

```text
초대코드 입력
→ Google 로그인
→ 최초 프로필 생성
→ 초기 설정
→ Money Context 시작
```

## 5.2 사용자 역할

- `USER`
- `ADMIN`

최초 서비스 소유자 계정은 ADMIN으로 지정한다.

ADMIN은 공용 초대코드를 변경하거나 가입 기능을 비활성화할 수 있다.

일반 사용자는 다른 사용자의 존재나 데이터를 확인할 수 없다.

## 5.3 사용자 데이터 격리

모든 개인 재정 데이터는 `user_id`를 가진다.

Supabase RLS를 사용해 `auth.uid() = row.user_id` 인 데이터만 조회, 생성, 수정, 삭제할 수 있도록 한다.

---

# 6. 초기 설정

최초 로그인 후 온보딩에서 다음 정보를 입력한다.

## 기본 설정
- 표시 이름
- 기본 통화
- 급여일
- 월간 예산 사용 여부

## 금융 상태

사용자가 현재 상태를 입력할 수 있도록 한다.

예:

```text
부산은행     1,200,000원
토스          300,000원
현금           30,000원

신용카드 미결제 180,000원

대출          500,000원
```

과거 거래를 전부 입력하지 않아도 현재 상태부터 Money Context를 시작할 수 있어야 한다.

---

# 7. 핵심 데이터 모델

## 7.1 profiles

주요 필드:

```text
id
display_name
role
base_currency
salary_cycle_day
timezone
created_at
updated_at
```

`id`는 Supabase Auth User ID와 동일하게 사용한다.

---

# 8. 금융 계정

## 8.1 accounts

유형:

```text
BANK
CASH
DEBIT
CREDIT_CARD
LIABILITY
```

주요 필드:

```text
id
user_id
name
type
initial_balance
current_balance_cache (optional)
linked_account_id
is_active
sort_order
created_at
updated_at
```

잔액의 source of truth는 거래 기록이며, 캐시 필드는 필요한 경우에만 사용한다.

### BANK
은행 계좌.

### CASH
현금.

### DEBIT
체크카드 등의 결제수단.

실제 자산은 `linked_account_id`에 연결된 BANK 계좌에 존재한다.

따라서 DEBIT는 순자산 계산에서 별도 자산으로 중복 합산하지 않는다.

### CREDIT_CARD
신용카드.

자산이 아니라 미결제 소비 및 향후 결제 현금흐름을 관리한다.

### LIABILITY
대출, 빌린 돈 등 부채.

---

# 9. 신용카드 설정

## credit_card_settings

```text
id
user_id
account_id
payment_day
payment_account_id
credit_limit
billing_cycle_rule
created_at
updated_at
```

카드별로 다음 정보를 관리한다.

- 카드 한도
- 카드 결제일
- 이용기간
- 결제계좌

금융사별 이용기간을 애플리케이션에 하드코딩하지 않는다.

사용자가 카드 설정에서 자신의 이용기간 규칙을 지정할 수 있도록 설계한다.

---

# 10. 거래

## transactions

거래 종류:

```text
INCOME
EXPENSE
TRANSFER
ADJUSTMENT
```

상태:

```text
PENDING
CONFIRMED
CANCELLED
```

주요 필드:

```text
id
user_id
type
status
transaction_date
amount
currency
base_amount
base_currency
exchange_rate
category_id
account_id
from_account_id
to_account_id
memo
recurring_rule_id
planned_transaction_id
created_at
updated_at
```

필드는 거래 유형에 따라 사용 여부가 달라진다.

---

# 11. 수입

예:

```text
월급
2,156,880원
부산은행
```

수입은:
- 해당 계좌 잔액 증가
- 월 수입 통계 포함
- 현금흐름 포함

---

# 12. 지출

예:

```text
점심
12,000원
식비
동백전
```

지출은:
- 소비 통계 포함
- 예산 사용량 포함
- 자산 또는 카드 미결제액에 반영

---

# 13. 이체

자기 계좌끼리 돈을 옮기는 행위는 수입이나 지출이 아니다.

예:

```text
부산은행 → 토스
200,000원
```

이체는:
- 출금 계좌 잔액 감소
- 입금 계좌 잔액 증가
- 소비 통계 제외
- 수입 통계 제외
- 예산 제외

---

# 14. 잔액 조정

실제 계좌 잔액과 Money Context의 계산 잔액이 다를 경우 사용할 수 있다.

```text
type = ADJUSTMENT
```

잔액 조정은:
- 계좌 잔액 반영
- 순자산 반영
- 수입 통계 제외
- 소비 통계 제외
- 예산 제외

사용자가 가능한 경우 과거 거래를 수정할 수도 있어야 한다.

---

# 15. 카테고리

기본 카테고리 예시:

```text
급여
식비
교통
주거
생활
쇼핑
취미
구독
차량
여행
건강
교육
경조사
저축
기타
```

사용자는:
- 새 카테고리 추가
- 이름 수정
- 숨김

을 할 수 있다.

이미 거래에 사용된 카테고리는 물리 삭제보다 비활성화를 기본으로 한다.

---

# 16. 태그

카테고리와 별개로 자유로운 분석 기준을 제공한다.

예:

```text
데이트
회사
여행
홋카이도
친구모임
```

거래 하나에 여러 태그를 지정할 수 있다.

## transaction_tags

```text
transaction_id
tag_id
```

다대다 관계로 구성한다.

---

# 17. 반복 거래

## recurring_transactions

주요 필드:

```text
id
user_id
type
amount
currency
account_id
category_id
frequency
interval
day_of_month
start_date
end_date
next_run_date
confirmation_mode
is_active
created_at
updated_at
```

확정 방식:

```text
AUTO_CONFIRM
REQUIRE_CONFIRMATION
```

REQUIRE_CONFIRMATION은 PENDING 거래로 생성한다.

사용자가 금액을 수정하고 확인하면 CONFIRMED 처리한다.

과거 생성 거래는 반복 규칙이 수정되더라도 변경하지 않는다.

---

# 18. 예정 거래

## planned_transactions

반복되지 않는 미래 수입 또는 지출을 관리한다.

상태:

```text
PLANNED
CONFIRMED
CANCELLED
```

예정 거래는:
- 실제 소비 통계 제외
- 실제 예산 사용률 제외
- 미래 현금흐름 포함
- 사용 가능 금액 계산 포함
- 저축 목표 예측 포함

실제 발생 시 transaction으로 변환한다.

---

# 19. 신용카드

신용카드 소비와 카드대금 납부를 반드시 분리한다.

카드대금 납부는 새로운 소비가 아니다.

카드대금 납부는 다음 성격으로 처리한다.

```text
BANK → CREDIT_CARD
TRANSFER
```

---

# 20. 할부

## installment_plans

```text
id
user_id
transaction_id
total_amount
installment_count
interest_type
start_month
created_at
```

## installment_payments

```text
id
user_id
installment_plan_id
sequence
scheduled_date
principal_amount
fee_amount
status
```

할부 구매의 소비 통계는 구매월에 전액 반영한다.

현금흐름은 각 회차에 나눠 반영한다.

할부금 자체를 추가 소비로 계산하지 않는다.

수수료가 있는 경우 수수료만 별도 비용으로 처리할 수 있도록 한다.

---

# 21. 월 예산

## monthly_budgets

```text
id
user_id
year
month
total_budget
created_at
updated_at
```

전체 월 지출 목표를 관리한다.

---

# 22. 카테고리 예산

## category_budgets

```text
id
user_id
year
month
category_id
base_budget
rollover_enabled
rollover_amount
created_at
updated_at
```

각 카테고리는 월 초기화 또는 이월을 선택할 수 있다.

이월 설정 시 남은 예산뿐 아니라 초과 금액도 다음 달에 반영한다.

---

# 23. 저축 목표

## savings_goals

```text
id
user_id
name
target_amount
target_date
monthly_contribution_plan
is_active
created_at
updated_at
```

## savings_contributions

```text
id
user_id
goal_id
amount
contribution_date
transaction_id
transfer_id
created_at
```

목표의 현재 적립액은 contribution 합계로 계산한다.

가능한 경우 실제 계좌 이체와 연결할 수 있도록 한다.

---

# 24. 외화

모든 주요 거래는 외화를 지원한다.

저장 예:

```text
amount = 3000
currency = JPY
base_amount = 28400
base_currency = KRW
exchange_rate = 거래 당시 적용값
```

과거 거래 통계는 현재 환율로 다시 계산하지 않는다.

항상 거래 당시 저장된 KRW 환산액을 사용한다.

실시간 환율 기반 외화 자산 평가 기능은 구현하지 않는다.

---

# 25. 급여 사이클

사용자는 급여일을 지정한다.

예:

```text
급여일 = 10일
```

생활비 사이클:

```text
2026-08-10 ~ 2026-09-09
```

Money Context는 두 가지 기간 기준을 동시에 지원한다.

### 달력 월
- 월간 통계
- 월 예산
- 월별 비교

### 급여 사이클
- 생활비 현황
- 다음 급여일까지 사용 가능한 금액
- 미래 현금흐름

---

# 26. 자동 계산 규칙

## 계좌 잔액

```text
초기 잔액
+ 수입
- 지출
+ 들어온 이체
- 나간 이체
+ 잔액 조정
```

## 카드 미결제액

```text
아직 결제되지 않은 카드 사용액
+ 남은 할부 결제액
+ 카드 관련 수수료
```

## 순자산

```text
자산
- 일반 부채
- 신용카드 미결제액
```

DEBIT 결제수단은 연결된 BANK 계좌와 중복 계산하지 않는다.

---

# 27. 사용 가능 금액

Money Context의 핵심 지표 중 하나.

개념적으로:

```text
현재 유동자산
- 카드 미결제액
- 다음 급여일까지 예정된 필수 지출
- 반복 고정비
- 저축 계획
- 사용자가 보호하도록 설정한 금액
= 자유 사용 가능 금액
```

대시보드에서는 다음처럼 보여준다.

```text
다음 급여일까지 자유 사용 가능
426,000원
```

## 하루 사용 가능 금액

```text
자유 사용 가능 금액
÷ 다음 급여일까지 남은 일수
```

이 값을 강제적인 소비 권장액처럼 표현하지 않는다.

---

# 28. 저축 목표 예측

```text
남은 필요 금액 = 목표 금액 - 현재 적립액
```

```text
필요 월 적립액 = 남은 필요 금액 ÷ 남은 적립 횟수
```

현재 계획과 비교하여 달성 가능 여부, 월 추가 필요액, 예상 달성일을 제공한다.

---

# 29. 알림

외부 알림은 사용하지 않는다.

앱 내부 알림센터만 제공한다.

알림 예:
- 확인이 필요한 반복 거래
- 오늘 예정된 거래
- 카드 결제일 임박
- 예산 80%, 90%, 100% 도달
- 저축 목표 일정 위험

---

# 30. 대시보드

상단 핵심 정보:
- 이번 달 수입
- 이번 달 지출
- 남은 예산
- 저축률
- 다음 급여일까지 사용 가능 금액
- 하루 평균 사용 가능 금액

추가:
- 총 자산
- 총 부채
- 순자산
- 카드 미결제액
- 다음 카드 결제 예정액
- 예산 위험 항목
- 예정 거래
- 저축 목표

---

# 31. 거래 입력 UX

모바일 최우선 UX.

기본 흐름:

```text
지출 | 수입 | 이체
→ 금액
→ 최근 결제수단
→ 카테고리
→ 저장
```

과거 사용 이력을 이용해 자주 쓰는 카테고리, 결제수단, 조합을 추천한다.

AI는 사용하지 않는다.

상세 옵션:
- 날짜
- 시간
- 메모
- 태그
- 외화
- 할부

---

# 32. 거래 내역

모바일:
- 날짜별 그룹 목록

PC:
- 테이블 중심

지원 필터:
- 기간
- 거래 유형
- 계좌
- 카드
- 카테고리
- 태그
- 상태
- 금액 범위
- 메모 검색

---

# 33. 자산 화면

상단:
- 총 자산
- 총 부채
- 순자산

하위:
- 현금성 자산
- 결제수단
- 신용카드
- 부채

카드별 표시:
- 이번 달 소비
- 총 미결제액
- 다음 결제 예정액
- 한도
- 남은 한도
- 결제일

각 계좌에서 `잔액 맞추기` 기능을 제공한다.

---

# 34. 계획 화면

세 영역으로 구성한다.

## 예산
- 전체 월 예산
- 카테고리별 예산
- 이월 여부
- 현재 사용률
- 예정 거래 포함 예상 사용률

## 저축 목표
- 목표
- 목표일
- 월 적립 계획
- 진행률
- 예상 달성 여부

## 미래 현금흐름
- 현재 유동자산
- 카드대금
- 고정비
- 저축 계획
- 예정 지출
- 자유 사용 가능 금액

---

# 35. 통계

지원 통계:
- 월별 수입
- 월별 지출
- 순수 소비 추세
- 3개월 추세
- 6개월 추세
- 카테고리별
- 태그별
- 결제수단별
- 고정비 / 변동비
- 요일별
- 주차별
- 전월 대비
- 저축률 변화
- 순자산 변화

PC에서는 상세 시각화를 제공하고 모바일에서는 핵심 차트 위주로 보여준다.

---

# 36. GPT Export

OpenAI API는 사용하지 않는다.

사용자가 데이터를 직접 복사하거나 다운로드해 원하는 AI에 전달한다.

## 분석 목적 프리셋
- 전체 재정 진단
- 이번 달 소비 분석
- 예산 점검
- 저축 목표 분석
- 최근 소비 패턴
- 특정 카테고리 분석
- 특정 태그 분석

## 기간 프리셋
- 이번 달
- 지난달
- 최근 3개월
- 최근 6개월
- 올해
- 직접 지정

---

# 37. Markdown Export

사람과 LLM 모두 읽기 쉬운 구조로 생성한다.

예:

```markdown
# Money Context 재정 데이터

기준일: 2026-08-10
분석 기간: 2026-08-01 ~ 2026-08-31

## 재정 상태
- 총 자산:
- 총 부채:
- 카드 미결제:
- 순자산:

## 기간 내 현황
- 수입:
- 지출:
- 저축:
- 저축률:

## 예산
...

## 카테고리별 소비
...

## 예정된 현금흐름
...

## 저축 목표
...

## 거래 내역
...
```

사용자는 `GPT용 Markdown 복사` 버튼으로 클립보드에 복사할 수 있다.

---

# 38. JSON Export

큰 구조:

```text
metadata
profile_summary
period
assets
liabilities
credit_cards
income
expenses
transfers
budgets
savings_goals
planned_transactions
recurring_transactions
statistics
transactions
```

GPT 분석 Export는 선택한 기간과 분석 목적에 필요한 데이터만 포함한다.

---

# 39. CSV Export

거래 목록을 CSV로 다운로드할 수 있다.

주요 컬럼:

```text
date
type
amount
currency
base_amount
category
account
tags
memo
status
```

---

# 40. 전체 백업

사용자는 자신의 모든 Money Context 데이터를 JSON으로 백업할 수 있다.

GPT Export와 백업 파일은 별도 기능이다.

백업에는 복구에 필요한 모든 데이터를 포함한다.

---

# 41. 복구

JSON 백업 파일을 다시 Import하여 데이터를 복구할 수 있다.

복구 전:
- 백업 파일 버전 확인
- 구조 검증
- 사용자 확인

백업 파일에는 반드시 다음 필드를 포함한다.

```text
schema_version
exported_at
```

---

# 42. 계정 삭제

사용자가 계정 삭제를 요청하면 먼저 전체 데이터 백업 버튼을 제공한다.

사용자가 계속 삭제하면:
- 모든 개인 재정 데이터 삭제
- 프로필 삭제
- 인증 계정 삭제

삭제는 되돌릴 수 없음을 명확하게 표시한다.

---

# 43. 반응형 UX

Money Context는 모바일과 PC를 동등하게 지원한다.

## 모바일

빠른 기록 중심.

하단 Navigation:

```text
홈
내역
+ 입력
계획
더보기
```

## PC

분석 및 관리 중심.

좌측 Sidebar:

```text
홈
거래내역
자산
계획
통계
AI Export
설정
```

동일 화면을 단순 확대/축소하지 말고 화면 크기에 맞는 정보 구조를 적용한다.

---

# 44. 설정

설정에서 관리:
- 프로필
- 급여일
- 기본 통화
- 계좌
- 카드
- 부채
- 반복 거래
- 카테고리
- 태그
- 알림
- 백업
- 복구
- 계정 삭제

ADMIN만:
- 공용 초대코드
- 신규 가입 활성화 여부

를 관리한다.

---

# 45. 보안 원칙

필수:
- 모든 사용자 테이블 RLS 활성화
- 모든 Query에서 사용자 세션 검증
- Service Role Key 브라우저 노출 금지
- 환경변수 클라이언트 노출 최소화
- 다른 사용자의 ID를 전달해도 조회 불가능해야 함
- Export는 현재 로그인 사용자의 데이터만 포함
- Backup 또한 현재 사용자 데이터만 포함

RLS를 DB 레벨의 핵심 보안 경계로 사용한다.

---

# 46. 테스트 전략

## Unit Test

우선 테스트 대상:
- 계좌 잔액
- 순자산
- 카드 미결제액
- 카드대금
- 할부
- 예산
- 예산 이월
- 급여 사이클
- 사용 가능 금액
- 하루 사용 가능 금액
- 저축 목표 예측
- 외화 환산
- 통계 집계

재정 계산 함수는 UI에서 분리된 순수 함수 형태를 선호한다.

## Integration Test
- 거래 등록 → 계좌 반영
- 신용카드 소비 → 미결제 증가
- 카드대금 납부 → 미결제 감소
- 이체 → 양쪽 계좌 반영
- 반복 거래 생성
- 예정 거래 확정
- 할부 생성
- 백업 및 복구
- Export 생성

## RLS 테스트

User A 로그인 상태에서 User B의:
- 거래 조회
- 계좌 조회
- 거래 수정
- 거래 삭제

가 모두 불가능해야 한다.

## E2E 핵심 흐름

### 신규 사용자

```text
초대코드
→ 소셜 로그인
→ 초기 설정
→ 계좌 생성
→ 첫 지출 입력
→ 홈 반영
```

### 일반 사용

```text
지출 입력
→ 예산 감소
→ 통계 반영
→ GPT Export 반영
```

### 신용카드

```text
카드 지출
→ 소비 발생
→ 카드 미결제 증가
→ 결제일
→ 계좌에서 카드로 이체
→ 카드 미결제 감소
→ 소비 중복 없음
```

---

# 47. 구현 단계

전체 기능은 하나의 완성형 프로젝트 범위로 본다.

아래 단계는 출시 버전 구분이 아니라 개발 작업 순서이다.

## Phase 01 — 프로젝트 기반 구성
- Next.js + TypeScript
- 기본 폴더 구조
- Supabase Client
- Server Supabase Client
- 환경변수
- ESLint
- 테스트 환경
- 기본 Layout
- Error Boundary
- Loading UI

## Phase 02 — DB 스키마 및 Migration
- profiles
- accounts
- credit_card_settings
- categories
- tags
- transactions
- transaction_tags
- recurring_transactions
- planned_transactions
- installment_plans
- installment_payments
- monthly_budgets
- category_budgets
- savings_goals
- savings_contributions
- notifications
- Enum / Index / FK / Constraint

## Phase 03 — RLS
모든 사용자 테이블 RLS 적용 및 CRUD 검증.

## Phase 04 — 인증 및 초대
- 공용 초대코드
- Google 로그인
- 신규 사용자 Profile
- ADMIN / USER
- 로그아웃
- 보호 Route

## Phase 05 — 온보딩
- 표시 이름
- 급여일
- 기본 통화
- 초기 자산
- 초기 부채
- 카드 설정

## Phase 06 — 계좌 / 카드 / 부채 관리
- BANK
- CASH
- DEBIT
- CREDIT_CARD
- LIABILITY

## Phase 07 — 기본 거래 엔진
- INCOME
- EXPENSE
- TRANSFER
- ADJUSTMENT

## Phase 08 — 빠른 거래 입력 UX
- 모바일 입력
- 금액 우선
- 유형
- 카테고리
- 결제수단
- 빠른 저장
- 상세 옵션

## Phase 09 — 최근 패턴 추천
- 자주 쓰는 카테고리
- 자주 쓰는 결제수단
- 자주 쓰는 조합

## Phase 10 — 거래 내역
- 모바일 목록
- PC Table
- 날짜 그룹
- 검색
- 필터
- 수정
- 삭제

## Phase 11 — 카테고리 / 태그
- 기본 카테고리 Seed
- 사용자 카테고리
- 숨김
- 태그
- 거래 다중 태그

## Phase 12 — 외화
- 거래 통화
- 원화 환산 금액
- 환율 직접 입력
- 과거 환산값 고정

## Phase 13 — 신용카드 엔진
- 카드 사용액
- 미결제액
- 결제 예정액
- 결제일
- 카드대금 이체
- 남은 한도

## Phase 14 — 할부
- 할부 등록
- 결제 스케줄
- 현금흐름
- 카드대금
- 소비 구매일 반영

## Phase 15 — 반복 거래
- 반복 규칙 CRUD
- AUTO_CONFIRM
- REQUIRE_CONFIRMATION
- 다음 실행일
- 거래 생성
- 확인 필요 목록

## Phase 16 — 예정 거래
- 미래 거래
- 수정
- 취소
- 확정
- 미래 현금흐름

## Phase 17 — 예산
- 월 전체 예산
- 카테고리 예산
- 사용률
- 예정 거래 포함 예상률

## Phase 18 — 예산 이월
- 카테고리별 이월
- 양수 이월
- 음수 이월
- 월 변경 처리

## Phase 19 — 저축 목표
- 복수 목표
- 목표 금액
- 목표일
- 월 적립액
- 적립 기록
- 진행률
- 달성 예측

## Phase 20 — 급여 사이클
- 달력 월
- 현재 급여 사이클
- 다음 급여일까지 남은 날짜

## Phase 21 — 재정 예측 엔진
- 현재 유동자산
- 카드 미결제
- 미래 예정 거래
- 반복 고정비
- 저축 계획
- 자유 사용 가능 금액
- 하루 사용 가능 금액

## Phase 22 — 대시보드
- 이번 달 수입
- 지출
- 예산
- 저축률
- 자유 사용 가능액
- 하루 사용 가능액
- 자산/부채
- 카드
- 예정 거래
- 저축 목표

## Phase 23 — 자산 화면
- 자산
- 부채
- 순자산
- 계좌별 현황
- 카드별 현황
- 잔액 맞추기

## Phase 24 — 계획 화면
- 예산
- 저축
- 예정 거래
- 미래 현금흐름

## Phase 25 — 통계
- 월별
- 카테고리
- 태그
- 결제수단
- 고정비/변동비
- 요일
- 주차
- 전월 대비
- 3/6개월
- 저축률
- 순자산 변화

## Phase 26 — 앱 내부 알림
- 카드 결제
- 예정 거래
- 반복 거래 확인
- 예산 임박/초과
- 목표 관련 알림
- 읽음 처리

## Phase 27 — GPT Markdown Export
- 분석 목적
- 기간
- 데이터 선택
- Markdown 생성
- 미리보기
- Clipboard 복사

## Phase 28 — JSON / CSV Export
- GPT용 JSON
- 거래 CSV
- 기간/필터 적용

## Phase 29 — 전체 Backup / Restore
- schema_version
- 전체 JSON Export
- 파일 검증
- Import
- 관계 복원
- 오류 처리

## Phase 30 — 계정 삭제
- 백업 권장
- 삭제 확인
- 전체 사용자 데이터 삭제
- Auth 계정 삭제

## Phase 31 — 반응형 UI 정리
모바일:
- Bottom Navigation
- 중앙 빠른 입력 버튼
- 터치 UX

PC:
- Sidebar
- Dashboard Grid
- Table
- 상세 통계

## Phase 32 — 전체 통합 테스트
- 거래 합계
- 카드 중복 집계
- 할부
- 예산
- 이월
- 급여 사이클
- 순자산
- 저축
- Export
- RLS
- 백업/복구

## Phase 33 — Vercel Production 배포
- Production 환경변수
- OAuth Redirect URL
- Supabase Production 설정
- Migration
- RLS
- Error Logging
- 기본 Seed

---

# 48. Codex 작업 규칙

1. 이 문서를 프로젝트의 최상위 요구사항으로 취급한다.
2. 임의로 기능을 삭제하거나 범위를 축소하지 않는다.
3. 명세에 없는 대규모 기능을 임의 추가하지 않는다.
4. 각 Phase를 순서대로 구현한다.
5. 한 Phase를 지나치게 큰 작업으로 처리하지 말고 내부 Task로 다시 분해한다.
6. 각 Phase 완료 후 테스트를 실행한다.
7. 재정 계산 로직은 UI 컴포넌트에 직접 작성하지 않는다.
8. 공통 계산 로직은 독립적인 Domain/Service 함수로 구현한다.
9. Server/Client 경계를 명확히 한다.
10. Supabase Service Role Key는 서버에서만 사용한다.
11. 모든 개인 데이터에 RLS를 적용한다.
12. `user_id` 기반 데이터 격리를 절대 생략하지 않는다.
13. 금액은 부동소수점 오류가 발생하지 않는 데이터 타입을 사용한다.
14. 날짜와 시간대는 `Asia/Seoul` 기준 동작을 명확하게 처리한다.
15. 카드 소비와 카드대금 납부를 중복 지출로 집계하지 않는다.
16. 이체를 수입 또는 소비에 포함하지 않는다.
17. 잔액조정을 수입/소비 통계에 포함하지 않는다.
18. 예정 거래를 확정 전 실제 소비 통계에 포함하지 않는다.
19. 할부 소비는 구매 시점에 한 번만 인식한다.
20. 구현 변경이 기존 계산 결과에 영향을 준다면 관련 테스트를 먼저 추가하거나 수정한다.

---

# 49. Definition of Done

사용자는:
- 초대코드로 가입할 수 있다.
- Google로 로그인할 수 있다.
- 자신의 데이터만 볼 수 있다.
- 자산과 부채를 등록할 수 있다.
- 수입을 입력할 수 있다.
- 지출을 입력할 수 있다.
- 이체할 수 있다.
- 잔액을 조정할 수 있다.
- 신용카드를 관리할 수 있다.
- 할부를 관리할 수 있다.
- 반복 거래를 설정할 수 있다.
- 미래 예정 거래를 등록할 수 있다.
- 월 예산을 설정할 수 있다.
- 카테고리 예산을 설정할 수 있다.
- 예산 이월을 설정할 수 있다.
- 여러 저축 목표를 관리할 수 있다.
- 외화 지출을 기록할 수 있다.
- 달력 월과 급여 사이클을 모두 볼 수 있다.
- 현재 순자산을 확인할 수 있다.
- 다음 급여일까지 사용 가능한 금액을 확인할 수 있다.
- 상세 소비 통계를 볼 수 있다.
- GPT 분석용 Markdown을 생성할 수 있다.
- JSON과 CSV 데이터를 Export할 수 있다.
- 전체 데이터를 백업 및 복구할 수 있다.
- 자신의 계정과 모든 데이터를 삭제할 수 있다.
- PC와 모바일에서 정상적으로 사용할 수 있다.

그리고 모든 핵심 재정 계산에는 자동화 테스트가 존재해야 한다.

---

# 50. 최종 제품 정의

```text
돈을 사용한다
↓
10초 안에 Money Context에 기록한다
↓
앱이 자동으로 예산·자산·카드·현금흐름을 계산한다
↓
사용자는 지금의 재정 상태와 앞으로 쓸 수 있는 돈을 확인한다
↓
필요하면 Money Context 데이터를 GPT용 Context로 Export한다
↓
외부 AI에게 자신의 실제 재정 데이터를 기반으로 분석을 요청한다
```

Money Context의 최우선 목표는 기능 수 자체가 아니다.

**사용자가 꾸준히 기록할 만큼 입력이 간단하면서도, 기록한 데이터가 충분히 가치 있는 재정 정보로 변환되는 것**이 최우선이다.
