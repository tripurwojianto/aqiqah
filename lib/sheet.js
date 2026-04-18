import fetch from 'node-fetch';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmbGVfBay3h9jV-lxFREe0kq1S6vTyhq-ELVlq6eBJcA_eDCGxVpEhbArxToCZFu5Ppxhzj5u9AUI_/pub?output=csv';

// Helper: parsing CSV sederhana (lebih aman dari koma dalam teks)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export async function getFAQ(msg = '') {
  try {
    if (!msg) return null;

    const response = await fetch(SHEET_URL);
    const csv = await response.text();

    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;

    // Parse header
    const headers = parseCSVLine(lines[0]);
    const questionIndex = headers.indexOf('question');
    const answerIndex = headers.indexOf('answer');
    const keywordsIndex = headers.indexOf('keywords');

    if (questionIndex === -1 || answerIndex === -1 || keywordsIndex === -1) {
      console.error('Header tidak sesuai. Harus ada: question, answer, keywords');
      return null;
    }

    // Parse data
    const faqs = lines.slice(1).map(line => {
      const cols = parseCSVLine(line);

      return {
        question: cols[questionIndex] || '',
        answer: cols[answerIndex] || '',
        keywords: cols[keywordsIndex] || ''
      };
    });

    const lowerMsg = msg.toLowerCase();

    for (const faq of faqs) {
      const keywords = faq.keywords
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(Boolean);

      if (keywords.some(k => lowerMsg.includes(k))) {
        return {
          question: faq.question,
          answer: faq.answer
        };
      }
    }

    return null;

  } catch (error) {
    console.error('Error fetching/parsing FAQ:', error.message);
    return null;
  }
}
