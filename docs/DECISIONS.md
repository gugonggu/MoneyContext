# Money Context Product Decisions

기획 과정에서 확정한 주요 결정을 기록한다. 이미 확정된 사항을 구현 중 반복해서 재논의하지 않기 위한 문서다.

# 제품

- 이름: **Money Context**
- 성격: 가계부 + 재정 계획 + GPT 분석용 데이터 Export
- 개인 사용이 1차 목적이지만 지인 사용 가능
- 공동 가계부는 제공하지 않음

# 입력

- 기본적으로 수동 입력
- 반복 수입/지출 자동 생성 지원
- 반복 거래는 항목별 `자동 확정 / 확인 필요` 선택
- 거래 입력은 빠른 입력 + 최근 패턴 추천
- 영수증/사진/OCR 없음

# 인증

- 초대제
- 공용 초대코드 한 개
- Google 로그인
- Kakao와 Naver 로그인은 제외

# 금융 계정

- 계좌/현금/체크/신용카드/부채 관리
- 신용카드 결제일, 이용기간, 결제계좌 관리
- 할부 소비와 결제 흐름 분리
- 이체 별도 transaction type
- 실제 잔액과 불일치 시 잔액조정 지원

# 예산/계획

- 월 전체 예산 + 카테고리 예산
- 카테고리별 이월 여부 선택
- 이월은 양수/음수 모두 전달
- 여러 저축 목표
- 목표별 월 적립 계획
- 미래 일회성 예정 거래
- 예정 거래를 재정 예측에 반영
- 달력 월 + 급여 사이클 둘 다 제공

# 데이터 분류

- 기본 카테고리 제공 + 사용자 커스텀
- 선택적 다중 태그
- 외화 거래 지원
- 거래 당시 KRW 환산값 저장
- 외화 자산의 실시간 평가 없음

# 통계

상세 통계 지원:

- 월별
- 3/6개월
- 카테고리
- 태그
- 결제수단
- 고정비/변동비
- 요일/주차
- 전월 대비
- 저축률
- 순자산

# GPT

- 앱 내부 OpenAI API 연동 없음
- Markdown + JSON + CSV Export
- 기간 선택 + 목적별 프리셋

# 데이터 보관

- Supabase
- 전체 JSON 백업/복구
- 계정 삭제 전 백업 유도
- 삭제 선택 시 사용자 데이터 완전 삭제

# 알림

- 앱 내부 알림센터만
- Push/Email 없음

# UI

- 모바일 + PC 모두 정식 지원
- 모바일 빠른 입력 우선
- PC 관리/분석 강화

# 배포

- Vercel + Supabase

# GPT Export 의미 정확도 (2026-08-14)

- `수입 - 지출`은 "저축"이 아니라 "기간 잉여금"으로 명칭을 분리한다. 저축 목표 적립액은 분석 기간 내, Money Context 저축 목표에 연결된 `savings_contributions` 합계만 사용한다.
- Analysis JSON은 기존 `net_cashflow_base_amount` 필드를 유지하고 `period_surplus_base_amount`/`surplus_rate`를 추가만 한다. 필드 제거가 없으므로 `schema_version`은 올리지 않는다.
- 소비 성격(RECURRING/ONE_TIME/UNKNOWN) 분류는 새 DB 컬럼을 만들지 않고 기존 `recurring_rule_id`/`planned_transaction_id`로 도출한다. 사용자가 거래별로 직접 성격을 지정하는 UI는 이번 범위에서 구현하지 않았다 — 필요 여부는 사용자 확인 후 별도 작업으로 진행한다.
- 결제수단별 소비에서 "미지정"(진짜 데이터 누락)과 "외부 자금 이동"(상대편이 Money Context가 관리하는 내 계좌가 아닌 송금/수신 — 계좌 정보 유무가 아니라 상대방이 내 계정인지가 기준. 자세한 정의는 아래 3차 정정 참고)을 분리한다. "외부 자금 이동" 섹션은 항상 별도로 합계를 보여준다.

# GPT Export 의미 정정 2차 (2026-08-14)

- Markdown "외부 자금 이동" 섹션은 이미 기간 수입/지출에 포함된 부분집합이라는 점이 제목에서 드러나지 않아 AI가 이중 계산할 위험이 있었다. 섹션 제목을 "외부 자금 이동 (위 수입/지출에 이미 포함)"으로 바꾸고, 해석 주의사항과 JSON `external_flows.included_in_period_totals: true`로 동일한 의미를 명시했다.
- 해석 주의사항의 "반복성 지출은 ... 사용자가 예정 거래로 등록한 항목만 의미"라는 문구가 예정 거래(planned transaction)와 반복 거래(recurring transaction)를 혼동시켰다. 실제 분류 로직(`recurring_rule_id`→RECURRING, `planned_transaction_id`→ONE_TIME)은 처음부터 올바랐으므로 **로직은 변경하지 않고 설명 문구만 수정**했다.
- `actual_savings_base_amount`/`actual_savings_rate` 필드는 바로 이전 작업에서 신설되어 외부에 공개된 이력이 없으므로, 하위 호환 별칭을 남기지 않고 `savings_goal_contribution_base_amount`/`savings_goal_contribution_rate`로 정리했다. `net_cashflow_base_amount`(이전부터 존재)는 계속 별도로 유지한다. 필드 제거가 아닌 신설 필드의 명칭 정리이므로 `schema_version`은 올리지 않는다.
- Category(무엇에 사용)와 Tag(왜/어떤 맥락)의 역할을 `BUSINESS_RULES.md`에 명문화했다. 기존 거래의 카테고리/태그는 소급 재분류하지 않는다.

# GPT Export 의미 정정 3차 (2026-08-14)

- Export 상단에 `선택한 분석 기간`과 `실제 확정 거래 집계 범위`, `기간 상태`(NOT_STARTED/IN_PROGRESS/COMPLETE)를 분리해 표시한다. `실제 확정 거래 집계 종료일 = min(선택한 분석 종료일, Asia/Seoul 기준 오늘)`로 계산하며, `resolvePeriodAggregation`(`src/domain/export/period.ts`) 하나로 Markdown/JSON이 동일 로직을 공유한다. JSON `period`에 `actual_data_start_date`/`actual_data_end_date`/`status` 필드를 추가만 했으므로 `schema_version`은 올리지 않는다.
- "외부 자금 이동"의 판정 기준이 "계좌 정보 유무"가 아니라 "거래 상대편이 Money Context가 관리하는 내 계좌인지 여부"임을 명확히 했다. **판정 로직(`classifyTransferDirection`, `paymentMethodKey`, `externalFlows`)은 기존부터 이미 이 기준으로 정확하게 동작하고 있었으므로 변경하지 않았다** — 문제는 해석 주의사항과 `BUSINESS_RULES.md`/`EXPORT_FORMATS.md`의 문구가 "계좌 정보가 없는 외부 송금/수입"이라고 잘못 서술해, 출금 계좌가 있는 외부 송금(예: "엄마 송금 600,000원, 출금 계좌: 부산은행")까지 계좌 정보가 없는 것처럼 오해하게 만든 것이었다. 문서와 해석 주의사항 문구만 수정했다.
