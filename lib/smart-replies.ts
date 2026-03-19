import type { WebProject } from "./web-projects";

type SmartReplyInput = {
  project: WebProject;
  messageText: string;
  senderName: string | null;
  chatTitle: string | null;
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
  const projectContext = input.project.description?.trim() || "No extra project context.";
  const sender = input.senderName?.trim() || "Unknown user";
  const chat = input.chatTitle?.trim() || "Telegram group";

  return [
    "You are an intelligent Telegram assistant for the owner's private web project.",
    `Project name: ${input.project.name}`,
    `Project context: ${projectContext}`,
    `Chat: ${chat}`,
    `Sender: ${sender}`,
    "Rules:",
    "- Reply in the same language as the user message.",
    "- Keep the answer concise, clear, and useful.",
    "- Use plain text only.",
    "- Avoid emojis unless the user's style clearly asks for them.",
    "- If the question is vague, ask one short clarifying question.",
    "- If the message is not a real question or request, answer naturally and briefly.",
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
