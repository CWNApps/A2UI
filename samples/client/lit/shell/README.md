# A2UI Generator

This is a UI to generate and visualize A2UI responses.

## Prerequisites

1. [nodejs](https://nodejs.org/en)

## Configuration

### For Relevance AI Integration (Recommended: Tools API)

The shell can be configured to use **Relevance AI Tools** for interactive UI responses. This is preferred over Agents API because:
- ✅ Agents API triggers are async with no direct output response
- ✅ Tools triggers return output immediately, ideal for interactive UIs
- ✅ The UI will never be blank waiting for responses

#### Setup Steps:

1. **Get your Relevance AI credentials:**
   - Log in to your Relevance AI project dashboard
   - Navigate to **Settings** → copy your **Project ID**
   - Navigate to **API Keys** → copy your **API Key** (keep this secret!)
   - Navigate to **Studios/Tools** → find your interactive tool/studio and copy its **ID**
   - Find your **Stack Base URL** (typically `https://api-xxxxx.stack.tryrelevance.com/latest`)

2. **Create a `.env` file** in this directory:
   ```bash
   cp .env.example .env
   ```

3. **Fill in your credentials in `.env`:**
   ```env
   VITE_RELEVANCE_STACK_BASE=https://api-xxxxx.stack.tryrelevance.com/latest
   VITE_RELEVANCE_PROJECT_ID=your_project_id
   VITE_RELEVANCE_API_KEY=your_api_key
   VITE_RELEVANCE_TOOL_ID=your_tool_studio_id
   ```

4. **Keep your `.env` file private** - never commit it to version control!

#### Why Tools Instead of Agents?

- **Agents API**: Triggers async jobs with no direct HTTP response. Output goes to a separate destination. Not suitable for interactive UIs.
- **Tools API**: Supports both sync and async polling. Perfect for interactive web UIs where users expect immediate feedback.

## Running

This sample depends on the Lit renderer. Before running this sample, you need to build the renderer.

1. **Build the renderer:**
   ```bash
   cd ../../../renderers/lit
   npm install
   npm run build
   ```

2. **Run this sample:**
   ```bash
   cd - # back to the sample directory
   npm install
   ```

3. **Run the servers:**
   - **Option A (Relevance AI Agent):** Just run the dev server with your `.env` configured: `npm run dev`
   - **Option B (A2A Server):** Run the [A2A server](../../../agent/adk/restaurant_finder/) and then run: `npm run dev`

After starting the dev server, you can open http://localhost:5173/ to view the sample.

**Note:** The app will automatically use Relevance AI when the `serverUrl` in your app config is empty, otherwise it uses the configured A2A server.

Important: The sample code provided is for demonstration purposes and illustrates the mechanics of A2UI and the Agent-to-Agent (A2A) protocol. When building production applications, it is critical to treat any agent operating outside of your direct control as a potentially untrusted entity.

All operational data received from an external agent—including its AgentCard, messages, artifacts, and task statuses—should be handled as untrusted input. For example, a malicious agent could provide crafted data in its fields (e.g., name, skills.description) that, if used without sanitization to construct prompts for a Large Language Model (LLM), could expose your application to prompt injection attacks.

Similarly, any UI definition or data stream received must be treated as untrusted. Malicious agents could attempt to spoof legitimate interfaces to deceive users (phishing), inject malicious scripts via property values (XSS), or generate excessive layout complexity to degrade client performance (DoS). If your application supports optional embedded content (such as iframes or web views), additional care must be taken to prevent exposure to malicious external sites.

Developer Responsibility: Failure to properly validate data and strictly sandbox rendered content can introduce severe vulnerabilities. Developers are responsible for implementing appropriate security measures—such as input sanitization, Content Security Policies (CSP), strict isolation for optional embedded content, and secure credential handling—to protect their systems and users.