"use client";

type Props = {
  type: string;
  name: string;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
};

const avatars: Record<string, string> = {
  receptionist: "/avatars/receptionist.png",
  sales: "/avatars/sales.png",
  "customer-support": "/avatars/customer-support.png",
  accountant: "/avatars/accountant.png",
  finance: "/avatars/finance.png",
  marketing: "/avatars/marketing.png",
  hr: "/avatars/hr.png",
  operations: "/avatars/operations.png",
  appointment: "/avatars/appointment.png",
};

const sizes = {
  sm: "h-20 w-20",
  md: "h-28 w-28",
  lg: "h-36 w-36",
};

export default function AIEmployeeAvatar({
  type,
  name,
  size = "md",
  showStatus = true,
}: Props) {
  const avatar =
    avatars[type] || "/avatars/receptionist.png";

  return (
    <div className="relative kuba-avatar-float">

      <div className="kuba-avatar-glow absolute inset-0 rounded-full bg-cyan-400/25 blur-2xl" />

      <div className="relative overflow-hidden rounded-full border border-white/10 bg-white/[0.03] p-1 shadow-2xl">

        <img
          src={avatar}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover transition duration-300 hover:scale-105`}
        />

      </div>

      {showStatus && (
        <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[#050507] bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
      )}

    </div>
  );
}
