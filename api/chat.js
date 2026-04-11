import { OpenAI } from 'openai';
import axios from 'axios';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) { // <--- req lahir di sini
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { message, state } = req.body;

    // PINDAHKAN BARIS INI KE DALAM SINI (DI BAWAH TRY)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const CONFIG_URL = `${protocol}://${host}/api/config`; 

    // 1. Ambil instruksi dari Google Sheets via API Config
    const configRes = await axios.get(CONFIG_URL);
    
    // ... sisa kode Bapak ...
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
