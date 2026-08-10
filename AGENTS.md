# Money Context — Agent Working Rules

이 문서는 Money Context 저장소에서 작업하는 Codex 및 기타 코딩 에이전트의 상시 작업 규칙이다.

## 1. 최상위 기준

- `MONEY_CONTEXT_SPEC.md`를 제품 범위의 최상위 요구사항으로 취급한다.
- 재정 의미나 계산이 필요한 경우 `BUSINESS_RULES.md`를 반드시 함께 확인한다.
- DB 변경 전 `DATABASE_SCHEMA.md`, 보안 관련 변경 전 `SECURITY.md`, UI 변경 전 `UI_UX.md`를 확인한다.
- 명세에 없는 대규모 기능을 임의로 추가하지 않는다.
- 명세의 기능을 편의를 이유로 임의 삭제하거나 축소하지 않는다.

## 2. 작업 시작 절차

각 작업을 시작하기 전에 반드시 다음을 수행한다.

1. 현재 작업이 `IMPLEMENTATION_PLAN.md`의 어느 Task/Phase에 해당하는지 확인한다.
2. 관련 기존 파일과 테스트를 먼저 읽는다.
3. 이미 존재하는 패턴, 네이밍, 폴더 구조를 존중한다.
4. 재정 계산 변경이면 관련 Golden Test를 먼저 확인한다.
5. DB 변경이면 migration, RLS, index, constraint 영향을 함께 검토한다.

## 3. 구현 원칙

- 재정 계산 로직을 React 컴포넌트에 직접 넣지 않는다.
- UI는 계산 결과를 표시하고 사용자 입력을 수집하는 책임만 가진다.
- 계산 및 도메인 규칙은 `domain` 또는 `services` 계층의 순수 함수/서비스로 분리한다.
- DB 접근은 명확한 repository/query 계층 또는 서버 전용 모듈로 캡슐화한다.
- Supabase Service Role Key를 브라우저 코드에 절대 노출하지 않는다.
- 금액 계산에 JavaScript floating point를 직접 사용하지 않는다. DB에서는 정수 최소화폐단위 또는 `numeric`, 애플리케이션에서는 정수 금액 타입을 사용한다.
- 날짜/기간 계산은 `Asia/Seoul` 기준을 명시적으로 적용한다.
- Server Component를 기본으로 하고, 실제 상호작용이 필요한 영역만 Client Component로 만든다.

## 4. 절대 깨뜨리면 안 되는 재정 규칙

1. 이체는 수입도 지출도 아니다.
2. 카드대금 납부는 새로운 지출이 아니다.
3. 신용카드 구매는 구매 시점에 소비가 발생한다.
4. 할부 구매의 소비액은 구매일에 전액 인식한다.
5. 할부 회차는 소비가 아니라 미래 결제 현금흐름이다.
6. 잔액조정은 수입/소비 통계에 포함하지 않는다.
7. 예정 거래는 확정 전 실제 통계/예산 사용률에 포함하지 않는다.
8. DEBIT 계정과 연결 BANK 계정을 자산으로 이중 합산하지 않는다.
9. 과거 외화 거래는 저장 당시 `base_amount`로 분석한다.
10. 사용자 A의 데이터가 사용자 B에게 노출되는 구현은 어떤 이유로도 허용하지 않는다.

## 5. 테스트 규칙

- 버그 수정은 가능하면 재현 테스트를 먼저 추가한다.
- 재정 계산 함수는 Unit Test를 가진다.
- DB/RLS 변경은 정책 테스트를 가진다.
- 핵심 사용자 흐름은 Integration 또는 E2E Test로 검증한다.
- 테스트를 삭제하거나 완화해서 구현을 통과시키지 않는다.
- 테스트 기대값을 변경할 때는 해당 변경이 명세와 Business Rule에 부합하는 이유를 확인한다.

## 6. 한 번에 변경할 범위

- 하나의 작업은 하나의 명확한 책임을 가진다.
- 큰 Phase는 독립적으로 검증 가능한 하위 Task로 나눈다.
- 관련 없는 리팩터링을 함께 수행하지 않는다.
- 이미 잘 동작하는 코드를 개인 취향으로 대규모 재작성하지 않는다.

## 7. 완료 보고 형식

각 Task 완료 시 다음 내용을 보고한다.

```text
완료 Task:
변경 파일:
핵심 구현:
DB/Migration 영향:
보안/RLS 영향:
실행한 테스트:
테스트 결과:
남은 위험 또는 다음 Task 주의점:
```

## 8. 커밋 규칙

작업이 독립적으로 검증 가능한 상태일 때 커밋한다.

권장 prefix:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

예:

```text
feat: add account management domain
fix: prevent card payment from double-counting expense
test: add installment cashflow golden cases
```

## 9. 작업 중 명세 모순 발견 시

- 추측으로 구현하지 않는다.
- `MONEY_CONTEXT_SPEC.md`와 `BUSINESS_RULES.md`의 의도를 우선 해석한다.
- 명확한 결론이 가능한 경우 문서를 함께 수정해 결론을 기록한다.
- 제품 방향 자체를 바꿔야 하는 수준이면 구현을 확대하지 말고 사용자 결정이 필요하다는 점을 보고한다.
