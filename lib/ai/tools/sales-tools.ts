import { eq, and, desc } from "drizzle-orm";

import { db } from "@/db";
import {
  leads,
  followUps,
  salesActivities,
} from "@/db/schema";


export async function createLeadTool({
  businessId,
  name,
  email,
  phone,
  service,
  source = "AI Sales",
  notes,
}: {
  businessId: string;
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  source?: string;
  notes?: string;
}) {

  const now = new Date();

  const id = crypto.randomUUID();

  await db.insert(leads).values({
    id,
    businessId,

    customerId: null,

    name: name || null,
    email: email || null,
    phone: phone || null,

    service: service || null,

    destination: null,
    intent: null,

    notes: notes || null,

    studyLevel: null,
    program: null,
    university: null,
    preferredIntake: null,
    budget: null,

    source,

    stage: "new",

    assignedEmployeeId: null,

    createdAt: now,
    updatedAt: now,
  });


  return {
    success: true,
    leadId: id,
    message: "Lead created successfully.",
  };
}



export async function updateLeadStageTool({
  businessId,
  leadId,
  stage,
}: {
  businessId:string;
  leadId:string;
  stage:string;
}) {

  const allowed = [
    "new",
    "qualified",
    "proposal",
    "won",
    "lost",
  ];


  if (!allowed.includes(stage)) {
    throw new Error(
      "Invalid sales stage."
    );
  }


  await db
    .update(leads)
    .set({
      stage,
      updatedAt:new Date(),
    })
    .where(
      and(
        eq(leads.id, leadId),
        eq(leads.businessId,businessId)
      )
    );


  return {
    success:true,
    message:`Lead moved to ${stage}.`
  };
}




export async function createFollowUpTool({
  businessId,
  leadId,
  title,
  description,
  dueAt,
}:{
  businessId:string;
  leadId:string;
  title:string;
  description?:string;
  dueAt:string;
}) {


 const id = crypto.randomUUID();


 await db.insert(followUps)
 .values({

    id,

    businessId,

    leadId,

    assignedEmployeeId:null,

    title,

    description:
      description || null,

    dueAt:new Date(dueAt),

    status:"pending",

    createdAt:new Date(),

    updatedAt:new Date(),

 });


 return {
    success:true,
    followUpId:id,
    message:"Follow-up created."
 };

}




export async function completeFollowUpTool({
 businessId,
 followUpId,
}:{
 businessId:string;
 followUpId:string;
}){


 await db
 .update(followUps)
 .set({
    status:"completed",
    updatedAt:new Date(),
 })
 .where(
    and(
      eq(
        followUps.id,
        followUpId
      ),
      eq(
        followUps.businessId,
        businessId
      )
    )
 );


 return {
   success:true,
   message:"Follow-up completed."
 };

}





export async function recordSalesActivityTool({
 businessId,
 leadId,
 type,
 title,
 description,
}:{
 businessId:string;
 leadId:string;
 type:string;
 title:string;
 description?:string;
}){


 const id = crypto.randomUUID();


 await db.insert(salesActivities)
 .values({

   id,

   businessId,

   leadId,

   employeeId:null,

   type,

   title,

   description:
      description || null,

   createdAt:new Date(),

 });


 return {
   success:true,
   activityId:id,
   message:"Sales activity recorded."
 };

}




export async function getLeadContextTool({
 businessId,
 leadId,
}:{
 businessId:string;
 leadId:string;
}){


 const lead = await db
 .select()
 .from(leads)
 .where(
   and(
    eq(leads.id,leadId),
    eq(leads.businessId,businessId)
   )
 )
 .limit(1);



 const history = await db
 .select()
 .from(salesActivities)
 .where(
   and(
    eq(
      salesActivities.leadId,
      leadId
    ),
    eq(
      salesActivities.businessId,
      businessId
    )
   )
 )
 .orderBy(
    desc(
      salesActivities.createdAt
    )
 );



 const followUpList = await db
 .select()
 .from(followUps)
 .where(
   and(
    eq(
      followUps.leadId,
      leadId
    ),
    eq(
      followUps.businessId,
      businessId
    )
   )
 );


 return {

    lead:lead[0] || null,

    activities:history,

    followUps:followUpList,

 };

}
