// api/get-config.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  
  const sheet = doc.sheetsByIndex[0]; // Ambil tab pertama
  const rows = await sheet.getRows();
  
  // Ubah baris Sheets menjadi objek config
  const config = {};
  rows.forEach(row => {
    config[row.get('Key')] = row.get('Value');
  });

  res.status(200).json(config);
}
