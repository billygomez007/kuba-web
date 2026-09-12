import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://superkuba.com"),
  title: "SuperKuba",
  description: "SuperKuba — an AI workforce platform for customer conversations, sales, appointments, tickets, and operations.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Your Business Powered by an AI Workforce",
    description:
      "Build, deploy and manage AI employees that work alongside your human team.",
    url: "https://superkuba.com",
    siteName: "SuperKuba",
    type: "website",
    images: [
      {
        url: "/brand/superkuba-og-image.png",
        width: 1200,
        height: 630,
        alt: "Your Business Powered by an AI Workforce",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your Business Powered by an AI Workforce",
    description:
      "Build, deploy and manage AI employees that work alongside your human team.",
    images: ["/brand/superkuba-og-image.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
