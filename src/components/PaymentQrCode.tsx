import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { generateSpaydString } from '../utils/spayd';
import { Share2, Download, Check } from 'lucide-react';
import { PixelAlert } from './PixelIcons';

interface PaymentQrCodeProps {
  amount: number;
  name?: string;
  message: string;
  vs: string;
}

export const PaymentQrCode: React.FC<PaymentQrCodeProps> = ({
  amount,
  name,
  message,
  vs
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Load bank account from .env
  const bankAccount = import.meta.env.VITE_BANK_ACCOUNT || '';

  useEffect(() => {
    if (!bankAccount) {
      setError('Chybí číslo bankovního účtu v souboru .env! QR kód nelze vygenerovat.');
      return;
    }
    setError('');

    try {
      const spaydStr = generateSpaydString({
        accountNumber: bankAccount,
        amount,
        message: name ? `${message} - ${name}` : message,
        vs
      });

      // Clear previous canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      QRCode.toCanvas(canvasRef.current, spaydStr, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0b0716', // Match retro night primary theme color
          light: '#ffffff'
        }
      }, (err) => {
        if (err) {
          console.error(err);
          setError('Nepodařilo se vygenerovat QR kód.');
        } else {
          if (canvasRef.current) {
            setDataUrl(canvasRef.current.toDataURL('image/png'));
          }
        }
      });
    } catch (err: any) {
      setError(err.message || 'Neplatné platební údaje.');
    }
  }, [amount, name, bankAccount, message, vs]);

  const handleShare = async () => {
    const shareText = name 
      ? `Ahoj, posílám podíl za cestu: ${amount.toFixed(2)} Kč na účet ${bankAccount}. Zpráva: ${message} - ${name}`
      : `Ahoj, posílám společný podíl za cestu: ${amount.toFixed(2)} Kč na účet ${bankAccount}. Zpráva: ${message}`;
      
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Platba cesty (VOLVO EXPRESS)',
          text: shareText,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        alert('Kopírování selhalo.');
      }
    }
  };

  if (error) {
    return (
      <div className="qr-section">
        <PixelAlert size={36} />
        <p className="text-accent" style={{ fontSize: 15, fontWeight: 'bold', marginTop: 10 }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="qr-section fade-in">
      <h4 style={{ marginBottom: 12, fontSize: 26, textTransform: 'uppercase', color: 'var(--accent-purple)' }}>
        {name 
          ? `PODÍL: ${name}`
          : 'SPOLEČNÝ PODÍL (ROVNÝ)'
        }
      </h4>
      <div className="qr-canvas-wrapper">
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }}></canvas>
      </div>
      <p className="text-yellow" style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 16, fontFamily: 'var(--font-display)', textShadow: '2px 2px 0px #000' }}>
        {amount.toFixed(2)} Kč
      </p>
      <div className="qr-actions">
        <button type="button" className="btn-racing btn-racing-secondary" onClick={handleShare}>
          {copied ? <Check size={16} className="text-cyan" /> : <Share2 size={16} />}
          <span style={{ fontSize: 20 }}>{copied ? 'Kopírováno!' : 'Sdílet'}</span>
        </button>
        {dataUrl && (
          <a 
            href={dataUrl} 
            download={name ? `pay_way_qr_${name.toLowerCase()}.png` : 'pay_way_qr_shared.png'}
            className="btn-racing btn-racing-cyan"
            style={{ textDecoration: 'none' }}
          >
            <Download size={16} />
            <span style={{ fontSize: 20 }}>Uložit QR</span>
          </a>
        )}
      </div>
    </div>
  );
};
