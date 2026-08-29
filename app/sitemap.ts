import type { MetadataRoute } from "next";

const BASE_URL = "https://superkuba.com";

const PUBLIC_ROUTES = [
  { path: "/", priority: 1 },
  { path: "/pricing", priority: 0.9 },
  { path: "/products", priority: 0.8 },
  { path: "/solutions", priority: 0.8 },
  { path: "/industries", priority: 0.8 },
  { path: "/ai-employees", priority: 0.7 },
  { path: "/resources", priority: 0.6 },
  { path: "/developers", priority: 0.4 },
  { path: "/partner", priority: 0.4 },
  { path: "/signup", priority: 0.7 },
  { path: "/login", priority: 0.3 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
  { path: "/security", priority: 0.2 },
  { path: "/demo", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    priority,
  }));
}
