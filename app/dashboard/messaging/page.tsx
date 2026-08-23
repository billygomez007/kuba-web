"use client";

import { useEffect, useState } from "react";

type ConversationItem = {
  id: string;
  customerName?: string | null;
  integrationId?: string | null;
  status?: string;
  aiMode?: string;
  assignedEmployeeId?: string | null;
  customerId?: string | null;
};

type MessageItem = {
  id: string;
  content?: string;
  sender?: string;
  direction?: string;
  senderType?: string;
  createdAt?: string;
};

type EmployeeItem = {
  id: string;
  name?: string;
};

type CustomerProfile = {
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  leads?: Array<{ id: string }> | null;
  conversations?: unknown[] | null;
  followUps?: unknown[] | null;
};

type CustomerTag = {
  id: string;
  tag: string;
};

type LeadScore = {
  score: number;
  category: string;
} | null;

function ChannelIcon({ channel }: { channel?: string | null }) {
  const icons: Record<string, string> = {
    whatsapp: "🟢",
    facebook: "🔵",
    instagram: "🟣",
    telegram: "✈️",
    email: "✉️",
    sms: "📱",
  };

  return icons[channel ?? ""] || "🌐";
}

export default function MessagingPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState("");
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [customerTags, setCustomerTags] = useState<CustomerTag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [leadScore, setLeadScore] = useState<LeadScore>(null);

  useEffect(() => {
    const loadInbox = async () => {
      const inboxResponse = await fetch("/api/messages/inbox");
      const inboxData = (await inboxResponse.json()) as { conversations?: ConversationItem[] };
      setConversations(inboxData.conversations || []);
    };

    const loadEmployees = async () => {
      const employeesResponse = await fetch("/api/employees");
      const employeesData = (await employeesResponse.json()) as { employees?: EmployeeItem[] };
      setEmployees(employeesData.employees || []);
    };

    void loadInbox();
    void loadEmployees();
  }, []);

  async function openConversation(item: ConversationItem) {
    setSelected(item);

    const response = await fetch(`/api/messages/conversation?id=${item.id}`);
    const data = (await response.json()) as { messages?: MessageItem[] };
    setMessages(data.messages || []);

    if (item.customerId) {
      const profileResponse = await fetch(`/api/customers/profile?id=${item.customerId}`);
      const profileData = (await profileResponse.json()) as CustomerProfile;
      setCustomerProfile(profileData);

      const tagsResponse = await fetch(`/api/customers/tags?customerId=${item.customerId}`);
      const tagData = (await tagsResponse.json()) as { tags?: CustomerTag[] };
      setCustomerTags(tagData.tags || []);

      if (profileData.leads?.[0]) {
        const scoreResponse = await fetch(`/api/leads/score?id=${profileData.leads[0].id}`);
        const scoreData = (await scoreResponse.json()) as { score?: LeadScore };
        setLeadScore(scoreData.score ?? null);
      }
    }
  }

  async function addTag() {
    if (!selected?.customerId || !newTag) return;

    await fetch("/api/customers/tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: selected.customerId,
        tag: newTag,
      }),
    });

    setCustomerTags([
      ...customerTags,
      {
        id: crypto.randomUUID(),
        tag: newTag,
      },
    ]);

    setNewTag("");
  }



  async function generateSummary(){

    if(!selected) return;


    setLoadingSummary(true);


    const response =
      await fetch("/api/conversations/summary",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
        },
        body:JSON.stringify({
          conversationId:selected.id,
        }),
      });


    const data =
      await response.json();


    setSummary(
      data.summary || ""
    );


    setLoadingSummary(false);

  }



  async function sendMessage(){

    if(!selected || !text) return;


    await fetch("/api/messages/send",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        conversationId:selected.id,
        content:text,
      }),
    });


    setText("");


    const response =
      await fetch(
        `/api/messages/conversation?id=${selected.id}`
      );


    const data =
      await response.json();


    setMessages(
      data.messages || []
    );



  }


  async function assignEmployee(employeeId:string){

    if(!selected) return;


    await fetch("/api/conversations/assign",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        conversationId:selected.id,
        employeeId,
      }),
    });


    setSelected({
      ...selected,
      assignedEmployeeId:employeeId,
    });

  }







  async function updateStatus(status:string){

    if(!selected) return;


    await fetch("/api/conversations/status",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        conversationId:selected.id,
        status,
      }),
    });


    setSelected({
      ...selected,
      status,
    });

  }


  async function resumeAI(){

    if(!selected) return;


    await fetch("/api/conversations/resume",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        conversationId:selected.id,
      }),
    });


    setSelected({
      ...selected,
      aiMode:"active",
    });

  }


  async function takeoverConversation(){

    if(!selected) return;


    await fetch("/api/conversations/takeover",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        conversationId:selected.id,
      }),
    });


    setSelected({
      ...selected,
      assignedEmployeeId:null,
    });

  }


  return (

    <div className="flex h-[80vh] overflow-hidden rounded-3xl border border-white/10 bg-black">


      <div className="w-96 border-r border-white/10">

        <div className="p-6 border-b border-white/10">

          <h1 className="text-2xl font-black">
            Messaging
          </h1>

          <p className="text-sm text-white/40">
            Unified customer inbox
          </p>

        </div>


        <div className="p-4 space-y-3 border-b border-white/10">

          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none"
          />


          <select
            value={channelFilter}
            onChange={(e)=>setChannelFilter(e.target.value)}
            className="w-full rounded-xl bg-white/10 px-4 py-3"
          >

            <option value="all">
              All Channels
            </option>

            <option value="whatsapp">
              WhatsApp
            </option>

            <option value="facebook">
              Facebook
            </option>

            <option value="instagram">
              Instagram
            </option>

          </select>

        </div>



        {conversations
        .filter((item)=>
          item.customerName
            ?.toLowerCase()
            .includes(search.toLowerCase())
        )
        .filter((item)=>
          channelFilter === "all"
          ||
          item.integrationId === channelFilter
        )
        .map((item)=>(

          <button

            key={item.id}

            onClick={()=>
              openConversation(item)
            }

            className="w-full p-5 flex gap-4 border-b border-white/10 hover:bg-white/5 text-left"

          >

            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-xl">
              {ChannelIcon({
                channel:item.integrationId
              })}
            </div>


            <div className="flex-1">

              <div className="flex justify-between">

                <p className="font-bold">
                  {item.customerName || "Customer"}
                </p>

                <span className="text-xs text-white/30">
                  {item.status}
                </span>

              </div>


              <p className="mt-1 text-xs text-white/40">
                {ChannelIcon({
                  channel:item.integrationId
                })}
                {" "}
                {item.integrationId}
              </p>


              {item.assignedEmployeeId && (

                <p className="mt-2 text-xs text-cyan-300">
                  🧠 AI Employee Assigned
                </p>

              )}


            </div>


          </button>

        ))}

      </div>





      <div className="flex-1 flex flex-col">


        {selected ? (

          <>


          <div className="p-6 border-b border-white/10">

            <div className="flex justify-between items-start">

              <div>

                <h2 className="text-xl font-black">
                  {selected.customerName}
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  {ChannelIcon({
                    channel:selected.integrationId
                  })}
                  {" "}
                  {selected.integrationId}
                </p>

              </div>


              <div className="flex gap-2">

              <button
                onClick={takeoverConversation}
                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300"
              >
                Take Over
              </button>


              <button
                onClick={resumeAI}
                className="rounded-xl bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-300"
              >
                Resume AI
              </button>

              </div>


              <select
                value={selected.status || "open"}
                onChange={(e)=>
                  updateStatus(e.target.value)
                }
                className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm"
              >

                <option value="open">
                  🟢 Open
                </option>

                <option value="waiting">
                  ⏳ Waiting
                </option>

                <option value="resolved">
                  ✅ Resolved
                </option>

                <option value="escalated">
                  🔴 Escalated
                </option>

              </select>

            </div>


            <div className="mt-4">

              <p className="text-xs text-white/40">
                Assigned AI Employee
              </p>


              <select
                value={selected.assignedEmployeeId || ""}
                onChange={(e)=>
                  assignEmployee(e.target.value)
                }
                className="mt-2 rounded-xl bg-white/10 px-4 py-2"
              >

                <option value="">
                  Assign AI Employee
                </option>


                {employees.map((emp)=>(
                  <option
                    key={emp.id}
                    value={emp.id}
                  >
                    {emp.name}
                  </option>
                ))}

              </select>

            </div>


          </div>



          <div className="flex-1 overflow-y-auto p-6 space-y-4">


          {messages.map((msg)=>(

            <div
              key={msg.id}
              className={
                msg.direction === "outbound"
                ?
                "ml-auto max-w-md rounded-3xl bg-cyan-500 p-4 text-black"
                :
                "max-w-md rounded-3xl bg-white/10 p-4"
              }
            >

              <p className="text-xs font-bold opacity-70">

                {
                  msg.senderType === "customer" ||
                  msg.senderType === "user"
                    ? "👤 Customer"
                    : msg.senderType === "assistant" ||
                      msg.senderType === "ai"
                    ? "🧠 Kuba AI"
                    : msg.senderType === "human"
                    ? "👨 Human Staff"
                    : msg.senderType
                }

              </p>


              <p className="mt-2">
                {msg.content}
              </p>


              <p className="mt-2 text-[10px] opacity-50">
                {msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString()
                  : ""}
              </p>


            </div>

          ))}


          </div>



          <div className="p-5 border-t border-white/10 flex gap-3">

            <input
              value={text}
              onChange={(e)=>setText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-2xl bg-white/10 px-5 py-3 outline-none"
            />


            <button
              onClick={sendMessage}
              className="rounded-2xl bg-cyan-400 px-6 font-bold text-black"
            >
              Send
            </button>

          </div>


          </>

        ) : (

          <div className="flex-1 flex items-center justify-center text-white/40">
            Select a conversation
          </div>

        )}

      </div>


      {selected && (

        <div className="w-80 border-l border-white/10 p-6">

          <h3 className="text-lg font-black">
            Customer Profile
          </h3>


          {leadScore && (

            <div className="mt-4 rounded-2xl bg-white/10 p-4">

              <p className="text-xs text-white/40">
                Lead Score
              </p>


              <p className="mt-2 text-lg font-black">

                {
                  leadScore.category === "hot"
                  ? "🔥 HOT LEAD"
                  : leadScore.category === "warm"
                  ? "⭐ WARM LEAD"
                  : "❄ COLD LEAD"
                }

              </p>


              <p className="text-sm text-white/50">
                Score: {leadScore.score}/100
              </p>

            </div>

          )}


          <div className="mt-5">

            <p className="text-xs text-white/40">
              Tags
            </p>


            <div className="mt-3 flex flex-wrap gap-2">

              {customerTags.map((tag)=>(
                <span
                  key={tag.id}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs"
                >
                  {tag.tag}
                </span>
              ))}


              {customerTags.length === 0 && (
                <span className="text-xs text-white/30">
                  No tags
                </span>
              )}

            </div>


          </div>


          <div className="mt-4 flex gap-2">

            <input
              value={newTag}
              onChange={(e)=>setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none"
            />


            <button
              onClick={addTag}
              className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-bold text-black"
            >
              Add
            </button>

          </div>


          <button
            onClick={generateSummary}
            className="mt-4 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black"
          >
            {loadingSummary
              ? "Analyzing..."
              : "Generate AI Summary"}
          </button>


          {summary && (

            <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm whitespace-pre-wrap">

              <p className="mb-2 font-bold">
                🧠 Kuba Summary
              </p>

              {summary}

            </div>

          )}


          {customerProfile?.customer ? (

            <div className="mt-5 space-y-4 text-sm">

              <div>
                <p className="text-white/40">
                  Name
                </p>
                <p>
                  {customerProfile.customer.name || "Unknown"}
                </p>
              </div>


              <div>
                <p className="text-white/40">
                  Phone
                </p>
                <p>
                  {customerProfile.customer.phone || "N/A"}
                </p>
              </div>


              <div>
                <p className="text-white/40">
                  Email
                </p>
                <p>
                  {customerProfile.customer.email || "N/A"}
                </p>
              </div>


              <div className="pt-4 border-t border-white/10">

                <p>
                  Conversations:
                  {" "}
                  {customerProfile.conversations?.length || 0}
                </p>


                <p>
                  Leads:
                  {" "}
                  {customerProfile.leads?.length || 0}
                </p>


                <p>
                  Follow-ups:
                  {" "}
                  {customerProfile.followUps?.length || 0}
                </p>

              </div>

            </div>

          ) : (

            <p className="mt-5 text-sm text-white/40">
              No customer profile available.
            </p>

          )}

        </div>

      )}


    </div>

  );

}
