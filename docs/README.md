# Money Context Documentation

Money Context는 개인의 수입·지출·자산·부채·예산·저축 계획을 관리하고, 축적된 데이터를 외부 AI가 분석하기 좋은 형태로 내보내는 반응형 개인 재정 관리 웹 애플리케이션이다.

## 문서 읽는 순서

1. `MONEY_CONTEXT_SPEC.md` — 제품 전체 요구사항과 최종 범위
2. `AGENTS.md` — Codex/에이전트가 항상 따라야 하는 작업 규칙
3. `BUSINESS_RULES.md` — 재정 계산 및 거래 의미의 절대 규칙
4. `ARCHITECTURE.md` — 애플리케이션 구조와 책임 분리
5. `DATABASE_SCHEMA.md` — 데이터베이스, 제약조건, RLS 기준
6. `UI_UX.md` — 모바일/PC 화면 구조와 상호작용 원칙
7. `EXPORT_FORMATS.md` — Markdown/JSON/CSV/백업 포맷
8. `SECURITY.md` — 인증, RLS, 민감데이터 처리 기준
9. `TEST_CASES.md` — 재정 계산 Golden Test 및 E2E 시나리오
10. `IMPLEMENTATION_PLAN.md` — 실제 구현 순서와 완료 조건
11. `SETUP_AND_ENV.md` — 환경변수, Supabase, OAuth, Vercel 설정
12. `DECISIONS.md` — 기획 단계에서 확정한 주요 결정과 제외 범위
13. `GLOSSARY.md` — Money Context에서 사용하는 도메인 용어 정의

## 문서 우선순위

문서가 서로 충돌할 경우 다음 우선순위를 따른다.

1. `MONEY_CONTEXT_SPEC.md`
2. `BUSINESS_RULES.md`
3. `SECURITY.md`
4. `DATABASE_SCHEMA.md`
5. `ARCHITECTURE.md`
6. 나머지 보조 문서

충돌을 발견하면 임의로 한 문서를 무시하지 말고, 상위 문서를 기준으로 하위 문서를 함께 수정해 일관성을 회복한다.

## 권장 저장소 구조

```text
money-context/
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ MONEY_CONTEXT_SPEC.md
│  ├─ BUSINESS_RULES.md
│  ├─ ARCHITECTURE.md
│  ├─ DATABASE_SCHEMA.md
│  ├─ UI_UX.md
│  ├─ EXPORT_FORMATS.md
│  ├─ SECURITY.md
│  ├─ TEST_CASES.md
│  ├─ IMPLEMENTATION_PLAN.md
│  ├─ SETUP_AND_ENV.md
│  ├─ DECISIONS.md
│  └─ GLOSSARY.md
├─ src/
├─ supabase/
└─ tests/
```

압축파일에서는 확인 편의를 위해 모든 문서를 한 디렉터리에 두었다. 실제 저장소를 시작할 때 `AGENTS.md`와 `README.md`는 루트에, 나머지는 `docs/` 아래로 옮기는 구성을 권장한다.
