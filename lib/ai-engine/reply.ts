export function generateAIReply(
  employee: string,
  message: string,
) {

  const text =
    message.toLowerCase();


  if (employee === "Kuba Sales") {

    return `
Thank you for your interest.
I would be happy to help you understand our products, pricing, and available options.
How can I assist you today?
`;

  }


  if (employee === "Kuba Support") {

    return `
I understand you need assistance.
Let me help you resolve this issue.
Please provide more details so I can investigate.
`;

  }


  if (employee === "Kuba Appointment") {

    return `
I can help you schedule an appointment.
Please share your preferred date and time.
`;

  }


  return `
Thank you for contacting us.
How can I assist you today?
`;

}
