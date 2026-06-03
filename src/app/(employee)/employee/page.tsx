import Link from "next/link";
import EmployeeBalancesContainer from "@/features/balances/EmployeeBalances";
import RequestFormContainer from "@/features/requests/RequestForm";
import { SEED_IDS } from "@/mocks/seed";

const DEMO_EMPLOYEE_ID = SEED_IDS.employee.alice;

export default function EmployeePage() {
  return (
    <main>
      <h1 className="page-title">Employee</h1>
      <p className="page-lead">
        Per-location balances and time-off requests with HCM reconciliation.
      </p>
      <EmployeeBalancesContainer employeeId={DEMO_EMPLOYEE_ID} />
      <RequestFormContainer employeeId={DEMO_EMPLOYEE_ID} />
      <p className="phase-note">
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
