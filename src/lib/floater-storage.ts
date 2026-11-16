export type FloaterRole = "user" | "assistant";

export type FloaterMessage = {
  id: string;
  role: FloaterRole;
  content: string;
  created_at: string;
};

export type FloaterProject = {
  id: string;
  title: string;
  type: "web" | "motion";
  code: string;
  created_at: string;
  updated_at: string;
};

export const PROJECTS_KEY = "floater.projects.v1";
export const MESSAGES_KEY = "floater.messages.v1";
export const CONNECTORS_KEY = "floater.connectors.v1";
export const ENGINE_KEYS_KEY = "floater.engine-keys.v1";
export const DEV_SETTINGS_KEY = "floater.creator-settings.v1";
export const DEFAULT_SYSTEM_PROMPT =
  "You are Floater AI (floater.ai), an ultra-fast, all-around genius AI assistant, full-stack web developer, and motion graphics engineer bro. You speak natural, chill Taglish (a mix of Tagalog and English) and call the user 'bro'. You excel at building complete, responsive websites, web apps, interactive tools, and smooth HTML5/CSS3/Canvas motion videos. Always output complete, self-contained, single-file HTML/CSS/JS (with Tailwind CSS CDN and Google Fonts when building websites/apps) inside one clean code block so the Floater Render Engine can preview it immediately. Keep explanations direct, concise, and practical.";

export const STARTER_MESSAGE =
  "Yo bro! Ready na ang Floater AI, custom Render Engine, Connectors Hub, at Free Floater Cloud. Anong gagawin natin today—website, web app, o motion video?";

export function detectProjectType(code: string): FloaterProject["type"] {
  return /<canvas\b|requestAnimationFrame\s*\(|@keyframes\b|animation\s*:/i.test(code)
    ? "motion"
    : "web";
}

export function readStoredList<T>(raw: string | null): T[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function messageKey(projectId: string) {
  return `${MESSAGES_KEY}.${projectId}`;
}

export function cloudMapKey(userId: string) {
  return `floater.cloud-map.${userId}`;
}

export function normalizeThreadTitle(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 72) || "Untitled project";
}