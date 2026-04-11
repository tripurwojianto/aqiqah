import { OpenAI } from 'openai';
import axios from 'axios';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Pakai cara ini supaya otomatis menyesuaikan alamat web Bapak
const CONFIG_URL = req.headers.host.includes('localhost') 
  ? "http://localhost:3000/api/config" 
  : `https://${req.headers.host}/api/config`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { message, state } = req.body;

    // 1. Ambil instruksi terbaru dari Google Sheets via API Config Bapak
    const configRes = await axios.get(CONFIG_URL);
    const { Persona, instruksi, kontak_wa } = configRes.data;

    // 2. Kirim ke OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Hemat dan pintar
      messages: [
        { 
          role: "system", 
          content: `${Persona}. Instruksi alur: ${instruksi}. Jika closing, arahkan ke: ${kontak_wa}. Status user saat ini: ${JSON.stringify(state)}` 
        },
        { role: "user", content: message }
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;
    res.status(200).json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Aduh, Delisa sedang pusing sebentar kak 🙏" });
  }
}
