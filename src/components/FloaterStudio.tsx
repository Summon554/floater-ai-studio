import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContainer,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
} from "@/components/ai-elements/code-block";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STARTER_MESSAGE,
  DEFAULT_SYSTEM_PROMPT,
  DEV_SETTINGS_KEY,
  ENGINE_KEYS_KEY,
  PROJECTS_KEY,
  CONNECTORS_KEY,
  cloudMapKey,
  detectProjectType,
  messageKey,
  normalizeThreadTitle,
  readStoredList,
  type FloaterMessage,
  type FloaterProject,
} from "@/lib/floater-storage";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlignJustify,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  CircleAlert,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileCode2,
  Github,
  Globe2,
  KeyRound,
  LockKeyhole,
  Maximize2,
  Menu,
  MessageSquareText,
  Monitor,
  MoreHorizontal,
  Orbit,
  Pause,
  Play,
  PlugZap,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  UserRound,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import floaterMark from "@/assets/floater-mark.png";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";

type CloudProject = FloaterProject & { user_id: string };
type ActiveModel = "floater-gemini" | "google-gemini" | "groq-llama" | "groq-qwen" | "openrouter-qwen" | "openrouter-deepseek";
type StudioTab = "preview" | "motion" | "code";
type IntegrationFields = {
  githubToken: string;
  githubUser: string;
  githubName: string;
  repo: string;
  vercelToken: string;
  vercelHook: string;
  supabaseUrl: string;
  supabaseKey: string;
  webhookUrl: string;
  webhookName: string;
};
type EngineFields = { google: string; groq: string; openrouter: string };
type DevFields = { pin: string; systemPrompt: string; injection: string; developer: string; temperature: string; maxTokens: string };

const DEFAULT_CONNECTORS: IntegrationFields = {
  githubToken: "", githubUser: "", githubName: "", repo: "",
  vercelToken: "", vercelHook: "", supabaseUrl: "", supabaseKey: "", webhookUrl: "", webhookName: "",
};
const DEFAULT_ENGINES: EngineFields = { google: "", groq: "", openrouter: "" };
const DEFAULT_DEV: DevFields = {
  pin: "2026", systemPrompt: DEFAULT_SYSTEM_PROMPT, injection: "", developer: "Winzel • Creator & Super Admin", temperature: "1", maxTokens: "4096",
};
const starterCode = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Made with Floater AI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: 'DM Sans', sans-serif; background: #f2f8f8; color: #12333b; }
  </style>
</head>
<body>
  <main class="min-h-screen grid place-items-center px-6 py-16">
    <section class="max-w-xl text-center">
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-teal-700">YOUR IDEAS, IN MOTION</p>
      <h1 class="mt-6 text-5xl font-semibold leading-tight md:text-6xl">Something good<br />starts here.</h1>
      <p class="mt-5 text-lg text-slate-600">Tell Floater what you want to make, bro. Your live preview will show up right here.</p>
      <button class="mt-9 rounded-full bg-teal-700 px-7 py-3 font-semibold text-white" onclick="this.textContent = 'Let’s make it happen ✨'">Let’s build something</button>
    </section>
  </main>
