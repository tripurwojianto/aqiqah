import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  try {
    const { name, message, status } = req.body;

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(
      process.env.GOOGLE_SHEET_ID,
      auth
    );

    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['History Chat'];

    await sheet.addRow({
      nama: name || '-',
      pesan: message,
      status: status,
      waktu: new Date().toISOString()
    });

    res.status(200).json({ success: true });

  } catch (err) {
    console.error("Save lead error:", err.message);
    res.status(500).json({ error: 'Gagal simpan lead' });
  }
}
