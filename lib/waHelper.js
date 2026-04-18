export function generateWALink(phone, message) {
  if (!phone) return '';

  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMsg = encodeURIComponent(message);

  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}
