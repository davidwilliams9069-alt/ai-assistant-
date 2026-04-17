import Groq from "groq-sdk";
import { kv } from "@vercel/kv";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = "You are a helpful personal AI assistant. Be concise and friendly.";
const MODEL = "llama-3.3-70b-versatile"; // fastest & smartest free model

async function getAIReply(userId, userMessage) {
  // Load last 10 messages from memory
  const raw = (await kv.lrange(`chat:${userId}`, 0, 9)) || [];
  const history = raw.map(m => JSON.parse(m)).reverse();

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userMessage },
    ],
  });

  const reply = completion.choices[0].message.content;

  // Save to memory (keep last 20 total)
  await kv.lpush(`chat:${userId}`, JSON.stringify({ role: "user", content: userMessage }));
  await kv.lpush(`chat:${userId}`, JSON.stringify({ role: "assistant", content: reply }));
  await kv.ltrim(`chat:${userId}`, 0, 19);

  return reply;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true });

  const body = req.body;

  // ── Telegram ──────────────────────────────────────────
  if (body.message?.text) {
    const { chat, text } = body.message;
    const reply = await getAIReply(`tg_${chat.id}`, text);
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat.id, text: reply }),
    });
  }

  // ── Slack ─────────────────────────────────────────────
  else if (body.type === "url_verification") {
    return res.json({ challenge: body.challenge }); // one-time Slack handshake
  }
  else if (body.event?.type === "message" && !body.event.bot_id) {
    const { user, text, channel } = body.event;
    const reply = await getAIReply(`sl_${user}`, text);
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text: reply }),
    });
  }

  // ── Discord ───────────────────────────────────────────
  else if (body.type === 1) {
    return res.json({ type: 1 }); // Discord ping verification
  }
  else if (body.type === 2) {
    const userId = body.member?.user?.id || body.user?.id;
    const userMessage = body.data?.options?.[0]?.value || "";
    const reply = await getAIReply(`dc_${userId}`, userMessage);
    return res.json({ type: 4, data: { content: reply } });
  }

  res.status(200).json({ ok: true });
}
