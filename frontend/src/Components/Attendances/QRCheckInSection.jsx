import { jsPDF } from 'jspdf';
import { Copy, Download, Loader, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useRef, useState } from 'react';
import gymhourLogo from '../../assets/gymhour/logo_gymhour.png';
import './CheckInSections.css';

const QRCheckInSection = ({ publicPath = '/ingreso?source=qr' }) => {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const qrRef = useRef(null);

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return publicPath;
    return new URL(publicPath, window.location.origin).toString();
  }, [publicPath]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const rasterizeImageToPng = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleDownloadPDF = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);

    try {
      const logoDataUrl = await rasterizeImageToPng(gymhourLogo);

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const M = 48;

      const cx = pageW / 2;

      // Logo
      const logoW = 130;
      const logoH = 38;
      doc.addImage(logoDataUrl, 'PNG', cx - logoW / 2, M + 24, logoW, logoH);

      // Separator line
      doc.setDrawColor(220, 220, 220);
      doc.line(M, M + 76, pageW - M, M + 76);

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(50, 50, 50);
      doc.text('Código QR de Ingreso', cx, M + 112, { align: 'center' });

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(120, 120, 120);
      doc.text('Escaneá este código para registrar tu ingreso', cx, M + 136, { align: 'center' });

      // QR code
      const qrSvg = qrRef.current?.querySelector('svg');
      if (qrSvg) {
        const svgString = new XMLSerializer().serializeToString(qrSvg);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const qrDataUrl = await rasterizeImageToPng(svgUrl);
        URL.revokeObjectURL(svgUrl);
        const qrSize = 190;
        doc.addImage(qrDataUrl, 'PNG', cx - qrSize / 2, M + 160, qrSize, qrSize);
      }

      // URL text
      doc.setFontSize(10);
      doc.setTextColor(140, 140, 140);
      doc.text(publicUrl, cx, M + 380, { align: 'center' });

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text('GymHour — Control de Acceso', cx, pageH - M, { align: 'center' });

      doc.save('GymHour_codigoQR_Ingreso.pdf');
    } catch (error) {
      console.error('Error al generar el PDF:', error);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <section className="checkin-section">
      <div className="checkin-section-header">
        <h3>Ingreso por QR</h3>
        <p>Mostrá este QR en recepción para que el alumno ingrese su DNI desde el celular.</p>
      </div>
      <div className="qr-code-panel" ref={qrRef}>
        <QRCodeSVG value={publicUrl} size={210} level="M" includeMargin />
      </div>
      <div className="qr-public-link">
        <QrCode className="qr-link-icon" />
        <span>{publicUrl}</span>
      </div>
      <div className="qr-checkin-controls">
        <button
          type="button"
          className="attendance-primary-action"
          onClick={handleDownloadPDF}
          disabled={pdfLoading}
        >
          {pdfLoading ? <Loader size={18} className="spinning-icon" /> : <Download size={18} />}
          {pdfLoading ? 'Generando PDF...' : 'Descargar PDF'}
        </button>
        <button
          type="button"
          className="attendance-primary-action"
          onClick={handleCopy}
        >
          <Copy size={18} />
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </section>
  );
};

export default QRCheckInSection;
