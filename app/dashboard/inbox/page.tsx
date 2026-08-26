"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = { id: string; name: string; type: string; status: string };
type Member = { userId: string; name: string; email: string };
type TimelineEvent = { id: string; title: string; description: string; createdAt: string };
type Conversation = {
	id: string;
	customerName: string;
	channel: string;
	lastMessage: string;
	lastMessageAt: string;
	assignedEmployee: Employee | null;
	assignedUser: Member | null;
	assignedUserId: string | null;
	status: string;
	routingStatus: string;
	priority: string;
	needsHuman: boolean;
	linkedTicket: { id: string; ticketReference: string; status: string; priority: string } | null;
	timeline: TimelineEvent[];
};
type Message = { id: string; content: string; direction: string; senderType: string; createdAt: string };
type Workspace = {
	conversations: Conversation[];
	members: Member[];
	metrics: { totalConversations: number; activeConversations: number; responseTimeMinutes: number | null; customerSatisfaction: number | null };
};

const channels: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", website: "Website chat", email: "Email" };

export default function InboxPage() {
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState("all");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	async function loadWorkspace() {
		try {
			const response = await fetch("/api/inbox/workspace", { cache: "no-store" });
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Unable to load inbox.");
			setWorkspace(data);
			setSelectedId((current) => {
				const requested = new URLSearchParams(window.location.search).get("conversation");
				const validRequested = data.conversations?.some((item: Conversation) => item.id === requested);
				return current || (validRequested ? requested : null) || data.conversations?.[0]?.id || null;
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to load inbox.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadWorkspace();
		}, 0);

		return () => window.clearTimeout(timer);
	}, []);

	const conversations = useMemo(() => (workspace?.conversations || []).filter((item) => {
		const query = search.trim().toLowerCase();
		const matchesSearch = !query || [item.customerName, item.lastMessage, item.channel].some((value) => value.toLowerCase().includes(query));
		return matchesSearch && (filter === "all" || (filter === "human" ? item.needsHuman : item.channel === filter));
	}), [workspace, search, filter]);

	const selected = workspace?.conversations.find((item) => item.id === selectedId) || null;

	useEffect(() => {
		if (!selected) {
			const timer = window.setTimeout(() => setMessages([]), 0);
			return () => window.clearTimeout(timer);
		}
		const selectedConversation = selected;
		let cancelled = false;
		async function loadMessages() {
			const response = await fetch(`/api/messages/conversation?id=${selectedConversation.id}`);
			const data = await response.json();
			if (!cancelled) setMessages(data.messages || []);
		}
		void loadMessages();
		return () => { cancelled = true; };
	}, [selected]);

	async function updateConversation(path: string, body: Record<string, string>) {
		if (!selected) return;
		const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selected.id, ...body }) });
		if (response.ok) await loadWorkspace();
	}

	async function createTicket() {
		if (!selected) return;
		const response = await fetch("/api/tickets/from-conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selected.id }) });
		const data = await response.json();
		if (!response.ok) setError(data.error || "Unable to create support ticket.");
		else await loadWorkspace();
	}

	return (
		<main className="min-h-screen bg-[#050507] px-4 py-6 text-white sm:px-6 lg:px-8">
			<div className="mx-auto max-w-[1700px]">
				<header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
					<div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Customer Operations</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Unified Inbox</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">Every customer conversation, handoff, and next action in one workspace.</p></div>
					<button type="button" onClick={() => void loadWorkspace()} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08]">Refresh</button>
				</header>
				{error && <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">{error}</div>}
				<section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Metric label="Total conversations" value={workspace?.metrics.totalConversations ?? "..."} /><Metric label="Active conversations" value={workspace?.metrics.activeConversations ?? "..."} /><Metric label="Average response" value={workspace?.metrics.responseTimeMinutes == null ? "Not tracked" : `${workspace.metrics.responseTimeMinutes} min`} /><Metric label="Customer satisfaction" value={workspace?.metrics.customerSatisfaction == null ? "Not tracked" : `${workspace.metrics.customerSatisfaction}%`} />
				</section>
				<section className="grid min-h-[680px] overflow-hidden rounded-3xl border border-white/10 bg-black/20 xl:grid-cols-[330px_minmax(0,1fr)_300px]">
					<aside className="border-b border-white/10 xl:border-b-0 xl:border-r"><div className="border-b border-white/10 p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers or messages..." className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /><select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#111116] px-3.5 py-2.5 text-sm text-white/70"><option value="all">All conversations</option><option value="human">Needs human attention</option>{Object.entries(channels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="max-h-[570px] overflow-y-auto">{loading ? <p className="p-6 text-sm text-white/35">Loading conversations...</p> : conversations.length === 0 ? <p className="p-6 text-sm text-white/35">No conversations match this view.</p> : conversations.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full border-b border-white/[0.06] p-4 text-left hover:bg-white/[0.05] ${selectedId === item.id ? "bg-cyan-300/[0.08]" : ""}`}><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[10px] font-bold text-cyan-300">{channels[item.channel] || "CHAT"}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-sm font-bold">{item.customerName}</p><span className="text-[10px] text-white/25">{formatTime(item.lastMessageAt)}</span></div><p className="mt-1 text-[11px] text-cyan-300/60">{channels[item.channel] || item.channel}</p><p className="mt-1 truncate text-xs text-white/40">{item.lastMessage}</p></div></div><div className="mt-3 flex justify-between"><span className="text-[10px] uppercase tracking-wider text-white/25">{item.assignedEmployee?.name || "Unassigned"}</span>{item.needsHuman && <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-bold uppercase text-amber-300">Human attention</span>}</div></button>)}</div></aside>
					<section className="flex min-w-0 flex-col border-b border-white/10 xl:border-b-0 xl:border-r">{selected ? <><div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row"><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-300/60">{channels[selected.channel] || selected.channel}</p><h2 className="mt-2 text-xl font-black">{selected.customerName}</h2><p className="mt-1 text-xs text-white/35">Priority: {selected.priority}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void updateConversation("/api/conversations/takeover", {})} className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300">Take over</button><button type="button" onClick={() => void updateConversation("/api/conversations/status", { status: "resolved" })} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">Mark resolved</button></div></div><div className="flex-1 space-y-4 overflow-y-auto p-5">{messages.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No messages recorded for this conversation.</p> : messages.map((message) => <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.direction === "outbound" ? "bg-cyan-400 text-black" : "border border-white/10 bg-white/[0.05] text-white/75"}`}><p className="text-[10px] font-bold uppercase opacity-60">{message.senderType}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p><p className="mt-2 text-[10px] opacity-50">{formatTime(message.createdAt)}</p></div></div>)}</div></> : <div className="flex flex-1 items-center justify-center p-8 text-sm text-white/35">Select a conversation to inspect its timeline.</div>}</section>
					<aside className="min-w-0 p-5">{selected ? <><h3 className="text-sm font-bold text-white/85">Conversation intelligence</h3><div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/35">Assigned AI employee</p><p className="mt-2 text-sm font-bold">{selected.assignedEmployee?.name || "Unassigned"}</p><p className="mt-1 text-xs text-white/35">{selected.routingStatus}</p></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/35">Assign human team member</p><select value={selected.assignedUserId || ""} onChange={(event) => event.target.value && void updateConversation("/api/conversations/assign-human", { userId: event.target.value })} className="mt-3 w-full rounded-lg border border-white/10 bg-[#111116] px-3 py-2 text-xs text-white/70"><option value="">Select member</option>{workspace?.members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></div><div className="mt-6"><h3 className="text-sm font-bold text-white/85">Customer timeline</h3><div className="mt-4 space-y-4">{selected.timeline.length === 0 ? <p className="text-xs leading-5 text-white/35">No lead, follow-up, or handoff events recorded.</p> : selected.timeline.slice(0, 8).map((event) => <div key={event.id} className="relative border-l border-cyan-300/20 pl-4"><span className="absolute -left-1.5 top-1 h-2.5 w-2.5 rounded-full bg-cyan-300" /><p className="text-xs font-bold text-white/70">{event.title}</p><p className="mt-1 text-xs leading-5 text-white/35">{event.description}</p><p className="mt-1 text-[10px] text-white/20">{formatTime(event.createdAt)}</p></div>)}</div></div></> : <p className="text-sm text-white/35">Customer details appear here.</p>}</aside>
				</section>
			</div>
		</main>
	);
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function formatTime(value: string | Date) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
