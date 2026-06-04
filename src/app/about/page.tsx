import Link from "next/link";

export default function AboutPage() {
  return (
    <main>
      <h1 className="page-title">How this works</h1>
      <p className="page-lead">
        ExampleHR is a fast, friendly window onto leave balances that an external HCM
        (Workday/SAP-style) actually owns. The UI predicts optimistically, then
        reconciles against HCM and surfaces any contradiction - it never shows a change
        it can&rsquo;t confirm.
      </p>

      <section className="section">
        <h2 className="section-title">Demo scenarios (Employee page)</h2>
        <ul className="about-list">
          <li>
            <strong>Anniversary bonus</strong> - HCM grants a day server-side; the next
            poll shows it with a &ldquo;balance updated by HCM&rdquo; banner.
          </li>
          <li>
            <strong>Arm silent fail</strong> - the next write returns 200 but doesn&rsquo;t
            persist; reconciliation catches it and warns you to verify.
          </li>
          <li>
            <strong>Arm conflict</strong> - the next write returns 409 (another writer
            changed the cell first).
          </li>
          <li>
            <strong>Arm slow</strong> - the next request is delayed 6-12s so you can
            see the loading/degraded state.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">Assumptions &amp; deliberate decisions</h2>
        <ul className="about-list">
          <li>
            <strong>Days are inclusive calendar days, not business days.</strong>{" "}
            Working-day and holiday calendars are per-location policy the HCM owns - the
            frontend doesn&rsquo;t reimplement what the source of truth computes.
          </li>
          <li>
            <strong>Same-day leave can co-exist across locations.</strong> Per-location
            balances are independent, so overlap is rejected only within a location;
            cross-location absence rules are an HCM-level concern.
          </li>
          <li>
            <strong>No past-dated requests.</strong> Blocked for demo clarity; a real
            system might allow a back-dating window for sudden leave.
          </li>
          <li>
            <strong>The mock HCM is in-memory.</strong> Fully consistent locally; a
            deployed serverless demo may occasionally reset state.
          </li>
        </ul>
      </section>

      <p className="phase-note">
        <Link href="/">&larr; Back to home</Link>
      </p>
    </main>
  );
}
