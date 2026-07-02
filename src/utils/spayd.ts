export function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z0-9\s.,/\-+=?@$]/g, ''); // Keep only basic symbols and letters
}

// BIC/SWIFT lookup for common Czech banks
const CZECH_BANK_BIC: Record<string, string> = {
  '0100': 'KOMBCZPP', // Komerční banka
  '0300': 'CEKOCZPP', // ČSOB
  '0600': 'AGBACZPP', // GE Money / Moneta
  '0710': 'CNBACZPP', // ČNB
  '0800': 'GIBACZPX', // Česká spořitelna
  '2010': 'FIOBCZPP', // Fio banka
  '2020': 'BOTKCZPP', // Bank of Tokyo (MUFG)
  '2060': 'CITFCZPP', // Citfin
  '2700': 'BACXCZPP', // UniCredit Bank
  '3030': 'AABBCZPP', // Air Bank
  '3050': 'BPPFCZP1', // BNP Paribas
  '4000': 'EXPNCZPP', // Expobank
  '5500': 'RZBCCZPP', // Raiffeisenbank
  '6000': 'PMBPCZPP', // PPF banka
  '6100': 'EQBKCZPP', // Equa bank
  '6200': 'COBACZPP', // COMMERZBANK
  '6210': 'BREXCZPP', // mBank
  '6300': 'GEBACZPP', // Moneta Money Bank (old GE)
  '7940': 'SPWTCZ21', // Waldviertler Sparkasse
  '7960': 'BRAACZBB', // Poštovní spořitelna
  '7970': 'INGBCZPP', // ING Bank
  '7990': 'MERYCZ21', // Mercuria
  '8030': 'GENOCZ21', // Generali Bank
  '8040': 'OBKLCZ2X', // OberBank
  '8060': 'BFSWDE33', // BFS Finance
  '8090': 'CZEECZPP', // Česká exportní banka
  '8150': 'MIDLCZPP', // HSBC
  '8200': 'FAABCZPP', // FAAB banka
  '8220': 'PAERCZP1', // Payment Exchange
  '8230': 'GEBACZPP', // CREDITAS
  '8250': 'BKCHCZPP', // Bank of China
  '8255': 'DOWJCZPP', // Downing
  '8265': 'ICBKCZPP', // ICBC
  '8270': 'ABNACZPP', // ABN AMRO
};

export function cleanBankAccount(accountStr: string): { iban: string; bic: string } {
  const cleaned = accountStr.replace(/\s+/g, '');

  // If it already looks like an IBAN, return it uppercase
  // For CZ IBANs (CZ + 2 check digits + 4-digit bank code + ...) extract BIC from bank code
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{12,30}$/i.test(cleaned)) {
    const upper = cleaned.toUpperCase();
    // CZ IBAN: CZ XX BBBB PPPPPP AAAAAAAAAA — bank code is chars [4..7]
    const bic = upper.startsWith('CZ') ? (CZECH_BANK_BIC[upper.slice(4, 8)] || '') : '';
    return { iban: upper, bic };
  }

  // Parse standard CZ account number: (prefix-)accountNumber/bankCode
  const match = cleaned.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!match) return { iban: '', bic: '' };

  const prefix = (match[1] || '0').padStart(6, '0');
  const accNum = match[2].padStart(10, '0');
  const bankCode = match[3];
  const bic = CZECH_BANK_BIC[bankCode] || '';

  // Country code CZ is converted to numeric 1235, plus 00 checksum suffix
  const numericStr = `${bankCode}${prefix}${accNum}123500`;

  // String modulo-97 implementation to avoid float overflow
  let checksum = 0;
  for (let i = 0; i < numericStr.length; i++) {
    checksum = (checksum * 10 + parseInt(numericStr[i], 10)) % 97;
  }

  const checkDigits = String(98 - checksum).padStart(2, '0');
  return { iban: `CZ${checkDigits}${bankCode}${prefix}${accNum}`, bic };
}

export interface SpaydParams {
  accountNumber: string;
  amount: number;
  message?: string;
  vs?: string;
  recipientName?: string;
}

export function generateSpaydString(params: SpaydParams): string {
  const { iban, bic } = cleanBankAccount(params.accountNumber);
  if (!iban) {
    throw new Error('Invalid bank account number');
  }

  // ACC field: IBAN+BIC if BIC known, otherwise just IBAN
  const accField = bic ? `${iban}+${bic}` : iban;

  const parts = [
    'SPD',
    '1.0',
    `ACC:${accField}`,
    `AM:${params.amount.toFixed(2)}`,
    'CC:CZK'
  ];

  // RN = Recipient Name — displayed in banking apps when scanning QR
  if (params.recipientName) {
    const cleanName = removeDiacritics(params.recipientName).substring(0, 35);
    if (cleanName.trim()) {
      parts.push(`RN:${cleanName.trim()}`);
    }
  }
  
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
