import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1 className="page-title">ExampleHR Time-Off</h1>
      <p className="page-lead">
        Balances and requests with optimistic UI and HCM reconciliation.
      </p>
      <ul className="nav-list">
        <li>
          <Link href="/employee">Employee - balances &amp; requests</Link>
        </li>
        <li>
          <Link href="/manager">Manager - approvals</Link>
        </li>
        <li>
          <Link href="/about">About - how it works &amp; assumptions</Link>
        </li>
      </ul>
    </main>
  );
}
