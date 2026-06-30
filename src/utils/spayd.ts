export function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9\s.,/\-+=?@$]/g, ''); // Keep only basic symbols and letters
}

export function cleanBankAccount(accountStr: string): string {
  const cleaned = accountStr.replace(/\s+/g, '');
  
  // If it already looks like an IBAN, return it uppercase
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{12,30}$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  
  // Parse standard CZ account number: (prefix-)accountNumber/bankCode
  const match = cleaned.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!match) return '';
  
  const prefix = (match[1] || '0').padStart(6, '0');
  const accNum = match[2].padStart(10, '0');
  const bankCode = match[3];
  
  // Country code CZ is converted to numeric 1235, plus 00 checksum suffix
  const numericStr = `${bankCode}${prefix}${accNum}123500`;
  
  // String modulo-97 implementation to avoid float overflow
  let checksum = 0;
  for (let i = 0; i < numericStr.length; i++) {
    checksum = (checksum * 10 + parseInt(numericStr[i], 10)) % 97;
  }
  
  const checkDigits = String(98 - checksum).padStart(2, '0');
  return `CZ${checkDigits}${bankCode}${prefix}${accNum}`;
}

export interface SpaydParams {
  accountNumber: string;
  amount: number;
  message?: string;
  vs?: string;
}

export function generateSpaydString(params: SpaydParams): string {
  const iban = cleanBankAccount(params.accountNumber);
  if (!iban) {
    throw new Error('Invalid bank account number');
  }
  
  const parts = [
    'SPD',
    '1.0',
    `ACC:${iban}`,
    `AM:${params.amount.toFixed(2)}`,
    'CC:CZK'
  ];
  
  if (params.message) {
    const cleanMsg = removeDiacritics(params.message).substring(0, 140);
    if (cleanMsg.trim()) {
      parts.push(`MSG:${cleanMsg.trim()}`);
    }
  }
  
  if (params.vs) {
    const cleanVs = params.vs.replace(/\D/g, '').substring(0, 10);
    if (cleanVs) {
      parts.push(`VS:${cleanVs}`);
    }
  }
  
  return parts.join('*');
}
