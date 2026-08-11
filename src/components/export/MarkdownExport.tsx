"use client";

import { useState, useTransition } from "react";

export type MarkdownExportRequest = Readonly<{
  preset: "SPENDING_REVIEW" | "BUDGET_REVIEW" | "FINANCIAL_HEALTH";
  period:
    | Readonly<{ kind: "RECENT"; months: 1 | 3 | 6 }>
    | Readonly<{ kind: "MONTH"; month: string }>
    | Readonly<{ kind: "CUSTOM"; startDate: string; endDate: string }>;
}>;

export type GenerateMarkdownExportAction = (input: MarkdownExportRequest) => Promise<string>;

type PeriodKind = MarkdownExportRequest["period"]["kind"];

const PRESETS = [
  { value: "SPENDING_REVIEW", label: "소비 패턴 분석" },
  { value: "BUDGET_REVIEW", label: "예산 점검" },
  { value: "FINANCIAL_HEALTH", label: "재정 건강 점검" },
] as const;

function currentSeoulMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const value = (type: "year" | "month") => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}`;
}

export function MarkdownExport({ initialMarkdown, onGenerate }: Readonly<{ initialMarkdown: string; onGenerate: GenerateMarkdownExportAction }>) {
  const [preset, setPreset] = useState<MarkdownExportRequest["preset"]>("SPENDING_REVIEW");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("RECENT");
  const [recentMonths, setRecentMonths] = useState<1 | 3 | 6>(1);
  const [month, setMonth] = useState(currentSeoulMonth);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function request(): MarkdownExportRequest | null {
    if (periodKind === "RECENT") return { preset, period: { kind: "RECENT", months: recentMonths } };
    if (periodKind === "MONTH") return { preset, period: { kind: "MONTH", month } };
    if (!startDate || !endDate) {
      setMessage("시작일과 종료일을 입력하세요.");
      return null;
    }
    return { preset, period: { kind: "CUSTOM", startDate, endDate } };
  }

  function refreshPreview() {
    const input = request();
    if (!input) return;
    setMessage("");
    startTransition(async () => {
      try {
        setMarkdown(await onGenerate(input));
      } catch {
        setMessage("내보내기를 생성하지 못했습니다. 다시 시도하세요.");
      }
    });
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setMessage("복사되었습니다.");
    } catch {
      setMessage("복사하지 못했습니다. 브라우저 권한을 확인하세요.");
    }
  }

  return (
    <section aria-labelledby="markdown-export-heading">
      <h1 id="markdown-export-heading">GPT Markdown 내보내기</h1>
      <p>선택한 기간의 데이터를 GPT에 붙여 넣을 수 있는 Markdown으로 만듭니다.</p>

      <label>
        분석 목적
        <select value={preset} onChange={(event) => setPreset(event.target.value as MarkdownExportRequest["preset"])}>
          {PRESETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div role="radiogroup" aria-label="기간 선택">
        <button type="button" role="radio" aria-checked={periodKind === "RECENT"} onClick={() => setPeriodKind("RECENT")}>
          최근 기간
        </button>
        <button type="button" role="radio" aria-checked={periodKind === "MONTH"} onClick={() => setPeriodKind("MONTH")}>
          월 선택
        </button>
        <button type="button" role="radio" aria-checked={periodKind === "CUSTOM"} onClick={() => setPeriodKind("CUSTOM")}>
          직접 범위
        </button>
      </div>

      {periodKind === "RECENT" ? (
        <label>
          최근 기간
          <select value={recentMonths} onChange={(event) => setRecentMonths(Number(event.target.value) as 1 | 3 | 6)}>
            <option value={1}>최근 1개월</option>
            <option value={3}>최근 3개월</option>
            <option value={6}>최근 6개월</option>
          </select>
        </label>
      ) : null}

      {periodKind === "MONTH" ? (
        <label>
          월
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      ) : null}

      {periodKind === "CUSTOM" ? (
        <>
          <label>
            시작일
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            종료일
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </>
      ) : null}

      <button type="button" onClick={refreshPreview} disabled={isPending}>
        {isPending ? "생성 중..." : "미리보기 갱신"}
      </button>
      <button type="button" onClick={copyMarkdown}>
        Markdown 복사
      </button>

      {message ? <p role={message === "복사되었습니다." ? "status" : "alert"}>{message}</p> : null}

      <h2>Markdown 미리보기</h2>
      <pre aria-label="Markdown 미리보기" tabIndex={0}>{markdown}</pre>
    </section>
  );
}
