import axios from 'axios';
import Papa from 'papaparse';

const URL = 'LINK CSV SHEET PRODUK KAMU';

export async function getProduk() {
  try {
    const res = await axios.get(URL);
    const parsed = Papa.parse(res.data, {
      header: true,
      skipEmptyLines: true
    });

    return parsed.data;
  } catch (err) {
    console.error('Produk error:', err.message);
    return [];
  }
}
