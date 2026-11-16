import { streamChatCompletion } from "@lovable.dev/ai-gateway";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const chatRequestSchema = z.object({
  systemPrompt: z.string().trim().min(1).max(18_000),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(16_000),
      }),
    )
    .min(1)
    .max(36),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) {
          return Response.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
        }
        if (!request.headers.get("content-type")?.includes("application/json")) {
          return Response.json({ error: "Send a JSON chat request." }, { status: 415 });
        }

        let parsedBody: unknown;
        try {
          parsedBody = await request.json();
        } catch {
          return Response.json({ error: "That chat request could not be read." }, { status: 400 });
        }
        const parsed = chatRequestSchema.safeParse(parsedBody);
        if (!parsed.success) {
          return Response.json({ error: "The chat request is too long or incomplete." }, { status: 400 });
        }

        try {
          const stream = await streamChatCompletion({
            model: "google/gemini-3.8-flash",
            messages: [
              { role: "system", content: parsed.data.systemPrompt },
              ...parsed.data.messages,
            ],
          });
          const response = stream.toResponse();
          const headers = new Headers(response.headers);
          headers.set("Cache-Control", "no-store");
          headers.set("X-Content-Type-Options", "nosniff");
          return new Response(response.body, { status: response.status, headers });
        } catch (error) {
          console.error("Floater chat request failed", error);
          return Response.json(
            { error: "Floater couldn’t finish that reply. Your message is still here—try again in a moment." },
            { status: 502 },
          );
        }
      },
    },
  },
});