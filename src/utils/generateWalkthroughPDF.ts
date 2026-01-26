import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { walkthroughChecklist, type ChecklistItemResult } from '../data/walkthroughChecklist';

interface PropertyInfo {
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  serialNumber?: string;
  model?: string;
}

interface WalkthroughData {
  property: PropertyInfo;
  results: Record<string, ChecklistItemResult>;
  customerSignature?: string;
  completedAt: string;
  technicianName: string;
}

export function generateWalkthroughPDF(data: WalkthroughData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Walk-Through Inspection Report', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Nobility Homes', pageWidth / 2, 28, { align: 'center' });
  
  // Property Info
  doc.setFontSize(10);
  let y = 40;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Customer:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.property.customerName, 50, y);
  
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Address:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.property.address}, ${data.property.city}, ${data.property.state} ${data.property.zip}`, 50, y);
  
  if (data.property.serialNumber) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Serial #:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.property.serialNumber, 50, y);
  }
  
  if (data.property.model) {
    doc.setFont('helvetica', 'bold');
    doc.text('Model:', 100, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.property.model, 120, y);
  }
  
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.completedAt).toLocaleDateString(), 50, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Technician:', 100, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.technicianName, 130, y);
  
  y += 10;
  
  // Summary
  const totalItems = walkthroughChecklist.reduce((sum, room) => sum + room.items.length, 0);
  const okItems = Object.values(data.results).filter(r => r.status === 'ok').length;
  const issueItems = Object.values(data.results).filter(r => r.status === 'issue').length;
  const pendingItems = totalItems - okItems - issueItems;
  
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y, pageWidth - 28, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text(`Summary: ${okItems} OK | ${issueItems} Issues | ${pendingItems} Not Checked`, 18, y + 8);
  
  y += 20;
  
  // Room-by-room results
  walkthroughChecklist.forEach((room) => {
    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    
    const roomResults = room.items.map(item => {
      const result = data.results[item.id];
      return {
        item: item.label,
        status: result?.status === 'ok' ? '✓ OK' : result?.status === 'issue' ? '✗ ISSUE' : '- N/A',
        notes: result?.notes || '',
      };
    });
    
    const hasIssues = roomResults.some(r => r.status === '✗ ISSUE');
    
    // Room header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(hasIssues ? 180 : 0, hasIssues ? 0 : 100, hasIssues ? 0 : 0);
    doc.text(room.name + (hasIssues ? ' ⚠' : ''), 14, y);
    doc.setTextColor(0, 0, 0);
    
    y += 4;
    
    // Room items table
    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
      startY: y,
      head: [['Item', 'Status', 'Notes']],
      body: roomResults.map(r => [r.item, r.status, r.notes]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [60, 60, 60], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 20 },
        2: { cellWidth: 'auto' },
      },
      didParseCell: (hookData: { section: string; column: { index: number }; cell: { text: string[]; styles: { textColor: number[] } } }) => {
        if (hookData.section === 'body' && hookData.column.index === 1) {
          const text = hookData.cell.text[0];
          if (text === '✓ OK') {
            hookData.cell.styles.textColor = [0, 128, 0];
          } else if (text === '✗ ISSUE') {
            hookData.cell.styles.textColor = [200, 0, 0];
          }
        }
      },
    });
    
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  });
  
  // Issues Summary
  const issues = Object.entries(data.results)
    .filter(([_, r]) => r.status === 'issue')
    .map(([itemId, r]) => {
      const room = walkthroughChecklist.find(room => 
        room.items.some(item => item.id === itemId)
      );
      const item = room?.items.find(i => i.id === itemId);
      return {
        location: `${room?.name} - ${item?.label}`,
        notes: r.notes || 'Issue noted',
      };
    });
  
  if (issues.length > 0) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(180, 0, 0);
    doc.text('Issues Requiring Attention', 14, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
    
    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
      startY: y,
      head: [['#', 'Location', 'Description']],
      body: issues.map((issue, i) => [String(i + 1), issue.location, issue.notes]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [180, 0, 0] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 50 },
        2: { cellWidth: 'auto' },
      },
    });
    
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }
  
  // Signature
  if (data.customerSignature) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Customer Signature:', 14, y);
    
    // Add signature image
    try {
      doc.addImage(data.customerSignature, 'PNG', 14, y + 2, 60, 20);
    } catch {
      doc.text('[Signature on file]', 14, y + 10);
    }
    
    doc.text('_________________________', 14, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.text(data.property.customerName, 14, y + 30);
    doc.text(new Date(data.completedAt).toLocaleDateString(), 14, y + 35);
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated by FieldSync | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  return doc;
}

export function downloadWalkthroughPDF(data: WalkthroughData, filename?: string) {
  const doc = generateWalkthroughPDF(data);
  const name = filename || `walkthrough-${data.property.customerName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(name);
}
