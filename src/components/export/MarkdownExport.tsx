"use client";

import { useRef, useState, useTransition } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

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

const PERIOD_OPTIONS: readonly Readonly<{ kind: PeriodKind; label: string }>[] = [
  { kind: "RECENT", label: "최근 기간" },
  { kind: "MONTH", label: "월 선택" },
  { kind: "CUSTOM", label: "직접 범위" },
];

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
  const periodRadioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function request(): MarkdownExportRequest | null {
    if (periodKind === "RECENT") return { preset, period: { kind: "RECENT", months: recentMonths } };
    if (periodKind === "MONTH") return { preset, period: { kind: "MONTH", month } };
    if (!startDate || !endDate) {
      setMessage("시작일과 종료일을 입력하세요.");
      return null;
    }
    if (startDate > endDate) {
      setMessage("시작일은 종료일보다 늦을 수 없습니다.");
      return null;
    }
    return { preset, period: { kind: "CUSTOM", startDate, endDate } };
  }

  function downloadHref(format: "json" | "csv"): string {
    const params = new URLSearchParams({ kind: periodKind });
    if (periodKind === "RECENT") params.set("months", String(recentMonths));
    if (periodKind === "MONTH") params.set("month", month);
    if (periodKind === "CUSTOM") {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    return `/api/export/${format}?${params.toString()}`;
  }

  function selectPeriod(index: number) {
    const nextIndex = (index + PERIOD_OPTIONS.length) % PERIOD_OPTIONS.length;
    setPeriodKind(PERIOD_OPTIONS[nextIndex].kind);
    periodRadioRefs.current[nextIndex]?.focus();
  }

  function handlePeriodKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectPeriod(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectPeriod(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectPeriod(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectPeriod(PERIOD_OPTIONS.length - 1);
    }
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
    <section aria-labelledby="markdown-export-heading" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 id="markdown-export-heading" className="text-2xl font-bold tracking-tight text-slate-900">
          GPT Markdown 내보내기
        </h1>
        <p className="mt-1 text-sm text-slate-500">선택한 기간의 데이터를 GPT에 붙여 넣을 수 있는 Markdown으로 만듭니다.</p>
      </div>

      <Card className="flex flex-col gap-5">
        <Select label="분석 목적" value={preset} onChange={(event) => setPreset(event.target.value as MarkdownExportRequest["preset"])}>
          {PRESETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div role="radiogroup" aria-label="기간 선택" className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option, index) => (
            <button
              key={option.kind}
              ref={(element) => { periodRadioRefs.current[index] = element; }}
              type="button"
              role="radio"
              aria-checked={periodKind === option.kind}
              tabIndex={periodKind === option.kind ? 0 : -1}
              onClick={() => setPeriodKind(option.kind)}
              onKeyDown={(event) => handlePeriodKeyDown(event, index)}
              className={cx(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                periodKind === option.kind
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {periodKind === "RECENT" ? (
          <Select
            label="최근 기간"
            value={recentMonths}
            onChange={(event) => setRecentMonths(Number(event.target.value) as 1 | 3 | 6)}
            className="max-w-xs"
          >
            <option value={1}>최근 1개월</option>
            <option value={3}>최근 3개월</option>
            <option value={6}>최근 6개월</option>
          </Select>
        ) : null}

        {periodKind === "MONTH" ? (
          <TextField
            label="월"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="max-w-xs"
          />
        ) : null}

        {periodKind === "CUSTOM" ? (
          <div className="flex flex-wrap gap-4">
            <TextField
              label="시작일"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="max-w-xs"
            />
            <TextField
              label="종료일"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="max-w-xs"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={refreshPreview} disabled={isPending}>
            {isPending ? "생성 중..." : "미리보기 갱신"}
          </Button>
          <Button type="button" variant="secondary" onClick={copyMarkdown}>
            Markdown 복사
          </Button>
        </div>

        {message ? (
          <Alert kind={message === "복사되었습니다." ? "success" : "error"} role={message === "복사되었습니다." ? "status" : "alert"}>
            {message}
          </Alert>
        ) : null}
      </Card>

      <Card className="mt-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-900">Markdown 미리보기</h2>
        <pre
          aria-label="Markdown 미리보기"
          tabIndex={0}
          className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs whitespace-pre-wrap text-slate-800"
        >
          {markdown}
        </pre>
        <div role="group" aria-label="분석 데이터 다운로드" className="flex flex-wrap gap-2">
          <a
            href={downloadHref("json")}
            download
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            JSON 다운로드
          </a>
          <a
            href={downloadHref("csv")}
            download
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            CSV 다운로드
          </a>
        </div>
      </Card>
    </section>
  );
}
