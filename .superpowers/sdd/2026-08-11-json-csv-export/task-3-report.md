# Task 3 Report: Export download controls

완료 Task: Task 34 Task 3 — JSON/CSV download controls

변경 파일:
- `src/components/export/MarkdownExport.tsx`
- `tests/unit/export-download-controls.test.tsx`
- `docs/IMPLEMENTATION_PLAN.md`

핵심 구현:
- Export 화면에 접근 가능한 `JSON 다운로드`, `CSV 다운로드` 링크를 추가했다.
- 선택한 RECENT, MONTH, CUSTOM 기간 상태를 각 API 엔드포인트의 쿼리 문자열로 그대로 전달한다.
- CUSTOM 및 RECENT 기간에 대한 링크 목적지와 접근 가능한 링크 이름을 컴포넌트 테스트로 검증했다.
- Task 34 체크리스트를 완료 처리했다.

DB/Migration 영향: 없음.

보안/RLS 영향: 없음. 다운로드 링크는 사용자 ID를 포함하지 않으며, 기존 인증된 서버 엔드포인트를 사용한다.

실행한 테스트:
- `npm.cmd test -- tests/unit/export-download-controls.test.tsx tests/unit/markdown-export.test.tsx`
- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`

테스트 결과:
- Focused component tests: 10 passed.
- Full Vitest: 50 files, 279 tests passed.
- Typecheck and production build passed.
- Lint exited 0 with one pre-existing warning in `.worktrees/installment-persistence/src/server/planned/repository.ts` for an unused `data` variable; no lint errors.

남은 위험 또는 다음 Task 주의점:
- 현재 링크는 유효하지 않은 CUSTOM 기간도 서버 검증으로 전달한다. 기존 API는 해당 입력을 거부하며, 다운로드 기능에는 사용자 ID를 추가하지 않아야 한다.
