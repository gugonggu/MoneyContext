# 반복 거래 생성 설계

## 범위

Implementation Plan Stage E, Task 21만 구현한다. 사용자는 반복 수입 또는 지출 규칙을 생성, 조회, 수정, 비활성화할 수 있다. 실행 대상 날짜가 되면 규칙별로 거래를 한 건 생성한다. 자동 스케줄러의 배포 및 UI는 이 Task 범위에 포함하지 않는다.

## 접근 방식

서버 서비스는 규칙 입력과 현재 사용자 소유권을 검증하고, repository가 호출하는 DB RPC가 발생 생성과 `next_run_date` 갱신을 하나의 트랜잭션으로 처리한다. 호출 주체는 향후 Cron 또는 운영 작업으로 추가할 수 있으며, 현재는 서버 전용 서비스의 명시적 실행으로 검증한다.

`transactions`의 `(user_id, recurring_rule_id, recurring_occurrence_date)` 부분 unique index를 최종 중복 방어선으로 사용한다. 동일 실행일에 RPC가 재시도되거나 동시에 호출되어도 거래는 한 번만 생성된다.

## 구성 및 데이터 흐름

1. `src/domain/recurring`의 순수 함수가 일, 주, 월 단위와 interval, 월말 보정 규칙으로 다음 발생일을 계산한다. 모든 날짜는 날짜 문자열로 다뤄 시간대 변환을 피한다.
2. `src/server/recurring/service.ts`는 규칙 CRUD 입력을 검증하고 account/category의 현재 사용자 소유권 및 활성 상태를 확인한다.
3. `src/server/recurring/repository.ts`는 현재 사용자로 범위를 제한해 규칙 CRUD를 수행하고, 실행 시 DB RPC를 호출한다.
4. DB RPC는 현재 인증 사용자 소유의 활성·기한 내 규칙만 잠그고, `next_run_date` 이하의 발생분을 생성한다. `AUTO_CONFIRM`은 `CONFIRMED`, `REQUIRE_CONFIRMATION`은 `PENDING` 상태를 쓴다. 각 생성 거래에는 규칙 ID와 발생일을 기록한다.
5. 규칙을 수정해도 이미 생성된 거래는 변경하거나 삭제하지 않는다. 비활성화된 규칙은 새 거래를 만들지 않는다.

## 오류 및 정합성

- 수입/지출 외 규칙 유형, 정수가 아닌 금액, 유효하지 않은 통화·날짜·주기, 과거보다 앞선 종료일은 거부한다.
- 다른 사용자의 계정 또는 카테고리는 서비스 조회와 DB 소유권 trigger 모두에서 거부한다.
- RPC는 인증되지 않은 호출 및 소유하지 않은 규칙 실행을 거부한다.
- unique 충돌은 재실행 성공으로 처리하며, 생성된 거래를 중복 반환하지 않는다.

## 테스트

- 순수 함수: 일/주/월 interval, 29·30·31일의 월말 보정, 종료일 경계를 검증한다.
- 서비스: 현재 사용자 소유 활성 계정 검증, 규칙 CRUD 검증, 비활성 규칙 제외를 검증한다.
- 통합: AUTO_CONFIRM/PENDING 상태, 과거 거래 불변성, RPC 재실행 및 동시성에 대한 단일 발생, 사용자 A/B 분리를 검증한다.

## 범위 제외

- Vercel 또는 Supabase Cron 배포·운영 비밀키
- 반복 거래 관리 UI와 알림
- 반복 거래의 미래 현금흐름 화면 반영
