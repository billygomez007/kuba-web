export type AutomationTemplate = {
  id: string;
  name: string;
  description: string;
  industry: string;
  trigger: string;
  conditions: Array<{ field: string; operator: string; value?: string }>;
  actions: Array<Record<string, unknown>>;
  requiredEmployees: string[];
  requiredIntegrations: string[];
  requiredPermissions: string[];
  setupInstructions: string[];
};

const template = (
  input: Omit<AutomationTemplate, "requiredPermissions" | "setupInstructions">,
): AutomationTemplate => ({
  ...input,
  requiredPermissions: ["automations.manage"],
  setupInstructions: [
    "Activate the required AI employee.",
    "Connect the required customer channel.",
    "Review the workflow before enabling it.",
  ],
});

export const automationTemplates: AutomationTemplate[] = [
  template({
    id: "new-customer-enquiry-handler",
    name: "New Customer Enquiry Handler",
    description: "Route new enquiries to Reception, capture a lead, and create the next follow-up.",
    industry: "General Business",
    trigger: "customer.message_received",
    conditions: [],
    actions: [
      { type: "run_ai_employee", employeeType: "receptionist", message: "Answer the customer enquiry using the business context." },
      { type: "create_lead" },
      { type: "create_follow_up", title: "Follow up on new customer enquiry", description: "Review and continue the customer enquiry.", delayMinutes: 60 },
    ],
    requiredEmployees: ["receptionist"],
    requiredIntegrations: ["website"],
  }),
  template({
    id: "missed-lead-recovery",
    name: "Missed Lead Recovery",
    description: "Create a sales follow-up when a lead has gone inactive for 24 hours.",
    industry: "General Business",
    trigger: "customer.inactive",
    conditions: [{ field: "inactiveHours", operator: "equals", value: "24" }],
    actions: [{ type: "create_follow_up", title: "Recover inactive lead", description: "Sales follow up with this inactive lead.", delayMinutes: 0 }],
    requiredEmployees: ["sales"],
    requiredIntegrations: [],
  }),
  template({
    id: "customer-follow-up-system",
    name: "Customer Follow-up System",
    description: "Create an operational task whenever a follow-up becomes due.",
    industry: "General Business",
    trigger: "follow_up.due",
    conditions: [],
    actions: [{ type: "create_task", title: "Complete customer follow-up", description: "Review the due follow-up and complete the next action.", priority: "high", delayMinutes: 0 }],
    requiredEmployees: [],
    requiredIntegrations: [],
  }),
  ...[
    ["dental-appointment-booking", "Appointment Booking Assistant", "Dental Clinic", "appointment", "appointment.created"],
    ["dental-patient-reminder", "Patient Reminder", "Dental Clinic", "receptionist", "customer.inactive"],
    ["dental-treatment-follow-up", "Treatment Follow-up", "Dental Clinic", "customer-support", "follow_up.due"],
    ["dental-review-request", "Review Request", "Dental Clinic", "receptionist", "conversation.escalated"],
    ["pharmacy-prescription-enquiry", "Prescription Enquiry Assistant", "Pharmacy", "receptionist", "customer.message_received"],
    ["pharmacy-refill-reminder", "Customer Refill Reminder", "Pharmacy", "receptionist", "customer.inactive"],
    ["pharmacy-product-enquiry", "Product Enquiry Assistant", "Pharmacy", "customer-support", "customer.message_received"],
    ["travel-enquiry-qualification", "Travel Enquiry Qualification", "Travel Agency", "sales", "customer.message_received"],
    ["travel-visa-consultation", "Visa Consultation Booking", "Travel Agency", "appointment.created", "appointment"],
    ["travel-customer-follow-up", "Travel Customer Follow-up", "Travel Agency", "sales", "follow_up.due"],
    ["real-estate-property-enquiry", "Property Enquiry Assistant", "Real Estate", "sales", "customer.message_received"],
    ["real-estate-viewing-scheduling", "Viewing Appointment Scheduling", "Real Estate", "appointment.created", "appointment"],
    ["real-estate-lead-nurturing", "Lead Nurturing", "Real Estate", "customer.inactive", "sales"],
    ["law-new-case-enquiry", "New Case Enquiry", "Law Firm", "customer.message_received", "receptionist"],
    ["law-consultation-booking", "Consultation Booking", "Law Firm", "appointment.created", "appointment"],
    ["law-client-follow-up", "Client Follow-up", "Law Firm", "follow_up.due", "customer-support"],
  ].map(([id, name, industry, trigger, employee]) => template({
    id: id as string,
    name: name as string,
    description: `A prepared ${name as string} workflow for ${(industry as string).toLowerCase()} teams.`,
    industry: industry as string,
    trigger: trigger as string,
    conditions: [],
    actions: [{ type: "run_ai_employee", employeeType: employee as string, message: `Handle the ${(name as string).toLowerCase()} workflow using the business context.` }],
    requiredEmployees: [employee as string].filter((value) => !value.includes(".")),
    requiredIntegrations: ["whatsapp"],
  })),
];

export function getAutomationTemplate(id: string) {
  return automationTemplates.find((item) => item.id === id);
}
