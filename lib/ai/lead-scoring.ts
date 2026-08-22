type LeadForScoring = {
  intent?: string | null;
  service?: string | null;
  notes?: string | null;
  budget?: string | number | null;
  phone?: string | null;
  email?: string | null;
};

export function calculateLeadScore(
  lead: LeadForScoring,
){

  let score = 0;


  const intent =
    (lead.intent || "")
      .toLowerCase();


  const service =
    (lead.service || "")
      .toLowerCase();


  const notes =
    (lead.notes || "")
      .toLowerCase();


  if(
    intent.includes("buy") ||
    intent.includes("interested") ||
    intent.includes("apply")
  ){
    score += 30;
  }


  if(service){
    score += 20;
  }


  if(
    notes.includes("urgent") ||
    notes.includes("asap") ||
    notes.includes("soon")
  ){
    score += 25;
  }


  if(lead.budget){
    score += 15;
  }


  if(
    lead.phone ||
    lead.email
  ){
    score += 10;
  }


  let category = "cold";


  if(score >= 80){
    category = "hot";
  }
  else if(score >= 50){
    category = "warm";
  }


  return {
    score,
    category,
  };

}