</body>
</html>`;

function uuid() {
  return crypto.randomUUID();
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return value === null ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

function initialProject(id: string): FloaterProject {
  const now = new Date().toISOString();
  return { id, title: "Untitled project", type: "web", code: starterCode, created_at: now, updated_at: now };
}

function assistantHello(): FloaterMessage {
  return { id: "floater-welcome", role: "assistant", content: STARTER_MESSAGE, created_at: "" };
}

function storedProject(value: CloudProject | FloaterProject): FloaterProject {
  return { id: value.id, title: value.title, type: value.type, code: value.code, created_at: value.created_at, updated_at: value.updated_at };
}

function getHtmlFromAnswer(answer: string) {
  const match = answer.match(/```(?:html|HTML)?\s*\n([\s\S]*?)```/);
  if (!match?.[1]) return null;
  const code = match[1].trim();
  return /<(?:!doctype|html|body|main|div)\b/i.test(code) ? code : null;
}

function describeHttpFailure(status: number) {
  if (status === 401 || status === 403) return "That API key could not be verified. Check it in AI Engine / API Keys.";
  if (status === 429) return "That model is busy or its free request limit was reached. Try again later.";
  if (status >= 500) return "That AI engine is having a moment. Your message is safe—try again shortly.";
  return "The AI engine couldn’t accept that request. Check your model settings and try again.";
}

function parseModels(value: unknown): { id: string; full_name?: string; name?: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is { id: string; full_name?: string; name?: string } =>
    typeof row === "object" && row !== null && "id" in row && typeof row.id === "string",
  );
}

const googleGMark = (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px] shrink-0">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
  </svg>
);

type FloaterStudioProps = { projectId?: string };

export function FloaterStudio({ projectId: routeProjectId }: FloaterStudioProps) {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(routeProjectId ?? "");
  const [projects, setProjects] = useState<FloaterProject[]>([]);
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [messages, setMessages] = useState<FloaterMessage[]>([]);
  const [currentProject, setCurrentProject] = useState<FloaterProject | null>(null);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModal, setAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [busy, setBusy] = useState<"auth" | "chat" | "repo" | "video" | null>(null);
  const [replyError, setReplyError] = useState("");
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ActiveModel>("floater-gemini");
  const [mode, setMode] = useState<"chat" | "studio">("chat");
  const [studioTab, setStudioTab] = useState<StudioTab>("preview");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [aspect, setAspect] = useState<"landscape" | "vertical">("landscape");
  const [playMotion, setPlayMotion] = useState(true);
  const [studioError, setStudioError] = useState("");
  const [engineStatus, setEngineStatus] = useState<"Live" | "Thinking" | "Paused">("Live");
  const [fps, setFps] = useState(60);
  const [motionSeconds, setMotionSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatMode, setChatMode] = useState<"split" | "chat" | "studio">("split");
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [enginesOpen, setEnginesOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [devEnabled, setDevEnabled] = useState(false);
  const [connectors, setConnectors] = useState<IntegrationFields>(DEFAULT_CONNECTORS);
  const [engines, setEngines] = useState<EngineFields>(DEFAULT_ENGINES);
  const [developerSettings, setDeveloperSettings] = useState<DevFields>(DEFAULT_DEV);
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [connectorsTab, setConnectorsTab] = useState("github");
  const [githubRepos, setGithubRepos] = useState<{ id: number; name: string; full_name: string; private: boolean }[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [engineMessage, setEngineMessage] = useState("");
  const [runtimeLogs, setRuntimeLogs] = useState<{ time: string; line: string }[]>([]);
  const [responseMs, setResponseMs] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leftMode, setLeftMode] = useState<"cloud" | "sessions">("cloud");
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const projectsRef = useRef<FloaterProject[]>([]);
  const runRef = useRef("");
  const recordingRef = useRef<MediaRecorder | null>(null);
  const responseStartRef = useRef(0);
  const ensuredRouteRef = useRef("");

  const previewCode = currentProject?.code ?? starterCode;
  const detectedType = currentProject?.type ?? "web";
  const selectedIsAnimation = detectedType === "motion";
  const connectorCount = [Boolean(connectors.githubToken), Boolean(connectors.vercelToken || connectors.vercelHook), Boolean(connectors.supabaseUrl && connectors.supabaseKey), Boolean(connectors.webhookUrl)].filter(Boolean).length;
  const providerHasKey = model === "google-gemini" ? Boolean(engines.google.trim()) : model.startsWith("groq-") ? Boolean(engines.groq.trim()) : model.startsWith("openrouter-") ? Boolean(engines.openrouter.trim()) : true;
  const visibleProjects = useMemo(() => {
    const map = new Map<string, FloaterProject>();
    for (const item of [...projects, ...cloudProjects]) map.set(item.id, item);
    return [...map.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [projects, cloudProjects]);

  const writeLocalProjects = useCallback((next: FloaterProject[]) => {
    projectsRef.current = next;
    setProjects(next);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
  }, []);

  const persistLocalMessages = useCallback((id: string, next: FloaterMessage[]) => {
    localStorage.setItem(messageKey(id), JSON.stringify(next));
  }, []);

  const selectProject = useCallback((id: string) => {
    void navigate({ to: "/$projectId", params: { projectId: id } });
  }, [navigate]);

  const ensureLocalProject = useCallback((id: string, items = projectsRef.current) => {
    const found = items.find((project) => project.id === id);
    if (found) return { project: found, items };
    const project = initialProject(id);
    const next = [project, ...items];
    writeLocalProjects(next);
    localStorage.setItem(messageKey(id), JSON.stringify([assistantHello()]));
    return { project, items: next };
  }, [writeLocalProjects]);

  const syncProject = useCallback(async (project: FloaterProject) => {
    if (!cloudUser) return;
    setSaving(true);
    const { error } = await supabase.from("projects").upsert({
      id: project.id,
      user_id: cloudUser.id,
      title: project.title,
      type: project.type,
      code: project.code,
      created_at: project.created_at,
      updated_at: project.updated_at,
    }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      setCloudError("Cloud sync didn’t finish. Your project is still saved in this browser.");
      return false;
    }
    setCloudError("");
    setCloudProjects((existing) => [storedProject(project) as CloudProject & { user_id: string }, ...existing.filter((item) => item.id !== project.id)]);
    return true;
  }, [cloudUser]);

  const syncMessages = useCallback(async (projectIdValue: string, rows: FloaterMessage[]) => {
    if (!cloudUser) return;
    const { error } = await supabase.from("chat_messages").upsert(rows.filter((row) => row.id !== "floater-welcome").map((row) => ({
      id: row.id,
      project_id: projectIdValue,
      user_id: cloudUser.id,
      role: row.role,
      content: row.content,
      created_at: row.created_at || new Date().toISOString(),
    })), { onConflict: "id" });
    if (error) setCloudError("Your messages are saved here. Cloud sync couldn’t finish; try again once your connection is back.");
    else setCloudError("");
  }, [cloudUser]);

  useEffect(() => {
    const savedProjects = readStoredList<FloaterProject>(localStorage.getItem(PROJECTS_KEY));
    projectsRef.current = savedProjects;
    setProjects(savedProjects);
    setConnectors(safeRead(CONNECTORS_KEY, DEFAULT_CONNECTORS));
    setEngines(safeRead(ENGINE_KEYS_KEY, DEFAULT_ENGINES));
    setDeveloperSettings({ ...DEFAULT_DEV, ...safeRead<Partial<DevFields>>(DEV_SETTINGS_KEY, {}) });
    setModel((localStorage.getItem("floater.model.v1") as ActiveModel | null) ?? "floater-gemini");
    setDevEnabled(localStorage.getItem("floater.dev.enabled") === "true");
    let ignore = false;
    const syncAuthUser = async (user: User | null) => {
      if (ignore) return;
      setCloudUser(user);
      setAuthLoading(false);
      if (!user) {
        setCloudProjects([]);
        return;
      }
      const name = user.user_metadata?.["display_name"] ?? user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "Floater creator";
      void supabase.from("profiles").upsert({ id: user.id, display_name: name }, { onConflict: "id" });
      const { data, error } = await supabase.from("projects").select("id,title,type,code,created_at,updated_at,user_id").order("updated_at", { ascending: false }).limit(100);
      if (ignore) return;
      if (error) setCloudError("Cloud projects are temporarily unavailable. Your browser projects still work.");
      else setCloudProjects((data ?? []) as CloudProject[]);
      const local = projectsRef.current;
      for (const guestProject of local) {
        if (ignore) return;
        const { error: projectError } = await supabase.from("projects").upsert({
          id: guestProject.id, user_id: user.id, title: guestProject.title, type: guestProject.type,
          code: guestProject.code, created_at: guestProject.created_at, updated_at: guestProject.updated_at,
        }, { onConflict: "id" });
        if (projectError) continue;
        const guestMessages = readStoredList<FloaterMessage>(localStorage.getItem(messageKey(guestProject.id)));
        const { error: messageError } = await supabase.from("chat_messages").upsert(guestMessages.filter((msg) => msg.id !== "floater-welcome").map((msg) => ({
          id: msg.id, project_id: guestProject.id, user_id: user.id, role: msg.role, content: msg.content,
          created_at: msg.created_at || new Date().toISOString(),
        })), { onConflict: "id" });
        if (messageError) setCloudError("Some project history is still on this browser. We’ll keep it safe while cloud sync catches up.");
      }
    };
    void supabase.auth.getUser().then(({ data }) => syncAuthUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void syncAuthUser(session?.user ?? null);
      }
    });
    return () => { ignore = true; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (routeProjectId) {
      setProjectId(routeProjectId);
      return;
    }
    if (ensuredRouteRef.current) return;
    ensuredRouteRef.current = "creating";
    const id = uuid();
    ensureLocalProject(id);
    setProjectId(id);
    void navigate({ to: "/$projectId", params: { projectId: id }, replace: true });
  }, [routeProjectId, navigate, ensureLocalProject]);

  useEffect(() => {
    if (!routeProjectId || authLoading) return;
    let ignore = false;
    const local = projectsRef.current.find((item) => item.id === routeProjectId);
    if (local) {
      setCurrentProject(local);
      const localMessages = readStoredList<FloaterMessage>(localStorage.getItem(messageKey(routeProjectId)));
      setMessages(localMessages.length ? localMessages : [assistantHello()]);
      if (cloudUser) void syncProject(local);
      return () => { ignore = true; };
    }
    if (!cloudUser) {
      const created = ensureLocalProject(routeProjectId);
      setCurrentProject(created.project);
      setMessages([assistantHello()]);
      return () => { ignore = true; };
    }
    void supabase.from("projects").select("id,title,type,code,created_at,updated_at,user_id").eq("id", routeProjectId).maybeSingle().then(async ({ data, error }) => {
      if (ignore) return;
      if (data) {
        const project = storedProject(data as CloudProject);
        setCurrentProject(project);
        setCloudProjects((existing) => [data as CloudProject, ...existing.filter((row) => row.id !== routeProjectId)]);
        const { data: cloudMessages, error: messagesError } = await supabase.from("chat_messages").select("id,role,content,created_at").eq("project_id", routeProjectId).order("created_at", { ascending: true }).limit(150);
        if (ignore) return;
        if (messagesError) {
          setCloudError("Couldn’t load this conversation yet. Try again shortly.");
          setMessages([assistantHello()]);
        } else {
          const restored = (cloudMessages ?? []) as FloaterMessage[];
          const messagesWithWelcome = restored.length ? restored : [assistantHello()];
          setMessages(messagesWithWelcome);
          persistLocalMessages(routeProjectId, messagesWithWelcome);
        }
      } else if (!error) {
        const created = ensureLocalProject(routeProjectId);
        setCurrentProject(created.project);
        setMessages([assistantHello()]);
        await syncProject(created.project);
      } else {
        setCloudError("This project isn’t available yet. Try reloading the page.");
        setCurrentProject(null);
      }
    });
    return () => { ignore = true; };
  }, [routeProjectId, cloudUser, authLoading, ensureLocalProject, syncProject, persistLocalMessages]);

  useEffect(() => {
    if (!currentProject) return;
    projectsRef.current = projectsRef.current.map((item) => item.id === currentProject.id ? currentProject : item);
    setProjects((existing) => existing.map((item) => item.id === currentProject.id ? currentProject : item));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectsRef.current));
    const timer = window.setTimeout(() => {
      if (cloudUser) void syncProject(currentProject);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [currentProject, cloudUser, syncProject]);

  useEffect(() => {
    if (!previewRef.current || !previewCode) return;
    const injected = `<script>window.onerror=function(message,source,line,column){parent.postMessage({type:'floater-preview-error',message:String(message),line,column},'*')};window.onunhandledrejection=function(e){parent.postMessage({type:'floater-preview-error',message:String(e.reason),'line':0},'*')};<\/script>`;
    const doc = /<\/head\s*>/i.test(previewCode)
      ? previewCode.replace(/<\/head\s*>/i, `${injected}</head>`)
      : `${injected}${previewCode}`;
    previewRef.current.srcdoc = doc;
    setStudioError("");
  }, [previewCode, studioTab]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!previewRef.current || event.source !== previewRef.current.contentWindow) return;
      if (typeof event.data === "object" && event.data !== null && "type" in event.data && event.data.type === "floater-preview-error") {
        const payload = event.data as { message?: unknown; line?: unknown };
        const message = `${String(payload.message ?? "The preview hit a runtime error")}${typeof payload.line === "number" && payload.line > 0 ? ` · line ${payload.line}` : ""}`;
        setStudioError(message);
        setEngineStatus("Paused");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!selectedIsAnimation || !playMotion) return;
    const timer = window.setInterval(() => setMotionSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [selectedIsAnimation, playMotion]);

  useEffect(() => {
    if (!cloudUser || !currentProject) return;
    if (messages.length === 0) return;
    const timeout = window.setTimeout(() => { void syncMessages(currentProject.id, messages); }, 700);
    return () => window.clearTimeout(timeout);
  }, [messages, cloudUser, currentProject, syncMessages]);

  useEffect(() => {
    if (studioTab === "code") editorRef.current?.focus();
  }, [studioTab]);

  const updateProject = (changes: Partial<FloaterProject>) => {
    setCurrentProject((existing) => {
      if (!existing) return existing;
      const next = { ...existing, ...changes, updated_at: new Date().toISOString() };
      projectsRef.current = projectsRef.current.map((item) => item.id === next.id ? next : item);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectsRef.current));
      return next;
    });
  };

  const patchMessages = (id: string, next: FloaterMessage[]) => {
    setMessages(next);
    persistLocalMessages(id, next);
  };

  const parseStream = async (response: Response, modelValue: ActiveModel, onToken: (token: string) => void) => {
    if (!response.ok) throw new Error(describeHttpFailure(response.status));
    if (!response.body) throw new Error("The assistant reply didn’t arrive. Please try again.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedText = false;
    const takeEvent = (payload: string) => {
      if (!payload || payload === "[DONE]") return;
      let parsed: unknown;
      try { parsed = JSON.parse(payload); } catch { return; }
      if (typeof parsed !== "object" || parsed === null) return;
      if ("choices" in parsed && Array.isArray(parsed.choices)) {
        const choice = parsed.choices[0];
        if (typeof choice === "object" && choice !== null && "delta" in choice && typeof choice.delta === "object" && choice.delta !== null && "content" in choice.delta && typeof choice.delta.content === "string") {
          receivedText = true;
          onToken(choice.delta.content);
        }
        return;
      }
      if ("candidates" in parsed && Array.isArray(parsed.candidates)) {
        const candidate = parsed.candidates[0];
        if (typeof candidate === "object" && candidate !== null && "content" in candidate && typeof candidate.content === "object" && candidate.content !== null && "parts" in candidate.content && Array.isArray(candidate.content.parts)) {
          for (const part of candidate.content.parts) if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") {
            receivedText = true;
            onToken(part.text);
          }
        }
        return;
      }
      if ("error" in parsed) throw new Error("The assistant couldn’t finish that reply. Your message is safe—try again shortly.");
    };
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        takeEvent(line.slice(5).trim());
      }
      if (done) break;
    }
    if (!receivedText) throw new Error("The assistant returned an empty reply. Your message is still here—try again.");
    void modelValue;
  };

  const handleSubmit = async (prompt: PromptInputMessage) => {
    const text = prompt.text.trim();
    if (!text || busy === "chat" || !projectId) return;
    const project = currentProject ?? initialProject(projectId);
    if (!currentProject) setCurrentProject(project);
    const now = new Date().toISOString();
    const requestId = uuid();
    const userMessage: FloaterMessage = { id: uuid(), role: "user", content: text, created_at: now };
    const assistantMessage: FloaterMessage = { id: requestId, role: "assistant", content: "", created_at: new Date(Date.now() + 1).toISOString() };
    const visible = messages.filter((row) => row.id !== "floater-welcome");
    const next = [...visible, userMessage, assistantMessage];
    patchMessages(projectId, next);
    setInput("");
    setReplyError("");
    setEngineStatus("Thinking");
    setBusy("chat");
    responseStartRef.current = performance.now();
    const history = [...visible, userMessage].slice(-30).map(({ role, content }) => ({ role, content }));
    const systemPrompt = `${developerSettings.systemPrompt || DEFAULT_SYSTEM_PROMPT}\n\n${developerSettings.injection}`.trim();
    const onToken = (token: string) => {
      if (runRef.current !== requestId) return;
      const updated = next.map((row) => row.id === requestId ? { ...row, content: row.content + token } : row);
      patchMessages(projectId, updated);
      if (!/Untitled project/i.test(project.title)) return;
      const title = normalizeThreadTitle(text);
      const nextProject = { ...project, title, updated_at: new Date().toISOString() };
      setCurrentProject(nextProject);
      void syncProject(nextProject);
    };
    runRef.current = requestId;
    try {
      const body = JSON.stringify({ systemPrompt, messages: history });
      let response: Response;
      if (model === "floater-gemini") {
        response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      } else if (model === "google-gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(engines.google.trim())}`;
        response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents: history.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })) }) });
      } else if (model.startsWith("groq-")) {
        const modelId = model === "groq-qwen" ? "qwen-2.5-coder-32b" : "llama-3.3-70b-versatile";
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${engines.groq.trim()}` },
          body: JSON.stringify({ model: modelId, stream: true, messages: [{ role: "system", content: systemPrompt }, ...history] }),
        });
      } else {
        const modelId = model === "openrouter-deepseek" ? "deepseek/deepseek-chat:free" : "qwen/qwen3-coder:free";
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${engines.openrouter.trim()}`, "HTTP-Referer": window.location.origin, "X-Title": "Floater AI" },
          body: JSON.stringify({ model: modelId, stream: true, messages: [{ role: "system", content: systemPrompt }, ...history] }),
        });
      }
      if (!response.ok) {
        const safeError = describeHttpFailure(response.status);
        throw new Error(safeError);
      }
      await parseStream(response, model, onToken);
      if (runRef.current !== requestId) return;
      const settled = next.map((row) => row.id === requestId ? { ...row, content: row.content.trim() } : row);
      patchMessages(projectId, settled);
      setResponseMs(Math.round(performance.now() - responseStartRef.current));
      const answer = settled.find((row) => row.id === requestId)?.content ?? "";
      const generatedCode = getHtmlFromAnswer(answer);
      if (generatedCode) {
        const type = detectProjectType(generatedCode);
        updateProject({ code: generatedCode, type });
        setStudioTab(type === "motion" ? "motion" : "preview");
        setMode("studio");
      }
    } catch (error) {
      if (runRef.current !== requestId) return;
      const message = error instanceof Error ? error.message : "Floater couldn’t finish that reply. Please try again.";
      setReplyError(message);
      setMessages((existing) => {
        const settled = existing.filter((row) => row.id !== requestId || row.content.length > 0);
        persistLocalMessages(projectId, settled);
        return settled;
      });
    } finally {
      if (runRef.current === requestId) {
        setBusy(null);
        setEngineStatus("Live");
      }
    }
  };

  const newProject = () => {
    const id = uuid();
    const project = initialProject(id);
    writeLocalProjects([project, ...projectsRef.current]);
    localStorage.setItem(messageKey(id), JSON.stringify([assistantHello()]));
    setCurrentProject(project);
    setMessages([assistantHello()]);
    setStudioError("");
    setReplyError("");
    void navigate({ to: "/$projectId", params: { projectId: id } });
    if (cloudUser) void syncProject(project);
  };

  const deleteProject = async (id: string) => {
    if (cloudUser) {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) { setCloudError("Couldn’t delete that cloud project. Please try again."); return; }
      setCloudProjects((existing) => existing.filter((row) => row.id !== id));
    }
    const next = projectsRef.current.filter((project) => project.id !== id);
    writeLocalProjects(next);
    localStorage.removeItem(messageKey(id));
    if (projectId === id) {
      if (next[0]) selectProject(next[0].id);
      else newProject();
    }
  };

  const saveRename = () => {
    const value = normalizeThreadTitle(renameValue);
    const project = visibleProjects.find((item) => item.id === renameId);
    if (project) {
      const renamed = { ...project, title: value, updated_at: new Date().toISOString() };
      const existing = projectsRef.current;
      writeLocalProjects(existing.some((row) => row.id === project.id)
        ? existing.map((row) => row.id === project.id ? renamed : row)
        : [renamed, ...existing]);
      setCloudProjects((items) => items.map((item) => item.id === renamed.id ? { ...renamed, user_id: item.user_id } : item));
      if (currentProject?.id === project.id) setCurrentProject(renamed);
      if (cloudUser) void syncProject(renamed);
    }
    setRenameId("");
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy === "auth") return;
    setBusy("auth");
    setAuthMessage("");
    try {
      if (authMode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { emailRedirectTo: window.location.origin, data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
        if (!data.session) setAuthMessage("Check your email to confirm your account, bro. Cloud sync starts after you confirm.");
        else setAuthModal(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        setAuthModal(false);
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Sign-in didn’t work. Check your details and try again.");
    } finally { setBusy(null); }
  };

  const socialSignIn = async (provider: "google" | "lovable") => {
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) setAuthMessage(result.error.message);
      else if (!result.redirected) setAuthModal(false);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Couldn’t start sign-in. Try again.");
    }
  };

  const handleSignOut = async () => {
    setCloudProjects([]);
    const { error } = await supabase.auth.signOut();
    if (error) setCloudError("Couldn’t sign out right now. Please try once more.");
  };

  const saveConnectorFields = (next: IntegrationFields) => {
    setConnectors(next);
    localStorage.setItem(CONNECTORS_KEY, JSON.stringify(next));
  };
  const saveEngineFields = (next: EngineFields) => {
    setEngines(next);
    localStorage.setItem(ENGINE_KEYS_KEY, JSON.stringify(next));
  };
  const updateDevField = <K extends keyof DevFields>(key: K, value: DevFields[K]) => {
    setDeveloperSettings((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleGithubConnect = async () => {
    const token = connectors.githubToken.trim();
    if (!token) { setEngineMessage("Add your GitHub token first."); return; }
    setBusy("repo"); setEngineMessage("");
    try {
      const response = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } });
      if (!response.ok) throw new Error(describeHttpFailure(response.status));
      const user = await response.json() as { login?: string; name?: string };
      const [reposResponse, profileResponse] = await Promise.all([
        fetch("https://api.github.com/user/repos?sort=updated&per_page=40&affiliation=owner", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } }),
        Promise.resolve(response),
      ]);
      void profileResponse;
      if (!reposResponse.ok) throw new Error(describeHttpFailure(reposResponse.status));
      const repos = parseModels(await reposResponse.json()).map((item, index) => {
        const raw = (awaitSafeIndex(item, index));
        return raw;
      });
      const nextFields = { ...connectors, githubUser: user.login ?? "", githubName: user.name ?? user.login ?? "" };
      saveConnectorFields(nextFields);
      setGithubRepos(repos as typeof githubRepos);
      setGithubConnected(true);
      setEngineMessage(`Connected to @${user.login ?? "GitHub"}, bro. Pick your repo.`);
    } catch (error) { setEngineMessage(error instanceof Error ? error.message : "GitHub didn’t connect."); }
    finally { setBusy(null); }
  };

  const handleCreateRepo = async () => {
    const name = connectors.repo.trim();
    if (!connectors.githubToken.trim() || !name || !/^[a-zA-Z0-9_.-]{1,100}$/.test(name)) { setEngineMessage("Enter a valid new repository name first."); return; }
    setBusy("repo");
    try {
      const response = await fetch("https://api.github.com/user/repos", { method: "POST", headers: { Accept: "application/vnd.github+json", "Content-Type": "application/json", Authorization: `Bearer ${connectors.githubToken.trim()}`, "X-GitHub-Api-Version": "2022-11-28" }, body: JSON.stringify({ name, private: true, auto_init: true }) });
      if (!response.ok) throw new Error(describeHttpFailure(response.status));
      const repo = await response.json() as { full_name?: string; name?: string; id?: number; private?: boolean };
      setGithubRepos((items) => [...items, { id: repo.id ?? Date.now(), full_name: repo.full_name ?? name, name: repo.name ?? name, private: repo.private ?? true }]);
      saveConnectorFields({ ...connectors, repo: repo.full_name ?? `${connectors.githubUser}/${name}` });
      setEngineMessage("Private repo created. You’re ready to push, bro.");
    } catch (error) { setEngineMessage(error instanceof Error ? error.message : "Couldn’t create the repository."); }
    finally { setBusy(null); }
  };

  const handlePushToGithub = async () => {
    const repo = connectors.repo.trim().includes("/") ? connectors.repo.trim() : `${connectors.githubUser}/${connectors.repo.trim()}`;
    if (!connectors.githubToken.trim() || !connectors.repo.trim() || !previewCode) { setEngineMessage("Connect GitHub and choose a repository to push your project."); setConnectorsOpen(true); return; }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) { setEngineMessage("Choose a valid owner/repository name first."); return; }
    setBusy("repo"); setEngineMessage("");
    try {
      const headers = { Accept: "application/vnd.github+json", "Content-Type": "application/json", Authorization: `Bearer ${connectors.githubToken.trim()}`, "X-GitHub-Api-Version": "2022-11-28" };
      for (const [path, content] of ([["index.html", previewCode], ["README.md", `# ${currentProject?.title ?? "Floater AI project"}\n\nBuilt with [Floater AI](https://floater.ai).\n`]] as [string, string][])) {
        const check = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
        let sha: string | undefined;
        if (check.ok) sha = ((await check.json()) as { sha?: string }).sha;
        else if (check.status !== 404) throw new Error(describeHttpFailure(check.status));
        const result = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { method: "PUT", headers, body: JSON.stringify({ message: `Update ${path} with Floater AI`, content: btoa(unescape(encodeURIComponent(content))), ...(sha ? { sha } : {}) }) });
        if (!result.ok) throw new Error(describeHttpFailure(result.status));
      }
      setEngineMessage(`Pushed index.html and README.md to ${repo}.`);
    } catch (error) { setEngineMessage(error instanceof Error ? error.message : "Couldn’t push to GitHub."); }
    finally { setBusy(null); }
  };

  const handleVercelDeploy = async () => {
    if (connectors.vercelHook.trim()) {
      try {
        const hook = new URL(connectors.vercelHook.trim());
        if (hook.protocol !== "https:") throw new Error("Deployment hooks must use a secure HTTPS address.");
        const response = await fetch(hook.href, { method: "POST" });
        if (!response.ok) throw new Error("The deployment hook didn’t accept the request.");
        setEngineMessage("Vercel deployment started, bro.");
      } catch (error) { setEngineMessage(error instanceof Error ? error.message : "Couldn’t start deployment."); }
      return;
    }
    setEngineMessage(connectors.vercelToken ? "Add a Vercel deployment hook to deploy a project in one click." : "Add a Vercel token or deployment hook first.");
  };

  const testWebhook = async () => {
    try {
      const url = new URL(connectors.webhookUrl.trim());
      if (url.protocol !== "https:") throw new Error("Webhook addresses must use secure HTTPS.");
      const response = await fetch(url.href, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "floater.ai", event: "test", message: "Yo bro! Your Floater webhook is connected." }) });
      if (!response.ok) throw new Error("The webhook didn’t accept the test message.");
      setEngineMessage("Webhook is connected and answered your test.");
    } catch (error) { setEngineMessage(error instanceof Error ? error.message : "Couldn’t test the webhook."); }
  };

  const addRuntimeLog = (line: string) => setRuntimeLogs((existing) => [...existing.slice(-29), { time: new Date().toLocaleTimeString(), line }]);

  const downloadHtml = () => {
    const blob = new Blob([previewCode], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${normalizeThreadTitle(currentProject?.title ?? "floater-project").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  const startRecording = async () => {
    if (recording) {
      recordingRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const clip = new Blob(chunks, { type: "video/webm" });
        const clipUrl = URL.createObjectURL(clip);
        const link = document.createElement("a"); link.href = clipUrl; link.download = `${currentProject?.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "floater-motion"}.webm`;
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(clipUrl); setRecording(false);
      };
      recordingRef.current = recorder;
      recorder.start(500);
      setRecording(true);
    } catch { setEngineMessage("Allow screen capture to record this animation."); }
  };

  const retryRequest = () => {
    const lastUser = [...messages].reverse().find((row) => row.role === "user");
    if (lastUser) void handleSubmit({ text: lastUser.content, files: [] });
  };

  const quickPrompts = ["Build a Website", "Create a Web App", "Build a Motion Video", "Push to GitHub"];

  return (
    <div className="floater-app min-h-svh bg-background text-foreground">
      <header className="floater-header">
        <div className="flex min-w-[180px] items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Toggle project sidebar" className="text-muted-foreground" onClick={() => setSidebarOpen((open) => !open)}><Menu /></Button>
          <button type="button" className="flex items-center gap-2.5 text-left" aria-label="Floater AI home" onClick={newProject}>
            <span className="floater-logo-wrap"><img src={floaterMark} alt="" aria-hidden="true" loading="lazy" width={816} height={816} className="floater-logo" /></span>
            <span className="block"><span className="block font-display text-[15px] font-semibold leading-tight">Floater AI</span><span className="domain-pill">floater.ai</span></span>
          </button>
          <span className="header-divider" />
          <span className="model-live"><span className="live-dot" />Gemini 3.8</span>
        </div>
        <nav className="header-actions" aria-label="Studio controls">
          <Button variant="outline" size="sm" className="header-action" onClick={() => { setEngineMessage(""); setConnectorsOpen(true); }}><PlugZap className="size-4" /><span>Connectors</span><span className="count-badge">{connectorCount}</span></Button>
          <Button variant="outline" size="sm" className="header-action" onClick={() => setEnginesOpen(true)}><KeyRound className="size-4" /><span className="hidden md:inline">AI Engine / API Keys</span><span className="md:hidden">AI Keys</span></Button>
          <Button variant="outline" size="sm" className="header-action dev-button" onClick={() => devEnabled ? setDevOpen(true) : setPinOpen(true)}>{devEnabled ? <ShieldCheck className="size-4 text-primary" /> : <Settings2 className="size-4" />}<span className="hidden lg:inline">{devEnabled ? "Super Admin / Dev" : "Dev Mode"}</span></Button>
          {devEnabled ? <span className="dev-badge"><ShieldCheck className="size-3" />SUPER ADMIN / DEV</span> : null}
          <Button variant="outline" size="sm" className="header-action new-chat-button" onClick={newProject}><Plus className="size-4" /><span>New Chat</span></Button>
          {cloudUser ? <Button variant="outline" size="sm" className="account-chip" onClick={() => void handleSignOut()} title={`Sign out ${cloudUser.email ?? ""}`}><span className="account-avatar">{(cloudUser.email?.[0] ?? "F").toUpperCase()}</span><span className="hidden xl:inline max-w-28 truncate">{cloudUser.user_metadata?.["display_name"] ?? cloudUser.email?.split("@")[0]}</span><span className="hidden md:inline">Sign out</span></Button> : <Button size="sm" className="sync-button" onClick={() => { setAuthMode("sign-in"); setAuthMessage(""); setAuthModal(true); }}><LockKeyhole className="size-4" /><span>Sign In to Sync Cloud</span></Button>}
        </nav>
      </header>

      <div className={`floater-shell ${sidebarOpen ? "with-sidebar" : "sidebar-hidden"} ${rightPanelOpen ? "with-studio" : "studio-hidden"}`}>
        {sidebarOpen ? <aside className="project-sidebar">
          <div className="flex items-center justify-between"><div><p className="eyebrow">WORKSPACE</p><h2 className="font-display text-sm font-semibold">Floater Cloud Projects</h2></div><Button size="icon" variant="ghost" aria-label="Close project sidebar" onClick={() => setSidebarOpen(false)}><AlignJustify className="size-4" /></Button></div>
          <Button className="new-project-button mt-5 w-full justify-start gap-2" variant="outline" onClick={newProject}><Plus className="size-4" />New Project</Button>
          <div className="sidebar-modes" role="tablist" aria-label="Project history">
            <button type="button" role="tab" aria-selected={leftMode === "cloud"} onClick={() => setLeftMode("cloud")}>Cloud Projects<span>{cloudProjects.length}</span></button>
            <button type="button" role="tab" aria-selected={leftMode === "sessions"} onClick={() => setLeftMode("sessions")}>Chat Sessions</button>
          </div>
          <div className="project-list" aria-live="polite">
            {!authLoading && !cloudUser ? <div className="guest-note"><span className="guest-indicator" /><span>Guest workspace <span className="text-muted-foreground">· saved in this browser</span></span></div> : null}
            {!authLoading && cloudUser ? <div className="guest-note"><span className="live-dot" /><span>Cloud sync active</span></div> : null}
            {visibleProjects.map((project) => (
              <div className={`project-row ${project.id === projectId ? "selected" : ""}`} key={project.id}>
                <Button variant="ghost" className="project-select min-w-0 flex-1 justify-start text-left" onClick={() => selectProject(project.id)} aria-label={`Open ${project.title}`}>
                  {project.type === "motion" ? <Play className="size-4 shrink-0" /> : <FileCode2 className="size-4 shrink-0" />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px]">{project.title}</span><span className="block text-[10px] text-muted-foreground">{new Date(project.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {project.type === "motion" ? "Motion" : "App"}</span></span>
                  {project.id === projectId ? <span className="project-current-dot" /> : null}
                </Button>
                <div className="project-actions"><Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={`Rename ${project.title}`} title="Rename" onClick={() => { setRenameId(project.id); setRenameValue(project.title); }}><MoreHorizontal className="size-4" /></Button><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label={`Delete ${project.title}`} title="Delete project" onClick={() => void deleteProject(project.id)}><Trash2 className="size-3.5" /></Button></div>
              </div>
            ))}
            {visibleProjects.length === 0 ? <p className="empty-sidebar">Your next idea starts here.</p> : null}
          </div>
          <div className="sidebar-footer"><div className="footer-profile"><span className="footer-avatar">{cloudUser ? (cloudUser.user_metadata?.["display_name"] ?? cloudUser.email)?.[0]?.toUpperCase() ?? "F" : "F"}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{cloudUser?.user_metadata?.["display_name"] ?? cloudUser?.email?.split("@")[0] ?? "Guest creator"}</p><p className="text-[10px] text-muted-foreground">{devEnabled ? developerSettings.developer : cloudUser ? "Synced with Floater Cloud" : "Browser-only workspace"}</p></div><Button size="icon" variant="ghost" aria-label="Workspace settings" onClick={() => setEnginesOpen(true)}><Settings2 className="size-4" /></Button></div><div className="engine-status"><span><Activity className="size-3.5" />{engineStatus === "Thinking" ? "Thinking" : "Engine online"}</span><span>{saving ? "Saving…" : cloudUser ? "Cloud" : "Local"}</span></div></div>
        </aside> : null}

        <main className={`studio-main ${chatMode === "chat" ? "chat-mode" : ""} ${chatMode === "studio" ? "studio-mode" : ""}`}>
          <div className="mode-tabs" role="tablist" aria-label="Workspace mode">
            <button type="button" className="mode-tab" aria-selected={chatMode === "chat"} onClick={() => { setChatMode("chat"); setMode("chat"); }}><MessageSquareText className="size-3.5" />Chat Mode</button>
            <button type="button" className="mode-tab" aria-selected={chatMode === "split"} onClick={() => setChatMode("split")}><ArrowLeftRight className="size-3.5" />Split Studio</button>
            <button type="button" className="mode-tab" aria-selected={chatMode === "studio"} onClick={() => { setChatMode("studio"); setMode("studio"); }}><Eye className="size-3.5" />Floater Studio</button>
            <span className="mode-spacer" />
            <span className="thread-title"><span className="thread-status" />{currentProject?.title ?? "New conversation"}</span>
          </div>

          <div className="main-split">
            {chatMode !== "studio" ? <section className={`chat-pane ${chatMode === "chat" ? "chat-pane-full" : ""}`} aria-label="Floater AI conversation">
              <div className="chat-toolbar"><div><p className="eyebrow">YOUR AI STUDIO PARTNER</p><h1 className="font-display text-base font-semibold">Floater AI <span className="assistant-badge"><Orbit className="size-3" />ACTIVE</span></h1></div><div className="flex items-center gap-1"><span className="live-dot" title="Assistant ready" />{cloudUser ? <span className="hidden text-[10px] text-muted-foreground sm:inline">Synced</span> : <span className="hidden text-[10px] text-muted-foreground sm:inline">Guest mode</span>}<Button size="icon" variant="ghost" aria-label="Open studio panel" title="Open studio panel" onClick={() => setRightPanelOpen((open) => !open)}><Maximize2 className="size-4" /></Button></div></div>
              {cloudError ? <div className="cloud-error"><CircleAlert className="size-3.5 shrink-0" />{cloudError}<button type="button" onClick={() => setCloudError("")} aria-label="Dismiss"><X className="size-3" /></button></div> : null}
              <Conversation className="transcript-scroll">
                <ConversationContent className="transcript-content">
                  {messages.map((message, index) => {
                    const extractedCode = message.role === "assistant" ? getHtmlFromAnswer(message.content) : null;
                    const explainText = extractedCode ? message.content.replace(/```(?:html|HTML)?\s*\n[\s\S]*?```/, "").trim() : message.content;
                    return <Message from={message.role} key={message.id} className={message.role === "assistant" ? "floater-assistant-message" : "floater-user-message"}>
                      {message.role === "assistant" ? <div className="assistant-avatar"><img src={floaterMark} alt="" aria-hidden="true" loading="lazy" width={816} height={816} /></div> : null}
                      <div className="message-body">
                        <div className="message-label">{message.role === "assistant" ? "Floater AI" : "You"}<span>{message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span></div>
                        {message.content ? <MessageContent className={message.role === "user" ? "user-message-bubble" : "assistant-message-body"}><MessageResponse>{explainText || (extractedCode ? "Built the preview, bro. Your full code is in Floater Studio." : message.content)}</MessageResponse></MessageContent> : null}
                        {extractedCode ? <div className="chat-code-block"><CodeBlockContainer language="html"><CodeBlockHeader><CodeBlockFilename>index.html</CodeBlockFilename><CodeBlockActions><CodeBlockCopyButton aria-label="Copy generated code" className="size-7" /><Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { updateProject({ code: extractedCode, type: detectProjectType(extractedCode) }); setStudioTab(detectProjectType(extractedCode) === "motion" ? "motion" : "preview"); setChatMode("studio"); }}><Zap className="size-3.5" />Launch in Engine</Button></CodeBlockActions></CodeBlockHeader><CodeBlockContent code={extractedCode} language="html" showLineNumbers /></CodeBlockContainer></div> : null}
                        {message.role === "assistant" && index === messages.length - 1 && !busy ? <div className="message-actions"><button type="button" title="Copy response" aria-label="Copy response" onClick={() => { void navigator.clipboard.writeText(message.content); }}><Copy className="size-3.5" /></button><button type="button" title="Try again" aria-label="Try again" onClick={retryRequest}><RotateCcw className="size-3.5" /></button></div> : null}
                      </div>
                    </Message>;
                  })}
                  {busy === "chat" ? <div className="typing-status"><span className="assistant-avatar"><img src={floaterMark} alt="" aria-hidden="true" loading="lazy" width={816} height={816} /></span><div><p className="message-label">Floater AI <span className="text-primary">· creating</span></p><Shimmer className="text-sm">Thinking...</Shimmer></div></div> : null}
                  {replyError ? <div className="error-banner" role="alert"><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><span>{replyError}</span></div><Button size="sm" variant="outline" className="mt-3" onClick={retryRequest}><RotateCcw className="size-3.5" />Try again, bro</Button></div> : null}
                  <div aria-hidden="true" className="h-3" />
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
              <div className="composer-wrap">
                {quickPrompts.map((prompt) => <Button key={prompt} variant="outline" size="sm" className="quick-prompt" onClick={() => prompt === "Push to GitHub" ? (setConnectorsOpen(true), setConnectorsTab("github")) : void handleSubmit({ text: prompt.toLowerCase(), files: [] })}>{prompt === "Build a Website" ? <Globe2 className="size-3" /> : prompt === "Create a Web App" ? <Braces className="size-3" /> : prompt === "Build a Motion Video" ? <Play className="size-3" /> : <Github className="size-3" />}{prompt}</Button>)}
                <PromptInput onSubmit={(prompt) => { void handleSubmit(prompt); }} className="floater-composer">
                  <PromptInputTextarea autoFocus value={input} onChange={(event) => setInput(event.currentTarget.value)} placeholder="Tell Floater what you want to build, bro…" aria-label="Message Floater AI" maxLength={16000} />
                  <PromptInputFooter className="composer-footer">
                    <div className="composer-tools"><Select value={model} onValueChange={(value) => { setModel(value as ActiveModel); localStorage.setItem("floater.model.v1", value); }}><SelectTrigger className="model-select" aria-label="Choose AI model"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="floater-gemini">Floater · Gemini 3.8 Flash</SelectItem><SelectItem value="google-gemini">Google AI Studio · Gemini 3.8 Flash</SelectItem><SelectItem value="groq-llama">Groq · Llama 3.3 70B</SelectItem><SelectItem value="groq-qwen">Groq · Qwen 2.5 Coder 32B</SelectItem><SelectItem value="openrouter-qwen">OpenRouter · Qwen 3 Coder</SelectItem><SelectItem value="openrouter-deepseek">OpenRouter · DeepSeek Chat</SelectItem></SelectContent></Select><span className="free-chip"><Zap className="size-3" />FREE</span>{!providerHasKey ? <button type="button" className="key-needed" onClick={() => setEnginesOpen(true)}>Add key</button> : null}</div>
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">Enter to send <span className="opacity-50">·</span> Shift + Enter for a new line</span>
                    <PromptInputSubmit aria-label={busy === "chat" ? "Stop response" : "Send message"} status={busy === "chat" ? "streaming" : "ready"} onStop={() => { runRef.current = ""; setBusy(null); setEngineStatus("Paused"); }} disabled={!input.trim() || !providerHasKey || busy === "chat"} className="send-button"><Send className="size-4" /></PromptInputSubmit>
                  </PromptInputFooter>
                </PromptInput>
                <p className="fine-print">Floater AI is built with care. Double-check code before shipping.</p>
              </div>
            </section> : null}

            {chatMode !== "chat" && rightPanelOpen ? <section className={`engine-pane ${chatMode === "studio" ? "engine-pane-full" : ""}`} aria-label="Floater Render Engine">
              <div className="engine-toolbar"><div><div className="flex items-center gap-2"><span className="engine-brand-icon"><Orbit className="size-4" /></span><h2 className="font-display text-sm font-semibold">Floater Render Engine</h2></div><p className="engine-subtitle"><span className="engine-status-dot" />{detectedType === "motion" ? "Motion detected" : "Live HTML preview"}<span className="engine-separator">·</span>{engineStatus === "Paused" ? "Paused" : "Real-time"}</p></div><div className="flex items-center gap-1.5"><Button variant="ghost" size="icon" aria-label="Collapse preview" onClick={() => setRightPanelOpen(false)}><ChevronDown className="size-4 rotate-[-90deg]" /></Button><Button variant="ghost" size="icon" aria-label="Open preview in a new tab" title="Open in new tab" onClick={() => { const previewWindow = window.open("about:blank", "_blank", "noopener,noreferrer"); if (previewWindow) { previewWindow.document.write(previewCode); previewWindow.document.close(); } }}><ExternalLink className="size-4" /></Button></div></div>
              <div className="engine-tabs" role="tablist" aria-label="Render engine tabs">
                {(["preview", "motion", "code"] as const).map((tab) => <button type="button" role="tab" aria-selected={studioTab === tab} key={tab} onClick={() => { setStudioTab(tab); setMode("studio"); }}><span>{tab === "preview" ? <Eye className="size-3.5" /> : tab === "motion" ? <Play className="size-3.5" /> : <Code2 className="size-3.5" />}</span>{tab === "preview" ? "App & Web Preview" : tab === "motion" ? "Motion & Video" : "Code Editor"}</button>)}
              </div>
              {studioTab === "preview" ? <div className="preview-panel">
                <div className="preview-toolbar"><div className="browser-controls"><span /><span /><span /></div><div className="url-pill"><LockKeyhole className="size-3" /><span>floater.ai/preview/{projectId.slice(0, 8) || "project"}</span></div><Button variant="ghost" size="icon" className="size-7" aria-label="Refresh preview" title="Refresh Preview" onClick={() => { if (previewRef.current) previewRef.current.srcdoc = previewCode; setStudioError(""); setEngineStatus("Live"); }}><RotateCcw className="size-3.5" /></Button><div className="viewport-controls" role="group" aria-label="Device preview size">{([{ name: "desktop", icon: Monitor }, { name: "tablet", icon: Tablet }, { name: "mobile", icon: Smartphone }] as const).map(({ name, icon: Icon }) => <button type="button" key={name} className={viewport === name ? "active" : ""} aria-label={`${name} preview`} aria-pressed={viewport === name} title={`${name === "desktop" ? "Desktop 100%" : name === "tablet" ? "Tablet 768px" : "Mobile 375px"}`} onClick={() => setViewport(name)}><Icon className="size-3.5" /></button>)}</div></div>
                {studioError ? <div className="runtime-error" role="alert"><CircleAlert className="size-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-medium">Preview caught an error</p><p className="truncate text-[10px] opacity-80">{studioError}</p></div><Button size="sm" variant="outline" className="h-7 shrink-0 text-[10px]" onClick={() => { setInput(`Fix this runtime error in my project: ${studioError}`); setStudioError(""); void handleSubmit({ text: `Fix this runtime error in my project: ${studioError}`, files: [] }); }}>Fix Error with Floater AI</Button></div> : null}
                <div className={`preview-stage viewport-${viewport} ${selectedIsAnimation ? `ratio-${aspect}` : ""}`}><div className="frame-wrap"><iframe ref={previewRef} className="preview-frame" title="Interactive Floater preview" sandbox="allow-scripts allow-forms allow-modals allow-downloads" referrerPolicy="no-referrer" /></div></div>
                <div className="preview-footer"><div className="preview-foot-label"><span className="engine-status-dot" />Engine running <span>·</span> {viewport === "desktop" ? "Desktop · 100%" : viewport === "tablet" ? "Tablet · 768px" : "Mobile · 375px"}</div><Button variant="ghost" size="sm" className="preview-launch" onClick={() => { updateProject({ code: previewCode, type: detectProjectType(previewCode) }); setStudioTab("code"); }}><Code2 className="size-3.5" />Edit code</Button></div>
              </div> : null}
              {studioTab === "motion" ? <div className="motion-panel"><div className="motion-controls"><Button size="icon" variant="ghost" aria-label={playMotion ? "Pause animation" : "Play animation"} onClick={() => setPlayMotion((value) => !value)}>{playMotion ? <Pause className="size-4" /> : <Play className="size-4" />}</Button><Button size="icon" variant="ghost" aria-label="Restart animation" onClick={() => { setMotionSeconds(0); setPlayMotion(true); if (previewRef.current) previewRef.current.srcdoc = previewCode; }}><RotateCcw className="size-4" /></Button><div className="motion-time">00:{String(motionSeconds % 60).padStart(2, "0")}<span>{playMotion ? "PLAYING" : "PAUSED"}</span></div><span className="motion-spacer" /><Select value={aspect} onValueChange={(value) => setAspect(value as "landscape" | "vertical")}><SelectTrigger className="aspect-select" aria-label="Choose animation aspect ratio"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="landscape">16:9 Landscape</SelectItem><SelectItem value="vertical">9:16 Vertical Shorts</SelectItem></SelectContent></Select><Button size="sm" variant={recording ? "destructive" : "outline"} className="record-button" onClick={() => void startRecording()}>{recording ? <span className="recording-dot" /> : <span className="record-dot" />}{recording ? "Stop & Save" : "Record WebM"}</Button></div><div className={`motion-stage ${aspect === "vertical" ? "vertical" : "landscape"}`}><iframe ref={studioTab === "motion" ? previewRef : undefined} className="preview-frame" title="Motion video viewport" sandbox="allow-scripts allow-forms allow-modals allow-downloads" referrerPolicy="no-referrer" /><div className="motion-overlay"><span><span className="engine-status-dot" />{playMotion ? "PREVIEW LIVE" : "PREVIEW PAUSED"}</span><span>FPS {fps}</span></div></div><div className="motion-footer"><div><span className="motion-signal" />0:{String(motionSeconds % 60).padStart(2, "0")}<span className="engine-separator">·</span>{aspect === "landscape" ? "1920 × 1080" : "1080 × 1920"}<span className="engine-separator">·</span>WEBM</div><Button size="sm" variant="ghost" onClick={() => setStudioTab("code")}><Code2 className="size-3.5" />Edit motion code</Button></div></div> : null}
              {studioTab === "code" ? <div className="code-editor-panel"><div className="editor-toolbar"><div className="editor-file"><span className="file-status-dot" /><FileCode2 className="size-3.5" /><span>index.html</span><span className="file-lang">HTML</span></div><div className="editor-actions"><Button variant="outline" size="sm" className="editor-action" onClick={downloadHtml}><ArrowDownToLine className="size-3.5" /><span>Export HTML</span></Button><Button variant="outline" size="sm" className="editor-action" onClick={() => { if (currentProject) void syncProject(currentProject); else setCloudError("Start a project first, bro."); }}><LockKeyhole className="size-3.5" /><span>{saving ? "Saving…" : "Save to Cloud"}</span></Button><Button variant="outline" size="sm" className="editor-action" onClick={() => void handlePushToGithub()}><Github className="size-3.5" /><span>Push to GitHub</span></Button></div></div><div className="code-editor"><div className="line-numbers" aria-hidden="true">{previewCode.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div><Textarea ref={editorRef} value={previewCode} onChange={(event) => updateProject({ code: event.currentTarget.value, type: detectProjectType(event.currentTarget.value) })} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" aria-label="Edit project HTML" className="code-textarea" /></div><div className="code-editor-footer"><span><span className="engine-status-dot" />{saving ? "Saving…" : cloudUser ? "Cloud autosave on" : "Saved in this browser"}</span><span>HTML · {previewCode.split("\n").length} lines · UTF-8</span></div></div> : null}
              {studioTab !== "motion" && selectedIsAnimation && studioTab === "preview" ? <div className="auto-detect"><Zap className="size-3.5" />Motion code detected · <button type="button" onClick={() => setStudioTab("motion")}>Open Motion Engine <ArrowUpRight className="size-3" /></button></div> : null}
            </section> : null}
            {chatMode !== "chat" && !rightPanelOpen ? <section className="engine-collapsed"><Orbit className="size-5 text-primary" /><p className="text-xs font-medium">Floater Engine</p><Button variant="ghost" size="icon" aria-label="Expand studio panel" title="Expand studio panel" onClick={() => setRightPanelOpen(true)}><ChevronDown className="size-4 rotate-90" /></Button></section> : null}
          </div>
        </main>
      </div>

      <Dialog open={Boolean(renameId)} onOpenChange={(open) => { if (!open) setRenameId(""); }}><DialogContent><DialogHeader><DialogTitle>Rename project</DialogTitle><DialogDescription>Give this Floater project a name you’ll spot right away.</DialogDescription></DialogHeader><Input autoFocus value={renameValue} maxLength={72} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveRename(); }} aria-label="Project name" /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRenameId("")}>Cancel</Button><Button onClick={saveRename}>Save name</Button></div></DialogContent></Dialog>

      <Dialog open={authModal} onOpenChange={setAuthModal}><DialogContent className="auth-dialog"><DialogHeader><div className="auth-mark"><img src={floaterMark} alt="" aria-hidden="true" loading="lazy" width={816} height={816} /></div><DialogTitle className="text-center font-display">Sign in to Floater Cloud</DialogTitle><DialogDescription className="text-center">Keep your projects in sync across your workspace, bro.</DialogDescription></DialogHeader><div className="auth-tabs"><button type="button" aria-selected={authMode === "sign-in"} onClick={() => { setAuthMode("sign-in"); setAuthMessage(""); }}>Sign in</button><button type="button" aria-selected={authMode === "sign-up"} onClick={() => { setAuthMode("sign-up"); setAuthMessage(""); }}>Create account</button></div><form className="auth-form" onSubmit={(event) => void handleLogin(event)}>{authMode === "sign-up" ? <label className="form-field"><span>Display name</span><Input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="How should Floater call you?" required /></label> : null}<label className="form-field"><span>Email</span><Input type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} maxLength={254} placeholder="you@example.com" required /></label><label className="form-field"><span>Password</span><Input type="password" autoComplete={authMode === "sign-in" ? "current-password" : "new-password"} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} maxLength={128} placeholder="At least 8 characters" required /></label><Button type="submit" disabled={busy === "auth"} className="w-full">{busy === "auth" ? "Connecting…" : authMode === "sign-in" ? "Sign in to sync" : "Create free account"}<ArrowUpRight className="size-4" /></Button></form><div className="auth-divider"><span />or continue with<span /></div><div className="flex gap-2"><Button variant="outline" className="social-button flex-1" onClick={() => void socialSignIn("google")}>{googleGMark}Continue with Google</Button><Button variant="outline" className="social-button flex-1" onClick={() => void socialSignIn("lovable")}><Orbit className="size-[18px]" />Continue with Lovable</Button></div>{authMessage ? <p role="status" className="form-message">{authMessage}</p> : null}<p className="auth-note"><LockKeyhole className="size-3" />Your guest projects stay right here until cloud sync is ready.</p></DialogContent></Dialog>

      <Dialog open={connectorsOpen} onOpenChange={(open) => { setConnectorsOpen(open); if (!open) setEngineMessage(""); }}><DialogContent className="settings-dialog connectors-dialog"><DialogHeader><div className="settings-title-icon"><PlugZap className="size-5" /></div><DialogTitle className="font-display">Connectors Hub</DialogTitle><DialogDescription>Connect the tools you use with Floater AI.</DialogDescription></DialogHeader><div className="connectors-layout"><nav className="connector-nav" aria-label="Connected tools">{[{ id: "github", name: "GitHub", icon: Github }, { id: "vercel", name: "Vercel Deploy", icon: Orbit }, { id: "supabase", name: "Your Supabase", icon: ShieldCheck }, { id: "webhook", name: "Webhooks", icon: PlugZap }].map(({ id, name, icon: Icon }) => <button type="button" key={id} className={connectorsTab === id ? "active" : ""} onClick={() => { setConnectorsTab(id); setEngineMessage(""); }}><Icon className="size-4" />{name}<span>{id === "github" && githubConnected ? <Check className="size-3 text-primary" /> : null}</span></button>)}</nav><div className="connector-body">{connectorsTab === "github" ? <><div className="integration-head"><Github className="size-5" /><div><p className="text-sm font-semibold">GitHub</p><p className="text-xs text-muted-foreground">Your repositories, your account</p></div><a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="Open GitHub in a new tab"><ExternalLink className="size-3.5" /></a></div><label className="form-field"><span>Personal access token</span><Input type="password" autoComplete="off" value={connectors.githubToken} maxLength={300} onChange={(event) => saveConnectorFields({ ...connectors, githubToken: event.target.value })} placeholder="github_pat_…" /></label><Button size="sm" variant="outline" disabled={busy === "repo" || !connectors.githubToken.trim()} onClick={() => void handleGithubConnect()}><Github className="size-3.5" />{busy === "repo" ? "Connecting…" : githubConnected ? `Connected as @${connectors.githubUser}` : "Connect GitHub"}</Button>{githubConnected ? <><label className="form-field"><span>Repository</span><Select value={connectors.repo} onValueChange={(repo) => saveConnectorFields({ ...connectors, repo })}><SelectTrigger><SelectValue placeholder="Choose a repository" /></SelectTrigger><SelectContent>{githubRepos.map((repo) => <SelectItem key={repo.id} value={repo.full_name}>{repo.full_name}{repo.private ? " · private" : ""}</SelectItem>)}</SelectContent></Select></label><div className="flex gap-2"><Input value={connectors.repo.includes("/") ? "" : connectors.repo} placeholder="new-repository-name" maxLength={100} onChange={(event) => saveConnectorFields({ ...connectors, repo: event.target.value })} aria-label="New repository name" /><Button variant="outline" size="sm" onClick={() => void handleCreateRepo()} disabled={busy === "repo"}><Plus className="size-3.5" />Create repo</Button></div><Button className="w-full" onClick={() => void handlePushToGithub()} disabled={busy === "repo"}><Github className="size-4" />{busy === "repo" ? "Pushing project…" : "Push index.html + README.md"}</Button></> : <div className="connector-help"><LockKeyhole className="size-4" /><span>Token stays in this browser and is only sent to GitHub when you connect or push.</span></div>}</> : null}
                    {connectorsTab === "vercel" ? <><div className="integration-head"><Orbit className="size-5" /><div><p className="text-sm font-semibold">Vercel deploy</p><p className="text-xs text-muted-foreground">Publish a connected project</p></div><a href="https://vercel.com" target="_blank" rel="noopener noreferrer" aria-label="Open Vercel in a new tab"><ExternalLink className="size-3.5" /></a></div><label className="form-field"><span>Vercel access token <span className="optional-label">optional with a deploy hook</span></span><Input type="password" autoComplete="off" value={connectors.vercelToken} maxLength={300} onChange={(event) => saveConnectorFields({ ...connectors, vercelToken: event.target.value })} placeholder="Your Vercel token" /></label><label className="form-field"><span>Deployment hook</span><Input type="url" value={connectors.vercelHook} maxLength={2000} onChange={(event) => saveConnectorFields({ ...connectors, vercelHook: event.target.value })} placeholder="https://api.vercel.com/v1/integrations/deploy/…" /></label><Button variant="outline" size="sm" onClick={() => void handleVercelDeploy()}><ArrowUpRight className="size-4" />Trigger Vercel deployment</Button><p className="connector-help">Deployment hooks are the quickest route: copy one from your Vercel project and add it above.</p></> : null}
                    {connectorsTab === "supabase" ? <><div className="integration-head"><ShieldCheck className="size-5" /><div><p className="text-sm font-semibold">Bring your own Supabase</p><p className="text-xs text-muted-foreground">Store your own project connection</p></div><a href="https://supabase.com" target="_blank" rel="noopener noreferrer" aria-label="Open Supabase in a new tab"><ExternalLink className="size-3.5" /></a></div><label className="form-field"><span>Project URL</span><Input type="url" maxLength={500} value={connectors.supabaseUrl} onChange={(event) => saveConnectorFields({ ...connectors, supabaseUrl: event.target.value })} placeholder="https://your-project.supabase.co" /></label><label className="form-field"><span>Public anon key</span><Input type="password" autoComplete="off" maxLength={3000} value={connectors.supabaseKey} onChange={(event) => saveConnectorFields({ ...connectors, supabaseKey: event.target.value })} placeholder="Your public key" /></label><p className="connector-help">Saved in your browser for apps you create. This doesn’t replace Floater Cloud or change the app’s own account settings.</p></> : null}
                    {connectorsTab === "webhook" ? <><div className="integration-head"><PlugZap className="size-5" /><div><p className="text-sm font-semibold">Custom webhook</p><p className="text-xs text-muted-foreground">n8n, Make, Zapier, Discord, or your API</p></div></div><label className="form-field"><span>Connector name</span><Input value={connectors.webhookName} maxLength={64} onChange={(event) => saveConnectorFields({ ...connectors, webhookName: event.target.value })} placeholder="My automation" /></label><label className="form-field"><span>HTTPS webhook URL</span><Input type="url" value={connectors.webhookUrl} maxLength={2000} onChange={(event) => saveConnectorFields({ ...connectors, webhookUrl: event.target.value })} placeholder="https://hooks.example.com/…" /></label><Button variant="outline" size="sm" onClick={() => void testWebhook()}><Zap className="size-3.5" />Test webhook</Button><p className="connector-help">Your test message is sent only after you press the button. Secure HTTPS addresses only.</p></> : null}
                  {engineMessage ? <p className="form-message" role="status">{engineMessage}</p> : null}
                </div></div><p className="settings-footnote"><LockKeyhole className="size-3" />Connector details are saved only in this browser.</p></DialogContent></Dialog>

      <Dialog open={enginesOpen} onOpenChange={setEnginesOpen}><DialogContent className="settings-dialog api-dialog"><DialogHeader><div className="settings-title-icon"><KeyRound className="size-5" /></div><DialogTitle className="font-display">AI Engine / API Keys</DialogTitle><DialogDescription>Pick the model you want beside the chat input.</DialogDescription></DialogHeader><div className="api-key-list"><div className="engine-key-card"><div className="engine-key-header"><span className="engine-brand-chip google-chip">G<span>·</span></span><div><h3>Google AI Studio <span className="model-state">Current · zero key needed with Floater AI</span></h3><p>Gemini 3.8 Flash</p></div><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Get Free Key <ExternalLink className="size-3" /></a></div><Input type="password" autoComplete="off" maxLength={500} value={engines.google} onChange={(event) => saveEngineFields({ ...engines, google: event.target.value })} placeholder="Optional Google API key for BYOK" /><div className="engine-model-select"><Button variant={model === "floater-gemini" ? "secondary" : "outline"} size="sm" onClick={() => { setModel("floater-gemini"); localStorage.setItem("floater.model.v1", "floater-gemini"); }}>Use Floater free</Button><Button variant={model === "google-gemini" ? "secondary" : "outline"} size="sm" onClick={() => { setModel("google-gemini"); localStorage.setItem("floater.model.v1", "google-gemini"); }}>Use my key</Button></div></div>
              <div className="engine-key-card"><div className="engine-key-header"><span className="engine-brand-chip groq-chip">Gq</span><div><h3>Groq <span className="model-state">Ultra-fast</span></h3><p>Llama 3.3 70B · Qwen 2.5 Coder</p></div><a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Get Free Key <ExternalLink className="size-3" /></a></div><Input type="password" autoComplete="off" maxLength={500} value={engines.groq} onChange={(event) => saveEngineFields({ ...engines, groq: event.target.value })} placeholder="Groq API key" /><div className="engine-model-select"><Button variant={model === "groq-llama" ? "secondary" : "outline"} size="sm" onClick={() => { setModel("groq-llama"); localStorage.setItem("floater.model.v1", "groq-llama"); }}>Llama 3.3 70B</Button><Button variant={model === "groq-qwen" ? "secondary" : "outline"} size="sm" onClick={() => { setModel("groq-qwen"); localStorage.setItem("floater.model.v1", "groq-qwen"); }}>Qwen Coder</Button></div></div>
              <div className="engine-key-card"><div className="engine-key-header"><span className="engine-brand-chip router-chip"><Orbit className="size-4" /></span><div><h3>OpenRouter <span className="model-state">Free models</span></h3><p>Qwen 3 Coder · DeepSeek Chat</p></div><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">Get Free Key <ExternalLink className="size-3" /></a></div><Input type="password" autoComplete="off" maxLength={500} value={engines.openrouter} onChange={(event) => saveEngineFields({ ...engines, openrouter: event.target.value })} placeholder="OpenRouter API key" /><div className="engine-model-select"><Button variant={model === "openrouter-qwen" ? "secondary" : "outline"} size="sm" onClick={() => { setModel("openrouter-qwen"); localStorage.setItem("floater.model.v1", "openrouter-qwen"); }}>Qwen 3 Coder</Button><Button variant={model === "openrouter-deepseek" ? "secondary" : "outline"} size="sm" onClick={() => { setModel("openrouter-deepseek"); localStorage.setItem("floater.model.v1", "openrouter-deepseek"); }}>DeepSeek Chat</Button></div></div></div><div className="free-note"><Zap className="size-4" /><p>Free tiers have provider-set usage limits. Keys are stored in your browser and only sent to the provider you pick.</p></div><div className="flex justify-end"><Button onClick={() => setEnginesOpen(false)}><Check className="size-4" />Done</Button></div></DialogContent></Dialog>

      <Dialog open={pinOpen} onOpenChange={(open) => { setPinOpen(open); if (!open) setPinEntry(""); }}><DialogContent className="pin-dialog"><DialogHeader><div className="settings-title-icon"><ShieldCheck className="size-5" /></div><DialogTitle className="font-display">Open creator controls</DialogTitle><DialogDescription>Your local studio PIN only unlocks creator settings in this browser.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); if (pinEntry === developerSettings.pin) { setDevEnabled(true); localStorage.setItem("floater.dev.enabled", "true"); setPinOpen(false); setDevOpen(true); setPinEntry(""); } else setAuthMessage("That PIN didn’t match. Give it another try."); }}><label className="form-field"><span>Studio PIN</span><Input type="password" value={pinEntry} onChange={(event) => setPinEntry(event.target.value)} autoComplete="off" autoFocus maxLength={32} /></label>{authMessage.startsWith("That PIN") ? <p role="alert" className="form-message">{authMessage}</p> : null}<Button className="w-full" type="submit"><ShieldCheck className="size-4" />Open creator controls</Button></form><button type="button" className="local-admin-note" onClick={() => { setPinOpen(false); setDevOpen(true); }}>Change your local studio PIN</button></DialogContent></Dialog>

      <Dialog open={devOpen} onOpenChange={setDevOpen}><DialogContent className="settings-dialog dev-dialog"><DialogHeader><div className="settings-title-icon"><ShieldCheck className="size-5" /></div><DialogTitle className="font-display">Super Admin / Dev</DialogTitle><DialogDescription>Local creator controls and this chat’s diagnostics.</DialogDescription></DialogHeader><div className="dev-tabs"><section><p className="setting-section-label">ASSISTANT PERSONALITY</p><label className="form-field"><span>System prompt</span><Textarea value={developerSettings.systemPrompt} maxLength={18000} rows={6} onChange={(event) => updateDevField("systemPrompt", event.target.value)} /></label><label className="form-field"><span>Engine injection wrapper</span><Textarea value={developerSettings.injection} maxLength={6000} rows={3} onChange={(event) => updateDevField("injection", event.target.value)} placeholder="Optional extra instructions for this browser" /></label><label className="form-field"><span>Developer name / handle</span><Input value={developerSettings.developer} maxLength={80} onChange={(event) => updateDevField("developer", event.target.value)} /></label></section><section className="dev-settings-section"><p className="setting-section-label">MODEL SETTINGS</p><div className="grid grid-cols-2 gap-3"><label className="form-field"><span>Temperature</span><Input type="number" min={0} max={2} step={0.1} value={developerSettings.temperature} onChange={(event) => updateDevField("temperature", event.target.value)} /><span className="text-[10px] text-muted-foreground">Gemini 3.8 Flash controls sampling at the provider.</span></label><label className="form-field"><span>Max output tokens</span><Input type="number" min={256} max={65536} step={256} value={developerSettings.maxTokens} onChange={(event) => updateDevField("maxTokens", event.target.value)} /><span className="text-[10px] text-muted-foreground">Gateway model uses provider-managed output limits.</span></label></div></section><section className="dev-settings-section"><p className="setting-section-label">LIVE REQUEST TELEMETRY</p><div className="telemetry-row"><span><Activity className="size-3.5" />Response latency</span><strong>{responseMs ? `${responseMs} ms` : "Waiting for first response"}</strong></div><div className="telemetry-row"><span><Zap className="size-3.5" />Model</span><strong>{model === "floater-gemini" ? "Gemini 3.8 Flash · Floater" : model}</strong></div><div className="telemetry-row"><span><MessageSquareText className="size-3.5" />Conversation size</span><strong>{messages.length} messages</strong></div><div className="log-panel">{runtimeLogs.length ? runtimeLogs.slice(-8).map((row, index) => <p key={`${row.time}-${index}`}><span>{row.time}</span>{row.line}</p>) : <p className="text-muted-foreground">No API request logs yet. Sensitive API keys and raw tokens are never shown.</p>}</div></section><section className="dev-settings-section"><p className="setting-section-label">BACKUP & ACCESS</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { const blob = new Blob([JSON.stringify({ project: currentProject, messages }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "floater-session.json"; a.click(); URL.revokeObjectURL(url); }}><ArrowDownToLine className="size-3.5" />Export chat JSON</Button><Button size="sm" variant="outline" onClick={() => { setDevEnabled(false); localStorage.removeItem("floater.dev.enabled"); setDevOpen(false); }}><LockKeyhole className="size-3.5" />Lock creator controls</Button></div><label className="form-field mt-3"><span>Change this browser’s studio PIN</span><Input type="password" value={developerSettings.pin} minLength={4} maxLength={32} onChange={(event) => updateDevField("pin", event.target.value)} autoComplete="new-password" /><span className="text-[10px] text-muted-foreground">These settings only control this browser; this is not account administrator access.</span></label></section></div><div className="dev-footer"><span>Created by {developerSettings.developer || "Floater creator"}</span><Button onClick={() => setDevOpen(false)}><Check className="size-4" />Done</Button></div></DialogContent></Dialog>
    </div>
  );
}

// Preserve a simple same-origin mapping for GitHub's public repository response.
function awaitSafeIndex(item: { id: string; name?: string }, index: number) {
  return { id: Number(item.id) || index + 1, name: item.name ?? item.id.split("/").at(-1) ?? item.id, full_name: item.id, private: false };
}