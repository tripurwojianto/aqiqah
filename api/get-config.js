// api/get-config.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  // Disable cache (biar selalu fresh)
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    // Validasi ENV dulu (biar tidak silent error)
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      throw new Error('ENV Google Sheets belum lengkap');
    }

    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const doc = new GoogleSpreadsheet(
      process.env.GOOGLE_SHEET_ID,
      serviceAccountAuth
    );

    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0]; // tab pertama
    const rows = await sheet.getRows();

    if (!rows || rows.length === 0) {
      throw new Error('Sheet kosong');
    }

    const config = {};

    rows.forEach(row => {
      // Lebih aman pakai properti langsung (bukan get)
      const key = row.Key?.trim();
      const value = row.Value?.trim();

      if (key && value) {
        config[key] = value;
      }
    });

    if (Object.keys(config).length === 0) {
      throw new Error('Kolom Key/Value tidak ditemukan atau kosong');
    }

    return res.status(200).json(config);

  } catch (error) {
    console.error('Google Sheets Config Error:', error.message);

    return res.status(500).json({
      error: 'Gagal ambil config',
      details: error.message
    });
  }
}
