# 소비 성격 분류 및 소비 여력 분석 고도화 설계

## 범위

거래의 소비 성격(반복/일회성/비정기/예외적/미분류)을 사용자가 직접 지정할 수 있게 하고, 월간 통계와 AI Export에 "총 확정 소비"와 별개로 예외 소비·일회성 소비·평소(조정) 소비·지출 집중도·Safe-to-Spend(사용 가능 금액) 지표를 추가한다. 기존 회계 원칙(계좌 간 이체 제외, 할부 회차 미래 현금흐름 처리 등)과 기존 `classifyExpenseNature()` 파생 로직은 변경하지 않고 그 위에 사용자 지정 값을 얹는다. 공식 월 지출 금액 자체는 변경하지 않는다.

## 접근 방식

`transactions`에 사용자 지정 소비 성격 컬럼과 출처 컬럼을 추가한다. 출처가 `MANUAL`이면 사용자 지정값을 최종값으로, `UNSET`이면 기존 `classifyExpenseNature()`의 파생값(RECURRING/ONE_TIME/UNKNOWN)을 그대로 최종값으로 사용하는 단일 `resolveExpenseNature()` 함수를 도입해 통계·Export가 이 함수 하나만 참조하게 한다. `SUGGESTED` 출처는 이번 요구사항에서 실제로 채우지는 않지만, 향후 AI 추천이 값을 미리 채워 넣고 사용자가 확정하기 전 상태를 표현할 수 있도록 스키마 단계에서 미리 확보해 둔다.

소비 구조(총/예외/일회성/평소/조정) 계산과 지출 집중도(top1/3/5 비중) 계산은 신규 순수 함수로 도메인 계층에 추가하고, 화면 통계와 AI Export가 동일 함수를 호출한다. "평소 소비"는 `EXCEPTIONAL`을 제외한 나머지 전체(RECURRING/ONE_TIME/IRREGULAR/UNKNOWN)로 정의하며, 이 집합은 코드에 상수로 명시해 이름으로 의도가 드러나게 한다.

Safe-to-Spend는 기존 `calculateFreeSpendable()`/`calculateDailySpendable()`을 확장한다. 급여일은 기존 `profiles.salary_cycle_day`를 재사용하고, 비상금 기준액은 `profiles.emergency_fund_amount`를 신규 추가한다. 두 값 중 하나라도 미설정이면 Safe-to-Spend 관련 필드 전체를 결과에서 생략(0 아님)하고 화면은 설정 유도 UI를 보여준다.

## 구성 및 데이터 흐름

1. **DB**: `transaction_expense_nature` enum(RECURRING/ONE_TIME/IRREGULAR/EXCEPTIONAL/UNKNOWN) 신규 생성. `transactions.expense_nature_user`(nullable enum), `transactions.expense_nature_source`(UNSET/MANUAL/SUGGESTED, 기본 UNSET) 추가. `profiles.emergency_fund_amount`(정수 KRW, nullable) 추가. 기존 RLS `user_owned_rows` 헬퍼 대상 테이블 목록에는 이미 `transactions`/`profiles`가 포함되어 있으므로 신규 컬럼은 별도 정책 없이 커버된다.
2. **도메인 계층**:
   - `src/domain/export/expense-nature.ts`: 기존 `classifyExpenseNature()`는 유지하고 `resolveExpenseNature(tx)`를 추가해 `MANUAL`이면 사용자값, 아니면 파생값을 반환.
   - `src/domain/export/spend-composition.ts`(신규): 거래 목록과 `resolveExpenseNature` 결과를 받아 총소비/예외소비/일회성소비/평소소비/조정소비(총-예외)를 계산.
   - `src/domain/export/concentration.ts`(신규): 지출 거래를 금액 내림차순 정렬해 top1/top3/top5 비중을 계산.
   - `src/domain/forecasts/spendable.ts`: 급여일 기준 다음 급여일 계산 유틸과, 확정 현금유출을 "다음 급여일 이전"/"그 이후(장기)"로 분리하는 파라미터를 추가. 비상금 차감 지원.
