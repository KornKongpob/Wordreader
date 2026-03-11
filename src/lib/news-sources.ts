import type { NewsSection } from "@/types";

export interface NewsSourceDefinition {
  id: string;
  label: string;
  url: string;
  section: NewsSection;
  kind: "rss" | "ap-hub";
  priority: number;
  limit: number;
}

export const NEWS_SECTIONS: Array<{
  id: NewsSection;
  label: string;
  description: string;
}> = [
  {
    id: "general",
    label: "General",
    description: "Big stories and world updates that are easier to follow.",
  },
  {
    id: "business",
    label: "Business",
    description: "Markets, economy, and company moves worth knowing.",
  },
  {
    id: "tech",
    label: "Tech",
    description: "Products, platforms, AI, and internet culture.",
  },
  {
    id: "science",
    label: "Science",
    description: "Research, climate, health, and science reporting.",
  },
];

export const NEWS_SOURCE_DEFINITIONS: NewsSourceDefinition[] = [
  {
    id: "ap-top-news",
    label: "AP Top News",
    url: "https://apnews.com/hub/ap-top-news",
    section: "general",
    kind: "ap-hub",
    priority: 100,
    limit: 4,
  },
  {
    id: "bbc-world",
    label: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    section: "general",
    kind: "rss",
    priority: 90,
    limit: 5,
  },
  {
    id: "bbc-business",
    label: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    section: "business",
    kind: "rss",
    priority: 80,
    limit: 5,
  },
  {
    id: "bbc-technology",
    label: "BBC Technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    section: "tech",
    kind: "rss",
    priority: 70,
    limit: 5,
  },
  {
    id: "ars-technica",
    label: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    section: "tech",
    kind: "rss",
    priority: 65,
    limit: 5,
  },
  {
    id: "bbc-science",
    label: "BBC Science & Environment",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    section: "science",
    kind: "rss",
    priority: 60,
    limit: 5,
  },
];
