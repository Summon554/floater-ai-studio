# Floater AI Studio

Build a sleek, ultra-fast, modern dark-mode AI Assistant, App/Website Builder & Custom Animation Studio web application named "Floater AI" (with the subtle domain badge "floater.ai"). It acts as an all-around genius "bro" assistant—fast, smart at everything, 100% free, and equipped with its own custom code-driven rendering engine, developer connectors, and free cloud storage.



Core Features & UI Layout:

1. Split-Screen Studio Workspace (with a toggle between "Chat Mode" and "Floater Studio"):

   - Left Sidebar ("Floater Cloud Projects"): Collapsible drawer showing saved projects and chat sessions from the cloud (plus a local-only guest mode fallback if the user hasn't logged in yet), with "New Project", "Rename", and "Delete" options.

   - Center Panel (Chat Interface): Clean message history, markdown rendering, syntax-highlighted code blocks with a one-click "Copy Code" button, and a "Launch in Engine" button on every code block. Add quick-start prompt pills above the input (e.g., "Build a Website", "Create a Web App", "Build a Motion Video", "Push to GitHub").

   - Right Panel ("Floater Render Engine" Workspace): Three smart tabs so users can preview anything they build:

     a) "App & Web Preview" (Interactive Live Sandbox): Automatically renders full websites, landing pages, web apps, dashboards, and browser games in real time. Includes a **Device Viewport Switcher** (`Desktop 100%`, `Tablet 768px`, `Mobile 375px`), a simulated URL bar (`floater.ai/preview/project`), a "Refresh Preview" button, and an "Open in New Tab" button.

     b) "Motion & Video Engine" (Custom Animation Viewport): Built for code-driven HTML5/CSS3/Canvas motion graphics and animations. Includes **Play / Pause / Restart** playback controls, an **Aspect Ratio Switcher** (`16:9 Landscape`, `9:16 Vertical Shorts`), live FPS/timer telemetry, and a built-in **Record Video (WebM)** button using the native MediaRecorder API so users can export animations as video files for free.

     c) "Code Editor": Live editable code view with syntax formatting, line numbers, a one-click **"Export / Download HTML"** button, a **"Save to Cloud"** button, and a **"Push to GitHub"** button when GitHub is connected.

   - Smart Auto-Detection & Error Catcher: Automatically switch between "App & Web Preview" and "Motion & Video Engine" depending on the generated code, and show a clean error banner with a **"Fix Error with Floater AI"** button if a runtime JS error occurs.



2. Free "Floater Cloud" Backend (Supabase Integration - 100% Free Tier):

   - Connect to Supabase (or Lovable Cloud) to provide free user authentication (Email/Password login & signup) and automatic cloud saving.

   - Create two tables with strict Row Level Security (RLS) so each user can only access their own data:

     a) `projects` (`id`, `user_id`, `title`, `type` ['web' or 'motion'], `code`, `created_at`, `updated_at`)

     b) `chat_messages` (`id`, `project_id`, `user_id`, `role`, `content`, `created_at`)

   - Allow guest users to use the entire app immediately using `localStorage` without logging in, and offer an optional "Sign In to Sync Cloud" button in the header so there are zero barriers or paywalls.



3. Built-in "Connectors Hub" Modal (GitHub & Developer Integrations):

   - Add a "Connectors" button (with a plug icon and connected-count badge) in the top header.

   - Inside the Connectors Modal, display clean integration cards where users can connect their accounts locally via free tokens stored safely in `localStorage`:

     a) **GitHub Connector (Real GitHub REST API Integration)**: Input field for a GitHub Personal Access Token (with a clickable link to `https://github.com`), fetch user profile, pick or create a new repository, and push generated `index.html` + `README.md` in one click.

     b) **Vercel Deploy Connector**: Input field for a Vercel Access Token (`https://vercel.com`) or Deploy Hook URL to trigger free deployments.

     c) **Bring Your Own Supabase Connector**: Input fields for a user's own free Supabase Project URL and `anon` Public Key (`https://supabase.com`) so Floater AI can inject their own database credentials into apps they build.

     d) **Custom Webhook / API Connector**: Save custom Webhook URLs (n8n, Make, Zapier, Discord) with a "Test Webhook" button.



4. 100% Free Multi-Engine AI Setup (API Settings Modal with Direct Links):

   - Add a prominent "AI Engine / API Keys" button in the top header.

   - Allow the user to input and save their free API keys in browser `localStorage` (never hardcoded) for three 100% free providers, with a quick model switcher dropdown right next to the chat input:

     a) Groq API (Ultra-Fast Engine - models: `llama-3.3-70b-versatile` and `qwen-2.5-coder-32b`) — Include a clickable "Get Free Key" link opening `https://groq.com` in a new tab.

     b) Google AI Studio (All-Around Genius - model: `gemini-2.5-flash`) — Include a clickable "Get Free Key" link opening `https://google.com` in a new tab.

     c) OpenRouter Free Tier (Coding Specialist - models: `qwen/qwen3-coder:free` and `deepseek/deepseek-chat:free`) — Include a clickable "Get Free Key" link opening `https://openrouter.ai` in a new tab.

   - Display a note inside the modal reminding users that all keys are 100% free (no credit card required) and stored locally in their browser.



5. Super Admin / Developer Mode (Built-in Dev Controls):

   - Add a "Dev / Super Admin" toggle or badge in the top bar (unlockable via a dev PIN stored in localStorage, default PIN `2026`, with an option to change it).

   - When Super Admin / Dev Mode is active, display a "SUPER ADMIN / DEV" badge in the header and unlock a dedicated "Dev Panel" drawer/modal where the creator can:

     a) Edit and customize the live System Prompt and Engine Injection Wrapper on the fly.

     b) View real-time API token usage, response latency (ms), and raw JSON request/response logs for debugging.

     c) Export/Import the entire chat session as JSON and adjust temperature and max tokens.

     d) Set a custom Developer Name / Handle (default: "Winzel • Creator & Super Admin") shown in the workspace footer.



6. "Floater AI" System Persona (Default System Prompt):

   - Configure all API requests to use this editable default system prompt:

     "You are Floater AI (floater.ai), an ultra-fast, all-around genius AI assistant, full-stack web developer, and motion graphics engineer bro. You speak natural, chill Taglish (a mix of Tagalog and English) and call the user 'bro'. You excel at building complete, responsive websites, web apps, interactive tools, and smooth HTML5/CSS3/Canvas motion videos. Always output complete, self-contained, single-file HTML/CSS/JS (with Tailwind CSS CDN and Google Fonts when building websites/apps) inside one clean code block so the Floater Render Engine can preview it immediately. Keep explanations direct, concise, and practical."



7. Design & Vibe:

   - Futuristic dark slate/obsidian theme with glowing cyan and electric blue accents ("floating" glassmorphism cards and subtle border glows).

   - Top header featuring the custom "Floater AI" logo (`floater.ai` tag), active AI engine indicator, "Connectors" button, "Super Admin" badge/button, "New Chat" button, "API Settings" button, and "Sign In / Cloud Sync" button.

   - Mobile-responsive layout so it works smoothly on both phone and desktop.

   - Start with a cool, concise welcome message from Floater AI in Taglish: "Yo bro! Ready na ang Floater AI, custom Render Engine, Connectors Hub, at Free Floater Cloud. Anong gagawin natin today—website, web app, o motion video?"

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/03b239aa-ab95-41c9-9c83-78b11c7f7712).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
