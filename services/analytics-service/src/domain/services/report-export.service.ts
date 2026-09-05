import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

export interface ExportFile {
  id: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  createdAt: Date;
  expiresAt: Date;
}

export class ReportExportService {
  private fileCache = new Map<string, ExportFile>();

  /**
   * Export report data to PDF format.
   */
  async exportPdf(title: string, data: any[]): Promise<ExportFile> {
    const id = crypto.randomUUID();
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const file: ExportFile = {
          id,
          filename: `${title.toLowerCase().replace(/\s+/g, '-')}-${id.slice(0, 8)}.pdf`,
          mimeType: 'application/pdf',
          buffer,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        };
        this.fileCache.set(id, file);
        resolve(file);
      });
      doc.on('error', reject);

      // PDF Content
      doc.fontSize(20).text('DealFlow360 — Analytics Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated at: ${new Date().toISOString()}`, { align: 'right' });
      doc.moveDown();

      if (data.length === 0) {
        doc.fontSize(12).text('No records found for the selected period.', { align: 'center' });
      } else {
        const headers = Object.keys(data[0] || {}).slice(0, 5);
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(headers.join('   |   '));
        doc.font('Helvetica');
        doc.moveDown(0.5);

        for (const row of data.slice(0, 100)) {
          const line = headers.map((h) => String(row[h] ?? '')).join('   |   ');
          doc.fontSize(9).text(line);
        }
      }

      doc.end();
    });
  }

  /**
   * Export report data to XLS/XLSX format.
   */
  async exportXls(title: string, data: any[]): Promise<ExportFile> {
    const id = crypto.randomUUID();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const file: ExportFile = {
      id,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}-${id.slice(0, 8)}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    this.fileCache.set(id, file);
    return file;
  }

  getFile(id: string): ExportFile | null {
    const file = this.fileCache.get(id);
    if (!file) return null;
    if (new Date() > file.expiresAt) {
      this.fileCache.delete(id);
      return null;
    }
    return file;
  }
}
