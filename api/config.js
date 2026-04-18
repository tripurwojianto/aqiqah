import axios from 'axios';
import Papa from 'papaparse';

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmbGVfBay3h9jV-lxFREe0kq1S6vTyhq-ELVlq6eBJcA_eDCGxVpEhbArxToCZFu5Ppxhzj5u9AUI_/pub?output=csv";

export default async function handler(req, res) {
  // Disable cache (biar selalu fresh dari Google Sheets)
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const response = await axios.get(SHEET_CSV_URL, {
      timeout: 7000,
      responseType: 'text' // pastikan dibaca sebagai text (CSV)
    });

    const csvData = response.data;

    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim() // handle spasi di header
    });

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error("CSV kosong atau gagal parsing");
    }

    const config = {};

    parsed.data.forEach(row => {
      const key = row.Key?.trim();
      const value = row.Value?.trim();

      if (key && value) {
        config[key] = value;
      }
    });

    // Validasi hasil
    if (Object.keys(config).length === 0) {
      throw new Error("Kolom Key/Value tidak ditemukan atau kosong");
    }

    return res.status(200).json(config);

  } catch (error) {
    console.error("Config API Error:", error);

    return res.status(500).json({
      error: "Gagal mengambil data config",
      details: error.message
    });
  }
}
