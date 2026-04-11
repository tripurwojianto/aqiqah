import axios from 'axios';
import Papa from 'papaparse';

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmbGVfBay3h9jV-lxFREe0kq1S6vTyhq-ELVlq6eBJcA_eDCGxVpEhbArxToCZFu5Ppxhzj5u9AUI_/pub?output=csv";

export default async function handler(req, res) {
  try {
    const response = await axios.get(SHEET_CSV_URL);
    const csvData = response.data;

    // Parsing CSV ke JSON agar rapi
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });

    // Mengubah hasil parse menjadi format Key-Value
    const config = {};
    parsed.data.forEach(row => {
      if (row.Key && row.Value) {
        config[row.Key.trim()] = row.Value.trim();
      }
    });

    res.status(200).json(config);
  } catch (error) {
    console.error("Error fetching sheet:", error);
    res.status(500).json({ error: "Gagal mengambil data dari Google Sheets" });
  }
}
