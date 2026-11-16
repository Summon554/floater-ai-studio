import { createFileRoute } from "@tanstack/react-router";
import { FloaterStudio } from "@/components/FloaterStudio";

export const Route = createFileRoute("/$projectId")({
  head: () => ({
    meta: [
      { title: "Project — Floater AI Studio" },
      { name: "description", content: "Continue building your project in the Floater AI studio." },
      { property: "og:title", content: "Project — Floater AI Studio" },
      { property: "og:description", content: "Continue building your project in the Floater AI studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  return <FloaterStudio projectId={projectId} />;
}
