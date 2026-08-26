"use client";

import IntegrationStatusPage from "../IntegrationStatusPage";

export default function CalendarIntegrationPage() {
  return <IntegrationStatusPage title="Calendar" description="Connect a calendar so Kuba can check availability and schedule meetings with customers." providers={["Google Calendar", "Microsoft Outlook", "Apple Calendar"]} status="Coming Soon" notes={["No OAuth flow, sync route, or provider credential handling exists for calendar services.", "Appointment and scheduling language exists in AI personas and workflows, but no authoritative booking model is connected.", "Calendar access will need tenant-bound provider state before Receptionist scheduling authority can be enabled."]} />;
}
