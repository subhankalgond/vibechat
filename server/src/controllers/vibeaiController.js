/**
 * VibeAI — Gemini-powered assistant endpoints.
 * Uses the free Google Gemini API via plain fetch (no SDK dependency).
 * Requires VIBEAI_API_KEY in the environment; without it, endpoints return
 * a helpful setup message instead of failing hard.
 */
const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const env = require('../config/env');

const MODEL = 'gemini-2.0-flash';

function aiConfigured() {
  return Boolean(env.vibeaiApiKey);
}

function setupPayload() {
  return {
    configured: false,
    message:
      'VibeAI needs a free Gemini API key. Create one at aistudio.google.com and add it in Render: Environment → VIBEAI_API_KEY.',
  };
}

async function callGemini(prompt, systemInstruction) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(env.vibeaiApiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
        : {}),
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini error ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const text =
    data && data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('Empty AI response');
  return text.trim();
}

const SYSTEM = 'You are VibeAI, a friendly assistant inside a chat app called VibeChat. Reply concisely and helpfully. Use the same language as the user\'s message.';

/**
 * POST /api/vibeai/chat { messages: [{ role:'user'|'assistant', content }] }
 */
async function chat(req, res, next) {
  try {
    if (!aiConfigured()) return ok(res, setupPayload());
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    if (!messages.length) return fail(res, 'No messages provided.', 422);

    const prompt = messages
      .slice(-16)
      .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${String(m.content).slice(0, 2000)}`)
      .join('\n');
    const reply = await callGemini(prompt, SYSTEM);
    return ok(res, { configured: true, reply });
  } catch (error) {
    if (String(error.message).includes('Gemini error')) {
      return fail(res, 'VibeAI request failed. Check the VIBEAI_API_KEY on the server.', 502);
    }
    return next(error);
  }
}

/**
 * POST /api/vibeai/translate { text, target_language }
 */
async function translate(req, res, next) {
  try {
    if (!aiConfigured()) return ok(res, setupPayload());
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const target = typeof req.body.target_language === 'string' ? req.body.target_language.trim() : 'English';
    if (!text) return fail(res, 'Text is required.', 422);
    if (text.length > 5000) return fail(res, 'Text is too long. Max 5000 characters.', 422);

    const reply = await callGemini(
      `Translate the following text to ${target}. Reply with ONLY the translation, nothing else.\n\n${text}`,
      'You are a translation engine. Output only the translation.'
    );
    return ok(res, { configured: true, translation: reply });
  } catch (error) {
    if (String(error.message).includes('Gemini error')) {
      return fail(res, 'VibeAI request failed. Check the VIBEAI_API_KEY on the server.', 502);
    }
    return next(error);
  }
}

/**
 * POST /api/vibeai/summarize { conversation_id } — summarize recent chat.
 */
async function summarize(req, res, next) {
  try {
    if (!aiConfigured()) return ok(res, setupPayload());
    const conversationId = Number(req.body.conversation_id);
    const { getMembership } = require('../services/conversationService');
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    const { rows } = await query(
      `SELECT m.message_text, m.message_type, m.sender_id FROM messages m
        WHERE m.conversation_id = $1 AND m.message_text IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM message_deletions d WHERE d.message_id = m.id AND d.user_id = $2)
        ORDER BY m.created_at DESC LIMIT 60`,
      [conversationId, req.user.id]
    );
    if (rows.length < 3) return fail(res, 'Not enough messages to summarize yet.', 422);

    const nameById = new Map(membership.members.map((m) => [m.id, m.full_name]));
    const transcript = rows
      .reverse()
      .map((r) => `${nameById.get(Number(r.sender_id)) || 'User'}: ${String(r.message_text).slice(0, 500)}`)
      .join('\n');

    const reply = await callGemini(
      `Summarize this chat conversation in 3-4 short bullet points, then list any decisions or action items:\n\n${transcript}`,
      'You are a summarization assistant. Be concise and factual.'
    );
    return ok(res, { configured: true, summary: reply });
  } catch (error) {
    if (String(error.message).includes('Gemini error')) {
      return fail(res, 'VibeAI request failed. Check the VIBEAI_API_KEY on the server.', 502);
    }
    return next(error);
  }
}

module.exports = { chat, translate, summarize };
