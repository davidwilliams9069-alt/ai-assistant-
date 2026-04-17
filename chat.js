import Groq from "groq-sdk";
import { kv } from "@vercel/kv";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { message, userId = "browser_user" } = req.body;

  const raw = (await kv.lrange(`chat:${userId}`, 0, 9)) || [];
  const history = raw.map(m => JSON.parse(m)).reverse();

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are a helpful personal AI assistant. Be concise." },
      ...history,
      { role: "user", content: message },
    ],
  });

  const reply = completion.choices[0].message.content;

  await kv.lpush(`chat:${userId}`, JSON.stringify({ role: "user", content: message }));
  await kv.lpush(`chat:${userId}`, JSON.stringify({ role: "assistant", content: reply }));
  await kv.ltrim(`chat:${userId}`, 0, 19);

  res.json({ reply });
}
