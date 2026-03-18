// src/utils/env.ts

export const ENV = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  GEMINI_KEY: process.env.GEMINI_API_KEY,
};

if (!ENV.TELEGRAM_TOKEN) {
  throw new Error("Помилка: Відсутній TELEGRAM_BOT_TOKEN у файлі .env.local");
}

if (!ENV.GEMINI_KEY) {
  throw new Error("Помилка: Відсутній GEMINI_API_KEY у файлі .env.local");
}
