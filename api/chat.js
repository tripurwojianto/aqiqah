import { buildPrompt } from '../lib/promptBuilder.js';
import { getFAQ } from '../lib/sheet.js';
import { generateWALink } from '../lib/waHelper.js';
import { getProduk } from '../lib/getProduk.js';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================= MEMORY =================
const userMemory = new Map();

function getUserId(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  let ip = forwarded || realIp || 'default-user';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  return ip;
}

function getUserMemory(userId) {
  if (!userMemory.has(userId)) {
    userMemory.set(userId, {
      name: null,
      history: [],
      lastActive: Date.now()
    });
  }
  const memory = userMemory.get(userId);
  memory.lastActive = Date.now();
  return memory;
}

function getUserHistory(userId) {
  const memory = getUserMemory(userId);
  return memory.history.slice(-10);
}

function addToHistory(userId, role, content) {
  const memory = getUserMemory(userId);
  memory.history.push({ role, content });
  if (memory.history.length > 20) memory.history.shift();
}

// ================= HELPER: NAME EXTRACTION =================
function extractName(message) {
  const msg = message.trim().toLowerCase();
  
  // 1. Blacklist Sapaan Umum
  const blacklist = ['halo', 'hai', 'p', 'assalamualaikum', 'test', 'tes', 'ping'];
  if (blacklist.includes(msg)) return null;

  // 2. Pola Regex untuk kalimat
  const patterns = [
    /nama\s*saya\s*(.*)/i,
    /saya\s*(.*)/i,
    /panggil\s*saja\s*(.*)/i,
    /^(?:pak|bpk|ibu|bu|mas|mbak|kak)\s+(.*)/i
  ];

  for (const p of patterns) {
    const match = message.match(p);
    if (match && match[1]) return match[1].trim();
  }

  // 3. Fallback: Jika input pendek (1-3 kata) asumsikan itu Nama
  const words = message.trim().split(/\s+/);
  if (words.length <= 3) {
    return message.trim();
  }

  return null;
}

// ================= INTENT =================
const INTENTS = {
  harga: {
    keywords: ['harga', 'biaya', 'berapa', 'tarif'],
    answer: 'Untuk harga, kami punya beberapa paket terbaik. Mau saya rekomendasikan yang paling cocok? 😊'
  },
  paket: {
    keywords: ['paket', 'layanan'],
    answer: 'Kami punya beberapa pilihan paket. Mau saya jelaskan paket paling populer dulu?'
  }
};

function matchIntent(msg = '') {
  const lowerMsg = msg.toLowerCase();
  for (const intent of Object.values(INTENTS)) {
    if (intent.keywords.some(k => lowerMsg.includes(k))) return intent.answer;
  }
  return null;
}

// ================= CONFIG & API =================
async function getConfig(req) {
  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/get-config`);
    return await res.json();
  } catch (err) {
    console.error("Config fetch error:", err.message);
    return {};
  }
}

async function saveLead(data) {
  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    await fetch(`${baseUrl}/api/save-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (err) {
    console.error("Lead save error:", err.message);
  }
}

// ================= AI CORE =================
async function generateAIReply(message, req, userId) {
  try {
    const config = await getConfig(req);
    const memory = getUserMemory(userId);
    const produk = await getProduk();

    const produkText = produk.length
      ? produk.map(p => `Paket: ${p["Nama Paket"]}\nHarga: ${p["Harga"]}\nKet: ${p["Deskripsi"]}`).join('\n---\n')
      : 'Data produk tidak tersedia';

    // Perbaikan Prompt: Menggunakan Nama sebagai kata ganti
    const systemPrompt = buildPrompt(config) + `
USER CONTEXT:
- Nama Customer: ${memory.name || 'Belum diketahui'}

ATURAN KOMUNIKASI:
1. Jika nama customer sudah diketahui (${memory.name}), WAJIB memanggil dengan nama tersebut di setiap kalimat (contoh: "Baik Kak ${memory.name}", "Silakan dipilih Kak ${memory.name}").
2. DILARANG menggunakan kata ganti "Anda" atau "Kamu". Ganti dengan "Kak ${memory.name}".
3. Jika nama belum diketahui, panggil dengan "Kakak".
4. Gunakan gaya bahasa tenang, fokus pada alur bisnis yang sehat, dan tidak menggurui.

DATA PRODUK:
${produkText}
`;

    const history = getUserHistory(userId);
    addToHistory(userId, 'user', message);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      max_tokens: 200
    });

    let reply = completion?.choices?.[0]?.message?.content || '';
    addToHistory(userId, 'assistant', reply);

    // Smart Closing
    const wa = config.kontak_whatsapp;
    if (wa) {
      const msg = message.toLowerCase();
      const isWarm = ['mau', 'minat', 'tanya', 'berapa', 'pesan', 'order'].some(w => msg.includes(w));
      const userName = memory.name || 'Customer';

      if (isWarm) {
        const waLink = generateWALink(wa, `Halo, saya ${userName}. Mau info/pesan aqiqah.`);
        reply += `\n\n👉 Kak ${userName}, bisa lanjut konsultasi via WhatsApp di sini ya:\n${waLink}`;
        await saveLead({ name: userName, message, status: 'warm' });
      }
    }

    return reply;
  } catch (error) {
    console.error('AI error:', error.message);
    return null;
  }
}

// ================= MAIN PROCESSOR =================
async function processMessage(message, req, userId) {
  try {
    if (!message) return { reply: 'Silakan ketik pertanyaan ya 😊', source: 'empty' };

    const memory = getUserMemory(userId);
    const detectedName = extractName(message);

    // Logika Handle Nama (Jika bot baru tanya nama atau user baru lapor nama)
    if (detectedName && !memory.name) {
      memory.name = detectedName;
      const reply = `Halo Kak ${detectedName} 😊 Senang berkenalan! Kakak sedang mencari paket aqiqah untuk anak laki-laki atau perempuan?`;
      addToHistory(userId, 'assistant', reply);
      
      await saveLead({ name: detectedName, message, status: 'identified' });
      return { reply, source: 'name' };
    }

    // Default Tracking
    await saveLead({ name: memory.name || '-', message, status: 'chat' });

    // FAQ Check
    const faq = await getFAQ(message);
    if (faq?.answer) {
      addToHistory(userId, 'assistant', faq.answer);
      return { reply: faq.answer, source: 'faq' };
    }

    // Intent Check
    const intent = matchIntent(message);
    if (intent) {
      addToHistory(userId, 'assistant', intent);
      return { reply: intent, source: 'intent' };
    }

    // AI Reply
    const aiReply = await generateAIReply(message, req, userId);
    return { reply: aiReply || 'Maaf, ada kendala teknis. Coba lagi ya 🙏', source: aiReply ? 'ai' : 'error' };

  } catch (error) {
    console.error('Process error:', error.message);
    return { reply: 'Terjadi kesalahan sistem 🙏', source: 'error' };
  }
}

// ================= HANDLER (VERCEL) =================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const userId = getUserId(req);
    const { message } = req.body || {};
    const result = await processMessage(message, req, userId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