3. **서버 계층**: `src/server/transactions/service.ts`의 validate에 `expense_nature_user` optional 필드 추가(값이 오면 source를 MANUAL로 저장). `src/server/export/repository.ts`가 위 도메인 함수들의 입력 데이터를 조회.
4. **UI**:
   - `EditTransactionForm.tsx`에 소비 성격 select(정기/일회성/비정기/예외적/미분류) 추가. `QuickEntryForm.tsx`는 변경하지 않는다.
   - 카테고리/태그 입력란에 "무엇을 샀나요" / "왜, 어떤 상황" 헬프텍스트 추가(스키마 변경 없음).
   - 월간 분석 화면에 총/예외/일회성/반복/비정기/미분류 소비, 주요 대형 거래, 지출 집중도를 기본 노출하고, 조정 소비/Safe-to-Spend/일평균 사용가능액은 접이식 영역에 배치. 급여일 또는 비상금 미설정 시 해당 영역 대신 설정 유도 문구를 보여준다.
5. **AI Export**: `analysis-json.ts`/`markdown.ts`에 소비 성격별 합계, 소비 구조, 집중도, 가까운 미래 현금흐름(단기/장기 분리), 소비 여력 섹션을 추가. 값이 없는 항목(급여일 미설정 등)은 필드를 생략한다. 해석 주의사항에 6개 문구(총 지출≠평소 생활비, 예외/일회성 왜곡 가능성, 조정 소비는 참고 지표, 할부 잔여금은 이미 인식된 소비의 미래 현금흐름, 장기 할부 즉시 차감 시 단기 현금흐름 왜곡 주의, Safe-to-Spend는 안전성 보장이 아닌 참고 지표)를 추가한다.

## 오류 및 정합성

- 소비 성격 select에 값을 입력하지 않으면 기존 동작과 동일(UNSET, 파생값 참고). 강제 선택 없음.
- 기존 거래는 마이그레이션 시 전부 `expense_nature_user = NULL`, `expense_nature_source = 'UNSET'`으로 유지한다. 반복 거래 규칙에서 생성된 거래를 자동으로 `RECURRING`(MANUAL)으로 소급 변환하지 않는다 — `resolveExpenseNature()`가 UNSET 상태에서 이미 파생값으로 RECURRING을 반환하므로 소급 변경이 불필요하고, 데이터 손실/과잉 확정 위험도 없다.
- 화면 통계와 AI Export는 동일한 `resolveExpenseNature`/`spend-composition`/`concentration`/`spendable` 함수를 호출하므로 두 출력이 다른 계산 결과를 낼 수 없다.
- 급여일/비상금 중 하나라도 미설정이면 Safe-to-Spend 필드는 응답에서 아예 생략한다(0으로 표기해 오해를 만들지 않음).

## 테스트

- Case A(평범한 월): 예외/일회성 거래 없이 소비 구조 계산이 총소비와 동일하게 나오는지 확인.
- Case B(대형 예외 지출): 총소비 900,000 / 예외소비 600,000 / 조정소비 300,000 검증.
- Case C(일회성 구매): 공식 소비 420,000 유지, 일회성 소비 별도 표시 검증.
- Case D(할부 구매): 구매월 소비 360,000, 이후 결제월에 추가 소비 미발생 검증(기존 로직 회귀 테스트).
- Case E(Safe-to-Spend): 자산 500,000, 확정지출 100,000, 비상금 200,000 → 사용가능 200,000, 20일 기준 일평균 10,000 검증.
- `resolveExpenseNature`: UNSET/MANUAL 우선순위, `SUGGESTED`가 아직 어디서도 생성되지 않음(회귀 없음) 검증.
- 기존 반복 거래·할부·Export 스냅샷 테스트가 신규 컬럼 추가 후에도 그대로 통과하는지 회귀 확인.

## 범위 제외

- AI 자동 추천(`SUGGESTED` 값 실제 생성) 구현
- QuickEntryForm에서의 소비 성격 입력
- 계좌 단위 비상금 설정
- 급여 주기를 월 1회 고정 외의 형태(2주 단위 등)로 확장
