import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const PRIMARY = [218, 70, 50];      // --primary-color
const TEXT_DARK = [16, 16, 16];
const TEXT_GREY = [110, 110, 110];

const fmtMoney = (v) => `$${Number(v || 0).toLocaleString('es-AR')}`;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Genera y descarga el PDF "Reporte Financiero" del dashboard.
 * @param {object}   params
 * @param {object}   params.kpi          KPIs del dashboard.
 * @param {string}   params.periodoLabel Texto del período (ej "06/2026 – 06/2026" o "Histórico completo").
 * @param {string}   params.aclaracionKpis Línea aclaratoria del alcance de cada KPI.
 * @param {Array<{title:string,node:HTMLElement}>} params.charts Gráficos a capturar (sólo los que tienen datos).
 * @param {string}   params.logoSrc      URL del logo (negro) para el encabezado.
 */
export async function generateFinancialReportPdf({ kpi, periodoLabel, aclaracionKpis, charts = [], logoSrc }) {
  // Forzar tema claro durante la captura → gráficos legibles/imprimibles
  const prevTheme = document.body.getAttribute('data-theme');
  document.body.setAttribute('data-theme', 'light');

  try {
    await wait(60); // dejar repintar con el tema claro

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const margin = 40;
    const headerH = 58;
    const footerH = 28;
    const contentTop = headerH + 18;
    const contentBottom = pageH - footerH - 10;
    const contentW = pageW - margin * 2;

    let y = contentTop;

    // ---- Aclaración de alcance de los KPIs ----
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_GREY);
    const aclaracionLines = doc.splitTextToSize(aclaracionKpis, contentW);
    doc.text(aclaracionLines, margin, y);
    y += aclaracionLines.length * 12 + 8;

    // ---- Tablas de KPIs ----
    const tableOpts = {
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, textColor: TEXT_DARK },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      margin: { top: contentTop, bottom: pageH - contentBottom, left: margin, right: margin },
    };

    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Finanzas (mes corriente)', '']],
      body: [
        ['Ingresos', `${fmtMoney(kpi.totalAmountPaidThisMonth)} (${kpi.quotasPaidThisMonth})`],
        ['Gastos', fmtMoney(kpi.gastosMes)],
        ['Ganancia neta', fmtMoney(kpi.gananciaNetaMes)],
        ['Por cobrar', `${fmtMoney(kpi.totalAmountPendingThisMonth)} (${kpi.quotasPendingThisMonth})`],
        ['Tasa de cobranza', `${kpi.tasaCobranzaMes}%`],
        ['Deuda vencida (acumulada)', `${fmtMoney(kpi.totalAmountOverdue)} (${kpi.quotasOverdue})`],
      ],
    });
    y = doc.lastAutoTable.finalY + 16;

    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Socios', '']],
      body: [
        ['Clientes activos (actual)', String(kpi.totalActiveUsers)],
        ['Altas (mes)', String(kpi.altasMes)],
        ['Reactivaciones (mes)', String(kpi.reactivacionesMes)],
        ['Bajas (mes)', String(kpi.bajasMes)],
        ['Crecimiento neto (mes)', `${kpi.crecimientoNetoMes > 0 ? '+' : ''}${kpi.crecimientoNetoMes}`],
      ],
    });
    y = doc.lastAutoTable.finalY + 22;

    // ---- Gráficos como imagen ----
    for (const chart of charts) {
      if (!chart?.node) continue;
      const canvas = await html2canvas(chart.node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');

      let imgW = contentW;
      let imgH = (canvas.height * imgW) / canvas.width;
      const maxH = contentBottom - contentTop - 20; // reservo el alto del título
      if (imgH > maxH) {
        imgH = maxH;
        imgW = (canvas.width * imgH) / canvas.height;
      }

      const blockH = 20 + imgH;
      if (y + blockH > contentBottom) {
        doc.addPage();
        y = contentTop;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...TEXT_DARK);
      doc.text(chart.title, margin, y + 12);
      y += 20;

      const x = margin + (contentW - imgW) / 2;
      doc.addImage(imgData, 'PNG', x, y, imgW, imgH);
      y += imgH + 22;
    }

    // ---- Encabezado + pie en cada hoja ----
    let logo = null;
    try {
      if (logoSrc) logo = await loadImage(logoSrc);
    } catch {
      logo = null;
    }

    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);

      // Header: izquierda período · centro título · derecha logo
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_GREY);
      doc.text(periodoLabel, margin, 34);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(...TEXT_DARK);
      doc.text('Reporte Financiero', pageW / 2, 34, { align: 'center' });

      if (logo) {
        const logoH = 26;
        const logoW = (logo.width / logo.height) * logoH;
        doc.addImage(logo, 'PNG', pageW - margin - logoW, 16, logoW, logoH);
      }

      // Línea divisoria del header
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(margin, headerH, pageW - margin, headerH);

      // Footer: número de página
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_GREY);
      doc.text(`Página ${i} de ${total}`, pageW / 2, pageH - 14, { align: 'center' });
    }

    const today = new Date().toISOString().slice(0, 10);
    doc.save(`reporte-financiero-${today}.pdf`);
  } finally {
    // Restaurar el tema original
    if (prevTheme) document.body.setAttribute('data-theme', prevTheme);
    else document.body.removeAttribute('data-theme');
  }
}
