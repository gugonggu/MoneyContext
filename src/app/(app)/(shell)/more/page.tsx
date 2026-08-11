import Link from "next/link";

export default function MorePage() {
  return (
    <div>
      <h1>더보기</h1>
      <ul>
        <li>
          <Link href="/assets">자산</Link>
        </li>
        <li>
          <Link href="/statistics">통계</Link>
        </li>
        <li>
          <Link href="/export">AI Export</Link>
        </li>
        <li>
          <Link href="/settings">설정</Link>
        </li>
      </ul>
    </div>
  );
}
