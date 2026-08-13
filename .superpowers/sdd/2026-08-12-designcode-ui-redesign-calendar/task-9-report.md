# Task 9 Report: Calendar month domain

완료 Task: Task 9 — 달력 도메인 타입, 42칸 월 그리드, 일별 재정 집계

변경 파일:
- `src/domain/calendar/types.ts`
- `src/domain/calendar/month.ts`
- `tests/unit/calendar-month.test.ts`
- `.superpowers/sdd/2026-08-12-designcode-ui-redesign-calendar/task-9-report.md`

핵심 구현:
- 달력 거래, 예정 마커, 셀, 월 모델, 히트 레벨, 대시보드 일자의 공용 불변 타입을 추가했다.
- `addIsoDays` 조합과 `setUTCFullYear` 기반 요일 계산으로 연도 `0000..9999`의 년 `0..99` 보정 문제를 피하면서 일요일부터 시작하는 42칸 월 그리드와 범위를 생성했다.
- `toSeoulDate` 로 모든 거래 타임스탬프를 `Asia/Seoul` 날짜로 변환한 뒤 일별 수입·지출을 집계했다.
- 지출이 있는 날의 분위수로 히트 레벨 `1..4`를 계산하고, 0원은 항상 0으로 유지했다. 단일 지출일은 상위 레벨 4다.
- 현재 월의 수입·지출·순액만 요약하고, 그리드에 보이는 이웃 달 거래는 셀에만 표시했다.

RED 근거:
- 최초 `npx vitest run tests/unit/calendar-month.test.ts`는 Windows PowerShell 실행 정책이 `npx.ps1`을 차단해 환경 오류로 종료했다.
- 동일 명령의 Windows executable인 `npx.cmd vitest run tests/unit/calendar-month.test.ts`로 재실행했다.
- 결과: exit 1, 1 failed file, 0 tests; `Failed to resolve import "@/domain/calendar/month"`. 구현 부재로 인한 예상된 RED를 확인했다.

GREEN 근거:
- `npx.cmd vitest run tests/unit/calendar-month.test.ts`
- 결과: exit 0, 1 file passed, 29 tests passed.

재정 규칙 테스트:
- `CONFIRMED` `INCOME`/`EXPENSE`만 수입·지출로 합산함을 검증했다.
- `TRANSFER`는 수입과 지출에서 제외함을 검증했다.
- `ADJUSTMENT`는 수입과 지출에서 제외함을 검증했다.
- `PENDING`/`CANCELLED`는 실제 집계에서 제외함을 검증했다.
- 외화 거래가 원화 환산 저장값 `baseAmount`로 집계됨을 검증했다.
- UTC 늦은 시각의 거래가 `toSeoulDate` 기준 다음 서울 날짜로 배정됨을 검증했다.
- 예정 마커의 방향과 표시 금액이 셀 확정 합계나 월 요약에 절대 포함되지 않음을 검증했다.
- 이웃 달 거래는 42칸 그리드에 표시되어도 현재 월 요약에서 제외됨을 검증했다.

추가 날짜 회귀 보호:
- 42칸 그리드가 `0000`, `0099`, `9999` 연도에서 `Date.UTC` 의 1900년 보정 없이 4자리 ISO 날짜를 유지함을 검증했다.
- 윤년 2월, 12월→1월 경계, 일요일 시작 월, 이웃 달 플래그, 오늘, 요일 번호를 검증했다.

DB/Migration 영향: 없음. DB, migration, repository, server 코드를 변경하지 않았다.

보안/RLS 영향: 없음. 순수 도메인 계층만 추가했고 인증, 사용자 범위, RLS를 변경하지 않았다.

실행한 검증:
- `npx.cmd vitest run tests/unit/calendar-month.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run build`
- `git diff --check`

검증 결과:
- Focused Vitest: 1 file, 29 tests passed.
- TypeScript: exit 0.
- ESLint: exit 0, errors 0. Task 9 범위 밖 `.worktrees/installment-persistence/src/server/planned/repository.ts` 미사용 `data` 기존 warning 1건은 유지했다.
- Full Vitest: 76 files, 442 tests passed. jsdom이 출력한 기존 `Not implemented: navigation to another Document` 메시지가 있었으나 exit 0이고 실패는 없었다.
- Next.js production build: exit 0, 29 static pages generated.
- Diff whitespace check: 문제 없음.

커밋:
- 메시지: `feat: add calendar month grid and daily aggregation`
- `next-env.d.ts`의 사전 존재 변경은 건드리지 않고 커밋에서 제외한다.
- 정확한 커밋 해시는 커밋 생성 후 상위 에이전트에 전달한다.

자가 검토:
- 현실적인 변이로 `countsTowardTotals`의 status 검사를 제거하거나 `TRANSFER`/`ADJUSTMENT`를 포함하면 재정 규칙 테스트가 실패한다.
- `baseAmount` 대신 다른 금액을 쓰거나 `toSeoulDate` 변환을 제거하면 외화/서울 날짜 테스트가 실패한다.
- 예정 마커를 합계하거나 이웃 달 셀을 월 요약에 포함하면 해당 회귀 테스트가 실패한다.
- `Date.UTC(year, ...)`로 돌아가면 `0000`/`0099` 회귀 테스트가 실패한다.

남은 위험 또는 다음 Task 주의점:
- 이 태스크는 표시용 예정 마커를 입력으로만 받는다. Task 10의 예정·카드결제·반복 마커 수집에서도 확정 합계와 절대 혼합하지 말아야 한다.
- 그리드가 ISO 지원 범위 밖의 이웃 날짜를 필요로 하는 `0000-01`, `9999-12`는 공유 `addIsoDays` 계약에 따라 `RangeError`를 발생시켜 유효하지 않은 5자리/음수 연도를 만들지 않는다.
- 저장소 루트의 `next-env.d.ts` 변경은 Task 9 시작 전부터 존재했으며 이 커밋에 포함하지 않는다.

## Follow-up fix: target-month heat thresholds

독립 리뷰에서 `buildCalendarMonth` 히트 임계값이 대상 월 밖 지출을 포함하는 문제를 발견했다.

근본 원인:
- `aggregateDailyTotals(input.transactions)`는 전체 입력 날짜를 집계하는 정상적인 공용 함수이다.
- `buildCalendarMonth`가 이 전체 map을 범위 필터 없이 `heatLevels`에 넘겨, 월 요약에서는 제외된 이웃/범위 밖 지출이 히트 분위수를 흐렸다.

RED 근거:
- 2026년 8월의 유일한 지출 10,000원과 7월 지출 1,000,000원을 함께 넘기는 회귀 테스트를 먼저 추가했다.
- `npx.cmd vitest run tests/unit/calendar-month.test.ts`: exit 1, 30건 중 1건 실패. 8월 5일의 기대 레벨 4에 대해 실제 레벨 2를 반환했다.

수정:
- 기존 일별 합계와 이웃 달 거래 셀 표시는 유지했다.
- `grid.inCurrentMonth` 날짜 집합에 속한 지출만 `heatLevels`에 넘기도록 범위를 제한했다.

GREEN 및 검증 근거:
- `npx.cmd vitest run tests/unit/calendar-month.test.ts`: exit 0, 1 file, 30 tests passed.
- `npm.cmd run typecheck`: exit 0.

변경 범위:
- `src/domain/calendar/month.ts`
- `tests/unit/calendar-month.test.ts`
- `.superpowers/sdd/2026-08-12-designcode-ui-redesign-calendar/task-9-report.md`
- `next-env.d.ts`는 건드리거나 스테이징하지 않는다.
