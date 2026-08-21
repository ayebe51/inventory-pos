import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

@Injectable()
export class ExportService {
  /**
   * Export to Excel (XLSX)
   * @param columns { header: string, key: string, width?: number }[]
   * @param data Array of objects
   */
  async exportToExcel(columns: any[], data: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    worksheet.columns = columns;
    worksheet.addRows(data);

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export to PDF using pdfmake
   * @param docDefinition Document definition for pdfmake
   */
  async exportToPdf(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const fonts: TFontDictionary = {
          Roboto: {
            normal: 'Helvetica',
            bold: 'Helvetica-Bold',
            italics: 'Helvetica-Oblique',
            bolditalics: 'Helvetica-BoldOblique'
          }
        };

        const printer = new PdfPrinter(fonts);
        // By default pdfmake uses Roboto but since we are running server-side without loading actual font files, 
        // we can map Roboto to standard Helvetica.
        
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];
        
        pdfDoc.on('data', (chunk) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (err) => reject(err));
        
        pdfDoc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
