# Money Context Setup & Environment

# 1. 예정 기술

- Next.js App Router
- TypeScript
- Supabase PostgreSQL/Auth/RLS
- Google OAuth
- Vercel

정확한 패키지 버전은 프로젝트 생성 시 최신 안정 버전을 확인하고 lockfile로 고정한다.

# 2. 환경

권장:

```text
development (cloud)
preview (cloud)
production (cloud)
```

Supabase는 가능하면 production과 개발용 프로젝트를 분리한다.

# 3. 환경변수

`.env.example`에 이름과 설명만 커밋한다.

예상 변수:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_INVITE_PEPPER=
NEXT_PUBLIC_APP_URL=
```

OAuth Client Secret은 Supabase Provider 설정 또는 안전한 서버 설정에 보관한다.

# 4. Supabase Cloud

개발·미리보기·운영 환경은 각각 연결된 Supabase Cloud 프로젝트를 사용한다. 로컬 Supabase 컨테이너는 사용하지 않는다.

권장 흐름:

```bash
supabase init
supabase link --project-ref <cloud-project-ref>
supabase db push --linked
```

모든 DB 변경은 migration으로 관리한다.

`production dashboard에서 직접 컬럼 추가` 같은 변경은 금지한다.

# 5. Migration

디렉터리 예:

```text
supabase/
├─ migrations/
├─ seed.sql
└─ config.toml
```

Migration은 다음을 포함해야 한다.

- table
- enum
- index
- fk
- check constraint
- trigger
- RLS
- policy

# 6. Seed

신규 사용자 생성 시 시스템 기본 카테고리를 사용자 소유 row로 seed한다.

예:

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

# 7. OAuth

## Google

- Google Cloud OAuth Client 생성
- Supabase callback URL 등록
- development/production cloud redirect 검증

# 8. Vercel

- Git 저장소 연결 (GitHub 저장소를 Vercel에 처음 Import)
- Preview/Production env 분리
- Supabase URL/key 설정
- Production APP URL 설정
- OAuth Redirect URL production 반영
- `vercel.json`의 `crons` 항목이 배포와 함께 자동 등록됨 (Hobby 플랜은 프로젝트당 cron 1개까지 무료; Pro 이상 필요 시 확인)

# 9. Cron

**구현 완료 (2026-08-12):** `vercel.json`에 `/api/cron/recurring`을 매일 `0 15 * * *`(UTC, = Asia/Seoul 00:00)에 실행하도록 등록되어 있다. 이 라우트는 `generate_due_recurring_transactions_for_all_users` DB 함수(service-role 전용, `supabase/migrations/20260812130000_recurring_generation_for_all_users.sql`)를 호출해 로그인 여부와 무관하게 전체 사용자의 반복 거래를 생성한다.

- idempotent — `recurring_transactions`/`transactions`의 occurrence unique key로 보장 (재실행해도 중복 생성 없음, `tests/integration/recurring-cron.test.ts`에서 검증)
- 인증: `CRON_SECRET` 환경변수를 Vercel Production에 설정해야 함. Vercel이 이 이름의 env var를 감지하면 cron 호출 시 자동으로 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙인다.
- `CRON_SECRET`을 설정하지 않으면 라우트가 500을 반환하며 아무 것도 실행하지 않는다 (fail-closed).

# 10. 개발 명령

프로젝트 생성 후 실제 package manager에 맞춰 README를 갱신한다.

권장 명령 역할:

```text
dev      로컬 개발
build    production build
test     unit/integration
lint     lint
typecheck TypeScript 검사
test:e2e E2E
```

# 11. Production 체크리스트

- RLS 모두 ON
- service key client bundle 미포함
- OAuth production redirect 검증
- invite code hash 설정
- ADMIN 초기 계정 설정
- signup enabled 확인
- migration 최신
- `CRON_SECRET` 설정 및 Vercel Cron 등록 확인
- backup/restore smoke test
- card/transfer golden test pass
- Vercel build pass
