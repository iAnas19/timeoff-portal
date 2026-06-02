import Link from "next/link";

export default function ManagerPage() {
  return (
    <main>
      <h1 className="page-title">Manager</h1>
      <p className="page-lead">
        Pending approvals with balance context — implemented in Phase 7.
      </p>
      <p className="phase-note">
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
