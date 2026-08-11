# Task 2: Authenticated export read model report

완료 Task: Task 33 / Task 2 — authenticated export read model

변경 파일:

- `src/server/export/repository.ts`
- `src/server/export/service.ts`
- `src/server/export/index.ts`
- `tests/unit/export-service.test.ts`
- `tests/integration/export.test.ts`

핵심 구현:

- 현재 프로필의 `id`만 facade에서 export service에 전달하고, repository의 모든 Supabase query에 `user_id` 조건을 적용했다.
- 선택 기간은 formatter와 query 이전에 `resolveExportPeriod`로 검증한다. 잘못된 범위는 데이터 조회와 formatter 호출 없이 `RangeError`로 거부한다.
- 거래 read model은 계정 FK를 명시적으로 지정해 category, account, tag, memo, 원본 통화/금액 및 저장된 `base_amount`를 매핑한다. 분석 출력은 formatter가 저장된 `baseAmount`를 사용한다.
- 거래 기간 query는 `Asia/Seoul` 자정 경계의 half-open interval을 사용한다.
- 자산/부채/카드 값은 기존 asset read service를 재사용해 DEBIT 중복합산 및 카드 미결제액 규칙을 유지한다. 음수 현금성 잔액은 export 위치 모델에서 부채로 표시해 formatter 금액 계약을 유지한다.
- 월/카테고리 예산, 계획 현금흐름, 활성 저축 목표와 기여금, 카드 현황을 사용자 범위 read model로 함께 구성한다.

DB/Migration 영향: 없음.

보안/RLS 영향:

- 신규 RLS 정책이나 schema 변경은 없다.
- 서버 facade는 `requireCurrentProfile`을 사용하고, repository는 RLS 외에도 모든 user-owned read에 명시적인 `user_id` 필터를 사용한다.
- Supabase Cloud integration test는 User A export에 User B의 거래·category·account·tag·금액이 포함되지 않음을 검증한다.

TDD 증적:

- RED: `npm.cmd test -- --run tests/unit/export-service.test.ts tests/integration/export.test.ts`를 신규 모듈 생성 전에 실행했고, `@/server/export/{service,repository}` import를 해석하지 못해 실패했다.
- GREEN: 구현 후 같은 focused suite가 통과했다.

실행한 테스트:

- `npm.cmd test -- --run tests/unit/export-service.test.ts tests/integration/export.test.ts`
- `npx.cmd eslint src/server/export tests/unit/export-service.test.ts tests/integration/export.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd test -- --run`
- `git diff --check`

테스트 결과:

- Focused export suite: 2 files, 4 tests passed.
- ESLint: passed.
- TypeScript: passed.
- Full Vitest suite: 45 files, 250 tests passed.
- Diff whitespace check: passed.

## Review follow-up

- A planned foreign-currency row with `base_amount = null` is now omitted from the Markdown read model. The repository never substitutes the original foreign amount as KRW.
- Added a Supabase Cloud integration test that authenticates as User A and supplies User B's id to the export service. The read is rejected because User A cannot read User B's profile or finance data through RLS.
- Verification after the fix: focused export suite 2 files / 6 tests passed; typecheck and ESLint passed; full Vitest suite 45 files / 252 tests passed.

남은 위험 또는 다음 Task 주의점:

- Task 3 UI는 `generateMarkdownExportForCurrentUser`만 호출해 서버 전용 auth/read boundary를 유지해야 한다.
- Preview/clipboard UI는 임의 user id를 받거나 client-side Supabase export query를 추가하면 안 된다.
