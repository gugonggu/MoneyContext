# Money Context Test Cases

이 문서는 재정 계산이 리팩터링 중에도 동일 의미를 유지하도록 Golden Test를 정의한다.

# 1. 계좌 잔액

## TC-BAL-001 기본 계좌

초기:

```text
BANK = 1,000,000
```

거래:

```text
INCOME 2,000,000
EXPENSE 300,000
```

기대:

```text
잔액 = 2,700,000
수입 = 2,000,000
소비 = 300,000
```

# 2. 계좌 이체

## TC-TRF-001 내부 이체

초기:

```text
A = 1,000,000
B = 200,000
```

A → B 300,000.

기대:

```text
A = 700,000
B = 500,000
총자산 = 1,200,000
수입 = 0
소비 = 0
```

# 3. 체크카드

## TC-DEBIT-001 연결 계좌 중복 방지

BANK 1,000,000에 DEBIT 연결.

DEBIT로 100,000 지출.

기대:

```text
BANK = 900,000
DEBIT를 별도 자산으로 합산하지 않음
총자산 = 900,000
소비 = 100,000
```

# 4. 신용카드

## TC-CC-001 카드 지출

초기:

```text
BANK = 1,000,000
CARD 미결제 = 0
```

CARD로 100,000 지출.

기대:

```text
BANK = 1,000,000
CARD 미결제 = 100,000
소비 = 100,000
순자산 = 900,000
```

## TC-CC-002 카드대금 납부

TC-CC-001 이후 BANK → CARD 100,000 결제.

기대:

```text
BANK = 900,000
CARD 미결제 = 0
추가 소비 = 0
총 누적 소비 = 100,000
순자산 = 900,000
```

# 5. 할부

## TC-INS-001 3개월 무이자

8월 20일 900,000원 3개월 할부.

기대:

```text
8월 소비 = 900,000
9월 소비 추가 = 0
10월 소비 추가 = 0
회차 principal = 300,000 x 3
```

각 카드대금 납부 시 추가 EXPENSE가 생기지 않는다.

## TC-INS-002 유이자

원금 900,000, 3회차, 회차 수수료 총 30,000.

기대:

```text
구매 소비 원금 = 900,000
수수료 소비 합계 = 30,000
총 경제적 비용 = 930,000
```

# 6. 잔액조정

## TC-ADJ-001

계산 잔액 1,000,000, 실제 980,000.

ADJUSTMENT -20,000.

기대:

```text
잔액 = 980,000
소비 변화 = 0
수입 변화 = 0
순자산 = -20,000 변화
```

# 7. 예정 거래

## TC-PLAN-001 확정 전

이번 달 실제 지출 300,000, 예정 지출 200,000, 예산 1,000,000.

기대:

```text
실제 예산 사용률 = 30%
예정 포함 예상 사용률 = 50%
실제 소비 = 300,000
```

## TC-PLAN-002 확정

예정 거래를 실제 EXPENSE로 확정.

기대:

```text
실제 소비 = 500,000
실제 예산 사용률 = 50%
planned row는 CONFIRMED 및 transaction 연결
```

# 8. 반복 거래

## TC-REC-001 AUTO_CONFIRM

매월 15일 14,900원.

15일 실행 후 기대:

```text
CONFIRMED EXPENSE 1건
동일 occurrence 재실행해도 중복 생성 0건
```

## TC-REC-002 REQUIRE_CONFIRMATION

급여 2,156,880원.

실행 후 기대:

```text
PENDING INCOME 생성
수입 통계 미반영
사용자 confirm 후 수입 반영
```

# 9. 예산 이월

## TC-BUD-001 양수

전월 기본 예산 100,000, 실제 70,000, rollover ON.

다음 달 기본 100,000.

기대:

```text
rollover = +30,000
다음 달 사용 가능 = 130,000
```

## TC-BUD-002 음수

전월 기본 100,000, 실제 120,000.

기대:

```text
rollover = -20,000
다음 달 사용 가능 = 80,000
```

# 10. 급여 사이클

## TC-SAL-001

급여일 10일, 기준일 2026-08-10.

기대:

```text
cycle start = 2026-08-10
cycle end = 2026-09-09
```

## TC-SAL-002 말일 보정

급여일 31일, 다음 달이 30일까지 있는 경우 해당 월의 마지막 날을 cycle boundary로 사용한다.

# 11. 자유 사용 가능 금액

## TC-SPEND-001

```text
유동자산 1,500,000
카드 미결제 300,000
다음 급여일까지 필수 예정 지출 200,000
저축 계획 500,000
보호금액 100,000
```

기대:

```text
자유 사용 가능 = 400,000
```

## TC-SPEND-002 중복 차감 방지

카드 미결제 300,000 전체를 이미 차감했고, 예정 목록에 동일 카드 결제 300,000이 존재.

기대:

```text
카드 관련 차감 총액 = 300,000
600,000 차감 금지
```

# 12. 저축 목표

## TC-SAV-001

목표 1,500,000, 현재 500,000, 남은 적립 횟수 5회.

기대:

```text
남은 필요 = 1,000,000
필요 월 적립 = 200,000
```

# 13. 외화

## TC-FX-001

JPY 3,000, base_amount 28,400으로 저장.

나중에 환율이 변해도 기대:

```text
과거 소비 통계 = 28,400 KRW
```

# 14. RLS

## TC-RLS-001 거래 조회

User A 인증으로 User B transaction UUID 직접 조회.

기대: 0 row 또는 authorization failure.

## TC-RLS-002 Cross-user account 연결

User A가 transaction.account_id에 User B account UUID 전달.

기대: insert/update 실패.

## TC-RLS-003 Export

User A가 request payload에 User B user_id를 전달.

기대: User A 데이터만 반환하거나 요청 거부.

# 15. Backup / Restore

## TC-BACKUP-001 Round Trip

사용자 데이터 세트를 backup → 빈 사용자 공간에 restore 가능한 테스트 fixture로 round trip.

기대:

- 거래 개수 동일
- 금액 합계 동일
- category/tag 관계 동일
- installment 관계 동일
- user_id는 현재 사용자로 재매핑

## TC-BACKUP-002 Invalid Schema

지원하지 않는 `schema_version`.

기대: restore 시작 전 실패, DB 변화 없음.

# 16. E2E

## E2E-001 첫 사용자

```text
invite code
→ Google auth mock 또는 test provider
→ onboarding
→ BANK 생성
→ EXPENSE 생성
→ dashboard 반영
```

## E2E-002 카드 라이프사이클

```text
카드 생성
→ 카드 구매
→ 미결제 증가
→ 결제 예정 확인
→ 카드대금 결제
→ 미결제 감소
→ 소비 중복 없음
```

## E2E-003 Export

```text
거래/예산/저축 데이터 생성
→ 기간 선택
→ GPT Markdown 생성
→ 핵심 합계 검증
→ JSON/CSV 다운로드 검증
```
