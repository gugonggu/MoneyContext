# Money Context Security Requirements

Money Context는 개인 금융 데이터를 다루므로 보안은 선택 기능이 아니라 제품 요구사항이다.

# 1. 핵심 원칙

- 사용자 데이터 격리는 DB RLS를 최종 방어선으로 한다.
- 클라이언트가 보내는 `user_id`, `role`, `account_id`를 신뢰하지 않는다.
- Service Role Key는 서버 전용이다.
- 인증 여부와 권한 여부를 구분한다.
- Export/Backup은 민감한 데이터 묶음으로 취급한다.

# 2. Authentication

지원 Provider:

- Google

신규 가입 흐름:

```text
invite code 검증
→ OAuth
→ callback
→ profile 생성
→ onboarding
```

초대코드 검증은 서버에서 수행한다.

초대코드는 DB에 평문 저장하지 않고 안전한 hash로 저장한다.

# 3. Authorization

## 일반 사용자

자기 데이터만 CRUD 가능.

## ADMIN

공용 초대코드와 signup 활성화 설정만 추가 권한을 가진다.

ADMIN이라고 해서 다른 사용자의 재정 데이터를 열람하는 기능을 만들지 않는다.

# 4. RLS

모든 사용자 소유 테이블 RLS 활성화.

기본 조건:

```text
auth.uid() = user_id
```

`profiles`는 `auth.uid() = id`.

Join table도 상위 엔티티 소유권을 검증한다.

# 5. IDOR 방지

다음 요청을 공격 시나리오로 테스트한다.

- URL의 transaction id를 다른 사용자의 UUID로 교체
- account id를 다른 사용자의 account로 교체
- tag/category id cross-user 연결 시도
- export query에 다른 user id 전달
- backup restore payload에 다른 user id 삽입

결과는 모두 거부되어야 한다.

# 6. Server Action / Route Handler

각 쓰기 요청:

1. session 확인
2. input validation
3. referenced entity ownership 확인
4. domain validation
5. transaction/mutation 수행

# 7. 민감정보

로그 금지:

- OAuth access/refresh token
- service role key
- 전체 backup JSON
- 전체 GPT Export payload
- invite code 원문
- 사용자의 상세 거래 memo 전체

# 8. Environment Variables

클라이언트 노출 허용:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

서버 전용 예:

```text
SUPABASE_SERVICE_ROLE_KEY
APP_INVITE_PEPPER
```

환경변수 이름은 실제 구현 시 하나로 확정하고 `.env.example`에 설명한다.

# 9. Export

- 현재 사용자 데이터만 포함
- URL에 export 원문을 넣지 않음
- 서버 로그에 export body를 남기지 않음
- 다운로드 response에 적절한 `Content-Disposition` 적용
- 가능하면 브라우저에서 즉시 생성/전달하고 서버에 파일을 영구 저장하지 않음

# 10. Backup / Restore

Backup:

- 현재 사용자 데이터만
- `schema_version` 포함
- OAuth token 포함 금지
- 내부 service metadata 포함 금지

Restore:

- user_id는 backup 값을 신뢰하지 않고 현재 사용자 id로 재매핑
- cross-user UUID reference 거부
- schema validation 필수
- 전체 restore는 transaction 사용
- 실패 시 부분 복구 상태가 남지 않아야 함

# 11. Account Deletion

사용자 재확인 후 서버 권한으로 수행한다.

순서:

1. 선택적 backup 제공
2. 사용자 데이터 삭제
3. profile 삭제
4. auth user 삭제

실패 시 어느 단계에서 멈췄는지 서버 측 audit 정보를 남기되 금융 내용은 기록하지 않는다.

# 12. Input Validation

검증 대상:

- 금액 음수/범위
- 통화코드
- 날짜 범위
- account ownership
- category/tag ownership
- transfer from/to 동일 여부
- installment count
- card payment day
- salary cycle day
- backup JSON schema

# 13. CSRF/XSS

- Supabase/Next Auth 흐름의 state/PKCE를 올바르게 사용한다.
- 사용자 memo를 HTML로 렌더링하지 않는다.
- Markdown Export는 text 데이터로 생성한다.
- Rich text 입력 기능을 만들지 않는다.

# 14. Rate Limiting

다음 Endpoint에는 rate limiting 고려:

- invite code verification
- auth-adjacent custom endpoint
- backup restore
- account deletion

# 15. Dependency Security

- lockfile 커밋
- 정기 dependency audit
- 오래된 auth/security 라이브러리 방치 금지
- 보안 목적 없이 직접 crypto 구현 금지
