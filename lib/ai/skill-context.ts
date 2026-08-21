import { getEmployeeSkills } from "@/lib/ai/employee-skills";


export async function buildEmployeeSkillContext(
  employeeId: string,
) {

  const skills =
    await getEmployeeSkills(employeeId);


  if (!skills.length) {
    return `
EMPLOYEE SKILLS

No special skills have been assigned.
`;
  }


  return `
EMPLOYEE SKILLS

The following skills have been assigned to this AI employee:

${skills
  .map(
    (skill) => `
Skill: ${skill.name}

Category:
${skill.category}

Description:
${skill.description || "No description"}

Instructions:
${skill.instructions || "No instructions"}

Tools:
${skill.tools || "No tools"}
`,
  )
  .join("\n")}
`;
}
