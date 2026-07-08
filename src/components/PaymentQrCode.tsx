import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { generateSpaydString } from '../utils/spayd';
import { Share2, Download, Check, AlertTriangle } from 'lucide-react';

interface PaymentQrCodeProps {
  amount: number;
  name?: string;
  message: string;
  vs: string;
  payingNames?: string[];
}

export const PaymentQrCode: React.FC<PaymentQrCodeProps> = ({
  amount,
  name,
  message,
  vs,
  payingNames
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Load bank account from .env
  const bankAccount = import.meta.env.VITE_BANK_ACCOUNT || '';
  const ownerName = import.meta.env.VITE_BANK_OWNER_NAME || '';

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
        vs,
        message,
        recipientName: ownerName || undefined,
      });

      // Render the QR code to an offscreen canvas first
      const qrCanvas = document.createElement('canvas');
      const scale = 4; // High resolution scale factor for premium crispness

      QRCode.toCanvas(qrCanvas, spaydStr, {
        width: 240 * scale,
        margin: 2,
        color: {
          dark: '#000000', // Black color
          light: '#ffffff'
        }
      }, (err) => {
        if (err) {
          console.error(err);
          setError('Chyba generování QR kódu... Radši zaplať hotově!');
        } else {
          const mainCanvas = canvasRef.current;
          if (mainCanvas) {
            const ctx = mainCanvas.getContext('2d');
            if (ctx) {
              const namesText = payingNames && payingNames.length > 0
                ? payingNames.join(', ')
                : (name ? name : '');

              if (namesText) {
                // Setup font for text wrapping measurement (scaled)
                ctx.font = `bold ${13 * scale}px sans-serif`;

                const words = namesText.split(', ');
                const lines: string[] = [];
                let currentLine = '';
                const maxWidth = 220 * scale; // 240 - 20px padding (scaled)

                for (let i = 0; i < words.length; i++) {
                  const testLine = currentLine + (currentLine ? ', ' : '') + words[i];
                  const metrics = ctx.measureText(testLine);
                  if (metrics.width > maxWidth && i > 0) {
                    lines.push(currentLine);
                    currentLine = words[i];
                  } else {
                    currentLine = testLine;
                  }
                }
                if (currentLine) {
                  lines.push(currentLine);
                }

                // Layout measurements (scaled)
                const qrSize = 240 * scale;
                const headerHeight = 14 * scale;
                const padding = 12 * scale;
                const spacing = 4 * scale;
                const lineHeight = 16 * scale;
                const textSectionHeight = padding + headerHeight + spacing + (lines.length * lineHeight) + padding;

                mainCanvas.width = 240 * scale;
                mainCanvas.height = qrSize + textSectionHeight;

                // Fill white background (must be done after changing dimensions!)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

                // Draw QR Code
                ctx.drawImage(qrCanvas, 0, 0);

                // Draw thin line separator (scaled)
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1 * scale;
                ctx.beginPath();
                ctx.moveTo(10 * scale, qrSize);
                ctx.lineTo(230 * scale, qrSize);
                ctx.stroke();

                // Draw label "KDO PLATÍ:" (scaled)
                ctx.fillStyle = '#718096';
                ctx.font = `900 ${11 * scale}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText('KDO PLATÍ:', 120 * scale, qrSize + padding);

                // Draw names (scaled & colored black)
                ctx.fillStyle = '#000000'; // Black color as requested
                ctx.font = `bold ${13 * scale}px sans-serif`;
                for (let i = 0; i < lines.length; i++) {
                  ctx.fillText(lines[i], 120 * scale, qrSize + padding + headerHeight + spacing + (i * lineHeight));
                }
              } else {
                // If there's no name, just render the standard QR size
                mainCanvas.width = 240 * scale;
                mainCanvas.height = 240 * scale;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
                ctx.drawImage(qrCanvas, 0, 0);
              }

              setDataUrl(mainCanvas.toDataURL('image/png'));
            }
          }
        }
      });
    } catch (err: any) {
      setError(err.message || 'Neplatné platební údaje.');
    }
  }, [amount, name, bankAccount, message, vs, payingNames]);

  const handleShare = async () => {
    const formattedAmount = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
    const shareText = name 
      ? `Čau! Posílám výpalné za divokou jízdu se Sárek Expressem. Můj dluh dělá: ${formattedAmount} Kč. Pošli to na účet ${bankAccount} se zprávou: ${message} - ${name}`
      : `Čau! Posílám náš společný dluh za palivo ze Sárek Expressu. Každý cáluje: ${formattedAmount} Kč na účet ${bankAccount} se zprávou: ${message}`;
      
    if (navigator.share) {
      try {
        if (dataUrl) {
          const blob = await (await fetch(dataUrl)).blob();
          const fileName = name ? `qr_${name.toLowerCase().replace(/\s+/g, '_')}.png` : 'qr_platba.png';
          const file = new File([blob], fileName, { type: 'image/png' });
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Výpalné za jízdu (SÁREK EXPRESS)',
              text: shareText,
              files: [file]
            });
            return;
          }
        }

        // Fallback to text-only share
        await navigator.share({
          title: 'Výpalné za jízdu (SÁREK EXPRESS)',
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
      } catch {
        alert('Kopírování selhalo.');
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (navigator.share && dataUrl) {
      // On mobile devices, using Web Share API allows saving directly to Photos / Gallery via the share sheet.
      // This prevents the browser from just opening the raw base64 data in a new tab.
      e.preventDefault();
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const fileName = name ? `qr_${name.toLowerCase().replace(/\s+/g, '_')}.png` : 'qr_platba.png';
        const file = new File([blob], fileName, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file]
          });
          return;
        }
      } catch (err) {
        console.error('Error sharing for download:', err);
      }
    }
    // Fallback: standard download anchor behavior (e.g. on Desktop)
  };

  if (error) {
    return (
      <div className="qr-section">
        <AlertTriangle size={36} color="var(--accent-red)" />
        <p className="text-accent" style={{ fontSize: 15, fontWeight: 'bold', marginTop: 10, color: 'var(--accent-red)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="qr-section fade-in">
      <h4 style={{ marginBottom: 12, fontSize: 18, textTransform: 'uppercase', color: 'var(--volvo-blue)' }}>
        {name 
          ? (name.startsWith('Běžní') ? name : `VIP DLUŽNÍK: ${name}`)
          : 'SPOLEČNÉ CÁLOVÁNÍ (ROVNÝ)'
        }
      </h4>
      <div className="qr-canvas-wrapper">
        <canvas ref={canvasRef} style={{ display: 'block', width: '240px', height: 'auto', maxWidth: '100%' }}></canvas>
      </div>
      <p style={{ fontSize: 28, fontWeight: '800', color: 'var(--volvo-blue)', marginBottom: 16 }}>
        {amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)} Kč
      </p>
      <div className="qr-actions">
        <button type="button" className="btn-racing btn-racing-secondary" onClick={handleShare}>
          {copied ? <Check size={16} color="var(--accent-green)" /> : <Share2 size={16} />}
          <span>{copied ? 'Kopírováno!' : 'Sdílet dluh'}</span>
        </button>
        {dataUrl && (
          <a 
            href={dataUrl} 
            download={name ? `pay_way_qr_${name.toLowerCase()}.png` : 'pay_way_qr_shared.png'}
            className="btn-racing btn-racing-cyan"
            onClick={handleDownload}
            style={{ textDecoration: 'none' }}
          >
            <Download size={16} />
            <span>Stáhnout QR</span>
          </a>
        )}
      </div>
    </div>
  );
};
