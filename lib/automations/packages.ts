import { automationTemplates, type AutomationTemplate } from "./templates";

export type WorkforcePackage = {
  id: string;
  name: string;
  industry: string;
  description: string;
  employees: Array<{ type: string; name: string; description: string }>;
  automationTemplateIds: string[];
  knowledgeTemplates: string[];
  requiredIntegrations: string[];
  setupSteps: string[];
};

const templateIds = new Set(automationTemplates.map((item) => item.id));

export const workforcePackages: WorkforcePackage[] = [
  {
    id: "dental-clinic-ai-workforce",
    name: "Dental Clinic AI Workforce",
    industry: "Dental Clinic",
    description: "A coordinated AI team for patient enquiries, appointments, reminders, and follow-up.",
    employees: [
      { type: "receptionist", name: "Dental Receptionist AI", description: "Welcomes patients and handles clinic enquiries." },
      { type: "customer-support", name: "Patient Support AI", description: "Supports patients with service and treatment questions." },
      { type: "appointment", name: "Appointment Coordinator AI", description: "Coordinates appointment requests and reminders." },
    ],
    automationTemplateIds: ["dental-appointment-booking", "dental-patient-reminder", "dental-treatment-follow-up", "dental-review-request"],
    knowledgeTemplates: ["Dental services", "FAQs", "Clinic information", "Working hours"],
    requiredIntegrations: ["whatsapp"],
    setupSteps: ["Connect the clinic WhatsApp channel.", "Review patient-facing knowledge in Business Brain.", "Confirm appointment and escalation rules."],
  },
  {
    id: "pharmacy-ai-workforce",
    name: "Pharmacy AI Workforce",
    industry: "Pharmacy",
    description: "A focused pharmacy team for product enquiries, prescription questions, refills, and follow-up.",
    employees: [
      { type: "receptionist", name: "Pharmacy Assistant AI", description: "Handles pharmacy enquiries and customer information." },
      { type: "customer-support", name: "Customer Support AI", description: "Supports customers with service and product questions." },
    ],
    automationTemplateIds: ["pharmacy-prescription-enquiry", "pharmacy-refill-reminder", "pharmacy-product-enquiry"],
    knowledgeTemplates: ["Products", "Services", "Pharmacy information"],
    requiredIntegrations: ["whatsapp"],
    setupSteps: ["Connect the pharmacy customer channel.", "Add products and policies to Business Brain.", "Review prescription escalation rules."],
  },
  {
    id: "travel-agency-ai-workforce",
    name: "Travel Agency AI Workforce",
    industry: "Travel Agency",
    description: "A travel team for enquiry qualification, consultation booking, and customer updates.",
    employees: [
      { type: "sales", name: "Travel Consultant AI", description: "Qualifies travel enquiries and supports opportunities." },
      { type: "receptionist", name: "Visa Assistant AI", description: "Handles visa and consultation enquiries." },
      { type: "customer-support", name: "Customer Support AI", description: "Supports travellers throughout their journey." },
    ],
    automationTemplateIds: ["travel-enquiry-qualification", "travel-visa-consultation", "travel-customer-follow-up"],
    knowledgeTemplates: ["Destinations", "Visa information", "Travel packages"],
    requiredIntegrations: ["whatsapp"],
    setupSteps: ["Connect the travel agency channel.", "Add destinations and visa information.", "Review consultation and follow-up rules."],
  },
  {
    id: "real-estate-ai-workforce",
    name: "Real Estate AI Workforce",
    industry: "Real Estate",
    description: "A property enquiry and sales team for viewings, qualification, and lead nurturing.",
    employees: [
      { type: "receptionist", name: "Property Receptionist AI", description: "Receives property enquiries and routes requests." },
      { type: "sales", name: "Sales Agent AI", description: "Qualifies buyers and nurtures property opportunities." },
    ],
    automationTemplateIds: ["real-estate-property-enquiry", "real-estate-viewing-scheduling", "real-estate-lead-nurturing"],
    knowledgeTemplates: ["Properties", "Viewing information", "Pricing and policies"],
    requiredIntegrations: ["whatsapp"],
    setupSteps: ["Connect the property enquiry channel.", "Add listings and viewing information.", "Review lead qualification rules."],
  },
  {
    id: "law-firm-ai-workforce",
    name: "Law Firm AI Workforce",
    industry: "Law Firm",
    description: "A client intake team for new case enquiries, consultation bookings, and client follow-up.",
    employees: [
      { type: "receptionist", name: "Legal Receptionist AI", description: "Receives new case enquiries and routes clients." },
      { type: "customer-support", name: "Client Intake Assistant AI", description: "Collects intake details and supports client communication." },
    ],
    automationTemplateIds: ["law-new-case-enquiry", "law-consultation-booking", "law-client-follow-up"],
    knowledgeTemplates: ["Practice areas", "FAQs", "Firm information", "Consultation policies"],
    requiredIntegrations: ["whatsapp"],
    setupSteps: ["Connect the firm customer channel.", "Add practice areas and intake policies.", "Review sensitive-request escalation rules."],
  },
];

export function getWorkforcePackage(id: string) {
  return workforcePackages.find((item) => item.id === id);
}

export function getPackageTemplates(workforcePackage: WorkforcePackage): AutomationTemplate[] {
  return workforcePackage.automationTemplateIds
    .filter((id) => templateIds.has(id))
    .map((id) => automationTemplates.find((item) => item.id === id))
    .filter((item): item is AutomationTemplate => Boolean(item));
}
