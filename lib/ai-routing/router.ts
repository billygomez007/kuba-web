export type RoutingResult = {
  employee:
    | "Kuba Sales"
    | "Kuba Support"
    | "Kuba Appointment"
    | "Kuba Receptionist";

  reason: string;
};


export function routeConversation(
  message: string,
): RoutingResult {

  const text =
    message.toLowerCase();


  if (
    text.includes("buy") ||
    text.includes("price") ||
    text.includes("cost") ||
    text.includes("purchase") ||
    text.includes("product")
  ) {

    return {
      employee: "Kuba Sales",
      reason: "Sales intent detected",
    };

  }


  if (
    text.includes("help") ||
    text.includes("problem") ||
    text.includes("issue") ||
    text.includes("error")
  ) {

    return {
      employee: "Kuba Support",
      reason: "Support request detected",
    };

  }


  if (
    text.includes("book") ||
    text.includes("appointment") ||
    text.includes("schedule")
  ) {

    return {
      employee: "Kuba Appointment",
      reason: "Appointment request detected",
    };

  }


  return {
    employee: "Kuba Receptionist",
    reason: "General inquiry",
  };

}
