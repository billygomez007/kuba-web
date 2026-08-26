# SuperKuba Incident Response Runbook

## Severity

- **P0:** Active cross-tenant exposure, auth bypass, secret exposure, destructive corruption, or financial compromise.
- **P1:** Major outage, privilege escalation risk, billing/AI safety failure, or release-blocking data-integrity issue.
- **P2:** Material degradation, incomplete recovery/monitoring, or contained security weakness.
- **P3:** Non-blocking defect or operational improvement.

## Response

1. Assign incident owner and technical lead.
2. Record start time, affected environment, deployment, symptoms, and evidence without copying secrets or private customer content.
3. Contain: pause rollout, disable unsafe capability, revoke exposed credentials, or restrict affected route.
4. Preserve logs and audit evidence.
5. Communicate impact and next update to stakeholders.
6. Recover using the approved deployment or backup runbook.
7. Verify tenant isolation, authentication, billing, webhooks, and critical workflows.
8. Close only after owner approval and create a postmortem with root cause and prevention items.

## Scenarios

For database outage, provider outage, Vercel failure, email failure, AI failure, or webhook failure: fail closed for sensitive mutations, preserve queued work where possible, avoid duplicate retries, and provide safe user errors.
