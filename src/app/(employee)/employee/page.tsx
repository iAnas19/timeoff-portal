import Link from "next/link";

export default function EmployeePage() {
  return (
    <main>
      <h1 className="page-title">Employee</h1>
      <p className="page-lead">
        Per-location balances and time-off requests — implemented in Phases 5–6.
      </p>
      <p className="phase-note">
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
