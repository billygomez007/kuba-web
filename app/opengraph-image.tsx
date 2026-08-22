import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "SuperKuba - Your Business. Powered by an AI Workforce.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(
    join(process.cwd(), "public/brand/superkuba-logo.png"),
  );
  const logoData = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 78px",
          color: "#ffffff",
          background:
            "linear-gradient(135deg, #050507 0%, #0b1020 52%, #071a25 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src={logoData}
            alt="SuperKuba"
            width={390}
            height={139}
            style={{ objectFit: "contain", objectPosition: "left center" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 68,
              lineHeight: 1.02,
              fontWeight: 800,
              maxWidth: "950px",
            }}
          >
            <span>Your Business.</span>
            <span>Powered by an AI Workforce.</span>
          </div>
          <div style={{ fontSize: 26, color: "#b9c8d8" }}>
            AI Workforce | Customer Operations | Automation | Analytics
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 22, color: "#67e8f9", fontWeight: 700 }}>
          superkuba.com
        </div>
      </div>
    ),
    size,
  );
}