import Link from "next/link";
import ManagerApprovalsContainer from "@/features/approvals/ManagerApprovals";

export default function ManagerPage() {
  return (
    <main>
      <h1 className="page-title">Manager</h1>
      <p className="page-lead">
        Review pending requests with live balance context before approving.
      </p>
      <ManagerApprovalsContainer />
      <p className="phase-note">
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
