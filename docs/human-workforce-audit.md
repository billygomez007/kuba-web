# Human Workforce forensic audit

Starting staging SHA: `c85af7be071b68107e5978746e4ffeb4791e67b3`

No HR/payroll application routes or services existed at the start of Phase 5. The similarly named `/dashboard/employees` and `/api/employees` surfaces are AI employee features and remain separate.

| Feature | Existing route | Existing API | Schema support | Tenant security | Starting UI | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Workforce overview | `/dashboard/workforce` (AI) | AI workforce APIs | HR + team tables | AI context only | Disconnected | A: `/dashboard/human-workforce` |
| Employees | AI employee detail only | AI employee list only | `hr_employees`, profiles, status history | None for HR | Missing | A: tenant-scoped read/filter surface |
| Employee lifecycle | None | None | Status + history | None | Missing | G: schema only; mutations intentionally withheld |
| Departments | None | None | `hr_departments` | None | Missing | A: tenant-scoped read surface |
| Positions | None | None | `hr_positions` | None | Missing | A: tenant-scoped read surface |
| Contracts | None | None | `hr_contracts` | None | Missing | A: tenant-scoped read surface |
| Employee documents | None | None | `hr_employee_documents` | None | Missing | A: restricted HR metadata surface |
| Attendance | None | None | Policies, schedules, records, corrections | None | Missing | A: today/read surface; corrections read-only |
| Leave | None | None | Types, balances, requests, history | None | Missing | A: read surface; mutations withheld |
| Performance | None | None | None | None | Missing | H: Coming Soon |
| Recruitment | None | None | None | None | Missing | H: Coming Soon |
| Payroll | None | None | Extensive `payroll_*` tables | None | Missing | E: restricted read-only metadata; engine absent |
| Operational teams | AI team route | AI workforce team API | Existing business teams + human/AI joins | Existing selected business | Disconnected | A: combined composition read surface |
| Team Staff | Settings route | Team membership APIs | Users/business users | Existing selected business | Functional | A: unchanged under Settings |

## Payroll classification

- Read-only ready: periods, runs, compensation-profile metadata, salary structures, payslip metadata, jurisdiction settings.
- Partial: overtime and statutory rule data exist, but have no authoritative application service.
- Mutation ready: none found.
- Schema only: calculations, run execution, approval/finalization, payment, statutory computation, payslip generation, and configuration mutation.

Payroll access uses the established role and permission vocabulary: an owner/admin/accountant role plus `accounting.view`. Basic `workforce.view` alone never returns payroll data.

## Deliberate gaps

- Employee profile personal fields are not returned by the general workforce endpoint.
- Salary values, banking information, private document contents/storage keys, and payroll calculation items are not shown.
- Employee, attendance, leave, contract, document, and payroll mutations are withheld until authoritative services and approval rules exist.
- Performance and recruitment require future schema and backend work.
- Business teams have no branch or team-lead column, so neither relationship is invented.
- `business_team_members` links platform memberships rather than HR employees; the UI labels these as human team members without treating them as HR employee records.
