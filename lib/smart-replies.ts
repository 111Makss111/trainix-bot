import type { TelegramMessageLog, WebProject } from "./web-projects";

type SmartReplyInput = {
  project: WebProject;
  messageText: string;
  senderName: string | null;
  chatTitle: string | null;
  recentMessages?: TelegramMessageLog[];
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function buildPrompt(input: SmartReplyInput) {
  const projectSummary =
    input.project.description?.trim() || "No short project summary provided.";
  const projectKnowledge =
    input.project.aiInstructions?.trim() || "No extra knowledge base provided yet.";
  const sender = input.senderName?.trim() || "Unknown user";
  const chat = input.chatTitle?.trim() || "Telegram group";
  const recentHistory = (input.recentMessages ?? [])
    .filter((message) => message.text?.trim())
    .slice(-8)
    .map((message) => {
      const role = message.updateType === "bot_reply" ? "Assistant" : "User";
      const author = message.senderName?.trim() || role;

      return `${role} (${author}): ${message.text?.trim()}`;
    })
    .join("\n");

  return [
    "You are an intelligent Telegram assistant for the owner's private web project.",
    `Project name: ${input.project.name}`,
    `Project summary: ${projectSummary}`,
    "Project knowledge base:",
    projectKnowledge,
    `Chat: ${chat}`,
    `Sender: ${sender}`,
    "Rules:",
    "- Reply in the same language as the user message.",
    "- Keep the answer concise, clear, and useful.",
    "- Use plain text only.",
    "- Avoid emojis unless the user's style clearly asks for them.",
    "- Use the project summary and knowledge base as your primary source of truth.",
    "- If the user asks what the project is, explain it using the provided project knowledge.",
    "- Do not invent features, pricing, or guarantees that are not present in the project knowledge.",
    "- Continue the conversation naturally using the recent chat history when it helps.",
    "- If the question is vague, ask one short clarifying question.",
    "- If the message is not a real question or request, answer naturally and briefly.",
    "",
    "Recent conversation:",
    recentHistory || "No recent conversation history.",
    "",
    "User message:",
    input.messageText.trim().slice(0, 4000),
  ].join("\n");
}

function normalizeReply(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 900);
}

export async function generateSmartTelegramReply(input: SmartReplyInput) {
  const provider = (input.project.aiProvider || "gemini").trim().toLowerCase();

  if (provider !== "gemini") {
    return null;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const model = input.project.aiModel?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(input),
              },
            ],
          },
        ],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    return null;
  }

  return normalizeReply(text);
}
