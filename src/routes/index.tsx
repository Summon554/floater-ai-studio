import { createFileRoute } from "@tanstack/react-router";
import { FloaterStudio } from "@/components/FloaterStudio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Floater AI — Assistant, App Builder & Animation Studio" },
      { name: "description", content: "Free AI bro assistant that builds websites, web apps and motion videos with a live render engine." },
      { property: "og:title", content: "Floater AI — Assistant, App Builder & Animation Studio" },
      { property: "og:description", content: "Free AI bro assistant that builds websites, web apps and motion videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <FloaterStudio />,
});
