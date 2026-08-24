export type ProductCategory = "AI Employee" | "Skill" | "Automation" | "Package";

export type MarketplaceProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  industry: string;
  provider: "SuperKuba Official" | "Third Party Developers";
  developerName: string;
  description: string;
  price: "Free" | "Subscription" | "Enterprise";
  rating: number;
  version: string;
  lastUpdated: string;
  support: string;
  features: string[];
  capabilities: string[];
  requiredIntegrations: string[];
  requiredPermissions: string[];
  demoHref: string;
  recommendation: string;
};

export const marketplaceProducts: MarketplaceProduct[] = [
  {
    id: "dental-receptionist-ai",
    name: "Dental Receptionist AI",
    category: "AI Employee",
    industry: "Dental Clinic",
    provider: "SuperKuba Official",
    developerName: "SuperKuba AI",
    description: "Handles patient enquiries, bookings, quick triage, and front-desk coverage for busy clinics.",
    price: "Subscription",
    rating: 4.9,
    version: "2.4.1",
    lastUpdated: "2026-08-02",
    support: "Included with AI Workforce Premium",
    features: ["Appointment intake", "24/7 front desk coverage", "Patient FAQ support"],
    capabilities: ["Lead qualification", "Insurance pre-checking", "Patient follow-up"],
    requiredIntegrations: ["WhatsApp", "Calendar"],
    requiredPermissions: ["workforce.view", "messaging.manage"],
    demoHref: "/dashboard/workforce/simulator",
    recommendation: "You receive many patient enquiries and appointment requests.",
  },
  {
    id: "lead-qualification-skill",
    name: "Lead Qualification Skill",
    category: "Skill",
    industry: "General Business",
    provider: "SuperKuba Official",
    developerName: "SuperKuba AI",
    description: "Scores leads, prioritizes opportunities, and surfaces the next best action based on business context.",
    price: "Free",
    rating: 4.7,
    version: "1.8.0",
    lastUpdated: "2026-08-05",
    support: "Included in standard AI operations",
    features: ["Priority scoring", "Opportunity tagging", "Recommendations"],
    capabilities: ["Lead routing", "Intent detection", "Workflow context"],
    requiredIntegrations: ["CRM"],
    requiredPermissions: ["workforce.view"],
    demoHref: "/dashboard/workforce/simulator",
    recommendation: "Your team handles many inbound opportunities and needs cleaner prioritization.",
  },
  {
    id: "dental-appointment-workflow",
    name: "Dental Appointment Workflow",
    category: "Automation",
    industry: "Dental Clinic",
    provider: "SuperKuba Official",
    developerName: "SuperKuba AI",
    description: "Automates patient booking, reminders, confirmations, and no-show follow-up across chat and SMS.",
    price: "Subscription",
    rating: 4.8,
    version: "3.0.2",
    lastUpdated: "2026-08-09",
    support: "Automation support included",
    features: ["Booking automation", "Reminder cadence", "No-show recovery"],
    capabilities: ["Calendar coordination", "Multi-step follow-ups", "Escalation handling"],
    requiredIntegrations: ["WhatsApp", "Calendar"],
    requiredPermissions: ["automations.manage", "messaging.manage"],
    demoHref: "/dashboard/automations",
    recommendation: "This clinic is active on chat and appointment-led sales.",
  },
  {
    id: "dental-clinic-ai-workforce",
    name: "Dental Clinic AI Workforce",
    category: "Package",
    industry: "Dental Clinic",
    provider: "SuperKuba Official",
    developerName: "SuperKuba AI",
    description: "A complete front-office workforce bundle with receptionist coverage, lead qualification, and patient automation.",
    price: "Enterprise",
    rating: 4.9,
    version: "5.1.0",
    lastUpdated: "2026-08-01",
    support: "White-glove onboarding and optimization",
    features: ["Receptionist AI", "Sales AI", "Appointment automation", "Patient follow-up"],
    capabilities: ["Bundle deployment", "Multi-agent coordination", "Lifecycle optimization"],
    requiredIntegrations: ["WhatsApp", "Calendar", "CRM"],
    requiredPermissions: ["workforce.manage", "automations.manage"],
    demoHref: "/dashboard/workforce/simulator",
    recommendation: "A dental clinic can improve front-desk throughput and patient conversion with this bundle.",
  },
  {
    id: "travel-consultant-ai",
    name: "Travel Consultant AI",
    category: "AI Employee",
    industry: "Travel Agency",
    provider: "Third Party Developers",
    developerName: "Northstar Labs",
    description: "Qualifies enquiries, suggests itineraries, and handles customer updates in a travel-first workflow.",
    price: "Subscription",
    rating: 4.6,
    version: "2.1.0",
    lastUpdated: "2026-07-30",
    support: "Developer support via partner portal",
    features: ["Travel enquiry qualification", "Proposal support", "Follow-up recommendations"],
    capabilities: ["Itinerary support", "Lead conversion", "Email updates"],
    requiredIntegrations: ["Email", "CRM"],
    requiredPermissions: ["workforce.view", "messaging.manage"],
    demoHref: "/dashboard/workforce/simulator",
    recommendation: "Your travel team likely converts high-intent enquiries and needs better routing.",
  },
  {
    id: "appointment-booking-skill",
    name: "Appointment Booking Skill",
    category: "Skill",
    industry: "Professional Services",
    provider: "Third Party Developers",
    developerName: "FlowPilot",
    description: "Automatically arranges availability, confirms slots, and keeps scheduling synchronized with business calendars.",
    price: "Subscription",
    rating: 4.5,
    version: "1.4.6",
    lastUpdated: "2026-08-07",
    support: "Partner technical support",
    features: ["Availability checking", "Booking confirmation", "Rescheduling prompts"],
    capabilities: ["Schedule coordination", "Automation triggers", "Availability matching"],
    requiredIntegrations: ["Calendar"],
    requiredPermissions: ["automations.manage"],
    demoHref: "/dashboard/automations",
    recommendation: "This skill suits appointment-heavy operations that need tighter scheduling flow.",
  },
  {
    id: "travel-lead-followup-workflow",
    name: "Travel Lead Follow-up Workflow",
    category: "Automation",
    industry: "Travel Agency",
    provider: "SuperKuba Official",
    developerName: "SuperKuba AI",
    description: "Moves warm travel leads through qualification, follow-up, and conversion queues without manual chasing.",
    price: "Subscription",
    rating: 4.7,
    version: "2.9.1",
    lastUpdated: "2026-08-06",
    support: "Included with marketing automation",
    features: ["Lead nurturing", "Follow-up scheduling", "Opportunity alerts"],
    capabilities: ["Priority routing", "Intent scoring", "Escalation"],
    requiredIntegrations: ["WhatsApp", "CRM"],
    requiredPermissions: ["automations.manage", "messaging.manage"],
    demoHref: "/dashboard/automations",
    recommendation: "A travel operation with many inbound consultation requests should use this workflow.",
  },
  {
    id: "real-estate-ai-workforce",
    name: "Real Estate Enquiry Workflow",
    category: "Package",
    industry: "Real Estate",
    provider: "Third Party Developers",
    developerName: "PropertyFlow",
    description: "Combines enquiry routing, lead qualification, and viewing coordination for a modern property sales team.",
    price: "Enterprise",
    rating: 4.8,
    version: "4.3.0",
    lastUpdated: "2026-08-03",
    support: "Implementation support from partner",
    features: ["Property enquiry handling", "Viewing scheduling", "Lead nurturing"],
    capabilities: ["Agent handoff", "Follow-up triggers", "Opportunity management"],
    requiredIntegrations: ["WhatsApp", "CRM"],
    requiredPermissions: ["workforce.manage", "customers.view"],
    demoHref: "/dashboard/workforce/simulator",
    recommendation: "This bundle is a match for property businesses with steady lead volume and multiple agents.",
  },
];

export function getMarketplaceProduct(id: string) {
  return marketplaceProducts.find((product) => product.id === id) ?? null;
}

export function getRecommendedProducts(industry: string, limit = 3) {
  const normalized = industry.trim().toLowerCase();
  return marketplaceProducts
    .filter((product) => product.industry.toLowerCase() === normalized || product.category === "Package")
    .slice(0, limit);
}
