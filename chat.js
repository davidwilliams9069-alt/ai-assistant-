// File path: api/chat.js
// This is a Vercel Serverless Function. It runs on the backend.

import Groq from 'groq-sdk';

export default async function handler(req, res) {
    // Security: Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Security: Read the API key from Vercel Environment Variables (Never hardcode here)
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        console.error('GROQ_API_KEY is not set in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    const groq = new Groq({ apiKey });

    try {
        const { messages } = req.body;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a helpful, professional AI assistant. Format your responses using Markdown when helpful (tables, lists, bold). Keep responses clear and concise."
                },
                ...messages
            ],
            model: "llama3-70b-8192", // Free, fast, and powerful on Groq
            temperature: 0.7,
            max_tokens: 4096,
        });

        res.status(200).json({ reply: chatCompletion.choices[0].message.content });

    } catch (error) {
        console.error('Groq API Error:', error);
        res.status(500).json({ error: 'Failed to fetch response from AI. Please try again.' });
    }
}
