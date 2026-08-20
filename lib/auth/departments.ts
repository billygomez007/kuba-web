export type BusinessDepartment =
  | "management"
  | "sales"
  | "customer_support"
  | "reception"
  | "finance"
  | "operations"
  | "marketing"
  | "human_resources"
  | "technology";

export const BUSINESS_DEPARTMENTS: BusinessDepartment[] = [
  "management",
  "sales",
  "customer_support",
  "reception",
  "finance",
  "operations",
  "marketing",
  "human_resources",
  "technology",
];

export const DEPARTMENT_LABELS: Record<
  BusinessDepartment,
  string
> = {
  management: "Management",
  sales: "Sales",
  customer_support: "Customer Support",
  reception: "Reception",
  finance: "Finance",
  operations: "Operations",
  marketing: "Marketing",
  human_resources: "Human Resources",
  technology: "Technology",
};

export const DEPARTMENT_DESCRIPTIONS: Record<
  BusinessDepartment,
  string
> = {
  management:
    "Leadership, administration and business oversight.",
  sales:
    "Lead generation, sales activities and revenue.",
  customer_support:
    "Customer assistance, service and issue resolution.",
  reception:
    "Inbound enquiries, appointments and front-desk communication.",
  finance:
    "Accounting, payments and financial operations.",
  operations:
    "Daily business operations and workflow management.",
  marketing:
    "Marketing, campaigns, communications and growth.",
  human_resources:
    "People management, recruitment and employee administration.",
  technology:
    "Technology, integrations, systems and technical operations.",
};

export function getBusinessDepartments() {
  return BUSINESS_DEPARTMENTS.map((department) => ({
    value: department,
    label: DEPARTMENT_LABELS[department],
    description:
      DEPARTMENT_DESCRIPTIONS[department],
  }));
}

export function getDepartmentLabel(
  department: string,
) {
  return (
    DEPARTMENT_LABELS[
      department as BusinessDepartment
    ] ?? department
  );
}
