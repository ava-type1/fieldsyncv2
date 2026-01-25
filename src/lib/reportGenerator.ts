import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Property,
  Customer,
  Phase,
  ChecklistItem,
  Photo,
  Issue,
  Material,
  MaterialsList,
  User,
} from '../types';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

// Colors matching FieldSync brand
const COLORS = {
  primary: [37, 99, 235] as [number, number, number], // primary-600
  secondary: [107, 114, 128] as [number, number, number], // gray-500
  success: [34, 197, 94] as [number, number, number], // green-500
  warning: [234, 179, 8] as [number, number, number], // yellow-500
  danger: [239, 68, 68] as [number, number, number], // red-500
  text: [17, 24, 39] as [number, number, number], // gray-900
  lightGray: [243, 244, 246] as [number, number, number], // gray-100
};

interface ReportConfig {
  companyName?: string;
  companyLogo?: string; // base64 or URL
  includePhotos?: boolean;
  includeSignatures?: boolean;
}

type SeverityType = 'low' | 'medium' | 'high' | 'critical';

/**
 * Format date for display in reports
 */
function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for display
 */
function formatDateTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get full address string
 */
function getFullAddress(property: Property): string {
  const parts = [property.street];
  if (property.unit) parts.push(`Unit ${property.unit}`);
  parts.push(`${property.city}, ${property.state} ${property.zip}`);
  return parts.join(', ');
}

/**
 * Add company header to PDF
 */
function addHeader(doc: jsPDF, config: ReportConfig, title: string): number {
  let yPos = 20;

  // Company logo placeholder (left side)
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(20, 15, 40, 20, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  doc.text('COMPANY LOGO', 40, 27, { align: 'center' });

  // Company name (or default)
  const companyName = config.companyName || 'FieldSync';
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 70, 28);

  // Report title
  yPos = 50;
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.text);
  doc.text(title, 20, yPos);

  // Divider line
  yPos += 5;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.line(20, yPos, 190, yPos);

  return yPos + 10;
}

/**
 * Add property details section
 */
function addPropertyDetails(
  doc: jsPDF,
  property: Property,
  customer: Customer | undefined,
  startY: number
): number {
  let yPos = startY;

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Property Information', 20, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const details = [
    ['Address:', getFullAddress(property)],
    ['Customer:', customer ? `${customer.firstName} ${customer.lastName}` : 'N/A'],
    ['Phone:', customer?.phone || 'N/A'],
    ['Manufacturer:', property.manufacturer || 'N/A'],
    ['Model:', property.model || 'N/A'],
    ['Serial #:', property.serialNumber || 'N/A'],
    ['Delivery Date:', formatDate(property.deliveryDate)],
    ['Status:', property.overallStatus.replace(/_/g, ' ').toUpperCase()],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    doc.text(String(value), 60, yPos);
    yPos += 6;
  });

  return yPos + 5;
}

/**
 * Add technician info section
 */
function addTechnicianInfo(
  doc: jsPDF,
  technician: User | undefined,
  completedAt: string | undefined,
  startY: number
): number {
  let yPos = startY;

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Service Details', 20, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const details = [
    ['Technician:', technician?.fullName || 'N/A'],
    ['Completed:', formatDateTime(completedAt)],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    doc.text(String(value), 60, yPos);
    yPos += 6;
  });

  return yPos + 5;
}

/**
 * Add checklist items table
 */
function addChecklistTable(doc: jsPDF, items: ChecklistItem[], startY: number): number {
  if (items.length === 0) return startY;

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Checklist Items', 20, startY);

  const completedCount = items.filter((i) => i.completed).length;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'normal');
  doc.text(`(${completedCount}/${items.length} completed)`, 70, startY);

  autoTable(doc, {
    startY: startY + 5,
    head: [['Status', 'Item', 'Notes', 'Completed At']],
    body: items.map((item) => [
      item.completed ? '✓' : '○',
      item.label,
      item.notes || '-',
      item.completedAt ? formatDateTime(item.completedAt) : '-',
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 60 },
      3: { cellWidth: 35 },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    didParseCell: (data) => {
      if (data.column.index === 0 && data.section === 'body') {
        const isCompleted = data.cell.raw === '✓';
        data.cell.styles.textColor = isCompleted ? COLORS.success : COLORS.warning;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  return doc.lastAutoTable.finalY + 10;
}

/**
 * Add issues table
 */
function addIssuesTable(doc: jsPDF, issues: Issue[], startY: number): number {
  if (issues.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text('Issues', 20, startY);

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.success);
    doc.setFont('helvetica', 'normal');
    doc.text('✓ No issues reported', 20, startY + 8);
    return startY + 15;
  }

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(`Issues (${issues.length})`, 20, startY);

  const severityColor: Record<SeverityType, [number, number, number]> = {
    critical: COLORS.danger,
    high: [249, 115, 22], // orange-500
    medium: COLORS.warning,
    low: COLORS.secondary,
  };

  autoTable(doc, {
    startY: startY + 5,
    head: [['Severity', 'Title', 'Category', 'Status', 'Description']],
    body: issues.map((issue) => [
      issue.severity.toUpperCase(),
      issue.title,
      issue.category || '-',
      issue.status.replace(/_/g, ' '),
      issue.description || '-',
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.danger,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 55 },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    didParseCell: (data) => {
      if (data.column.index === 0 && data.section === 'body') {
        const severity = (data.cell.raw as string).toLowerCase() as SeverityType;
        data.cell.styles.textColor = severityColor[severity] || COLORS.secondary;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  return doc.lastAutoTable.finalY + 10;
}

/**
 * Add photos section (thumbnails grid)
 */
async function addPhotosSection(
  doc: jsPDF,
  photos: Photo[],
  startY: number
): Promise<number> {
  if (photos.length === 0) return startY;

  // Check if we need a new page
  if (startY > 220) {
    doc.addPage();
    startY = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(`Photos (${photos.length})`, 20, startY);
  startY += 8;

  const thumbnailSize = 40;
  const margin = 5;
  const cols = 4;
  let xPos = 20;
  let yPos = startY;

  for (let i = 0; i < photos.length && i < 12; i++) {
    // Limit to 12 photos
    const photo = photos[i];

    // Draw placeholder rectangle for thumbnail
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(xPos, yPos, thumbnailSize, thumbnailSize, 'F');
    doc.setDrawColor(...COLORS.secondary);
    doc.rect(xPos, yPos, thumbnailSize, thumbnailSize, 'S');

    // Add caption/type below
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.secondary);
    const caption = photo.caption || photo.photoType || 'Photo';
    doc.text(caption.substring(0, 12), xPos + thumbnailSize / 2, yPos + thumbnailSize + 4, {
      align: 'center',
    });

    // Try to load actual image
    try {
      if (photo.url && photo.url.startsWith('data:')) {
        doc.addImage(photo.url, 'JPEG', xPos, yPos, thumbnailSize, thumbnailSize);
      }
    } catch {
      // Keep placeholder if image loading fails
    }

    // Move to next position
    if ((i + 1) % cols === 0) {
      xPos = 20;
      yPos += thumbnailSize + 12;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    } else {
      xPos += thumbnailSize + margin;
    }
  }

  if (photos.length > 12) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.secondary);
    doc.text(`+ ${photos.length - 12} more photos`, 20, yPos + thumbnailSize + 15);
  }

  return yPos + thumbnailSize + 20;
}

/**
 * Add signatures section
 */
function addSignaturesSection(
  doc: jsPDF,
  phase: Phase,
  startY: number
): number {
  const hasSignatures = phase.customerSignatureUrl || phase.technicianSignatureUrl;
  if (!hasSignatures) return startY;

  // Check if we need a new page
  if (startY > 220) {
    doc.addPage();
    startY = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Signatures', 20, startY);
  startY += 10;

  const signatureWidth = 80;
  const signatureHeight = 30;

  // Customer signature
  if (phase.customerSignatureUrl) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.secondary);
    doc.text('Customer Signature:', 20, startY);
    startY += 3;

    doc.setFillColor(...COLORS.lightGray);
    doc.rect(20, startY, signatureWidth, signatureHeight, 'F');
    doc.setDrawColor(...COLORS.secondary);
    doc.rect(20, startY, signatureWidth, signatureHeight, 'S');

    try {
      if (phase.customerSignatureUrl.startsWith('data:')) {
        doc.addImage(phase.customerSignatureUrl, 'PNG', 20, startY, signatureWidth, signatureHeight);
      }
    } catch {
      doc.setFontSize(8);
      doc.text('Signature on file', 60, startY + 15, { align: 'center' });
    }

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Signed: ${formatDateTime(phase.customerSignedAt)}`, 20, startY + signatureHeight + 4);
    startY += signatureHeight + 15;
  }

  // Technician signature
  if (phase.technicianSignatureUrl) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.secondary);
    doc.text('Technician Signature:', 20, startY);
    startY += 3;

    doc.setFillColor(...COLORS.lightGray);
    doc.rect(20, startY, signatureWidth, signatureHeight, 'F');
    doc.setDrawColor(...COLORS.secondary);
    doc.rect(20, startY, signatureWidth, signatureHeight, 'S');

    try {
      if (phase.technicianSignatureUrl.startsWith('data:')) {
        doc.addImage(phase.technicianSignatureUrl, 'PNG', 20, startY, signatureWidth, signatureHeight);
      }
    } catch {
      doc.setFontSize(8);
      doc.text('Signature on file', 60, startY + 15, { align: 'center' });
    }

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Signed: ${formatDateTime(phase.technicianSignedAt)}`, 20, startY + signatureHeight + 4);
    startY += signatureHeight + 15;
  }

  return startY;
}

/**
 * Add footer with page numbers
 */
function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
    doc.text(
      `Generated by FieldSync • ${formatDateTime(new Date().toISOString())}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 5,
      { align: 'center' }
    );
  }
}

// =============================================================================
// PUBLIC API - Report Generation Functions
// =============================================================================

export interface WalkthroughReportData {
  property: Property;
  customer?: Customer;
  phase: Phase;
  technician?: User;
  photos?: Photo[];
  issues?: Issue[];
}

/**
 * Generate a walkthrough completion report PDF
 */
export async function generateWalkthroughReport(
  data: WalkthroughReportData,
  config: ReportConfig = {}
): Promise<jsPDF> {
  const doc = new jsPDF();
  const { property, customer, phase, technician, photos = [], issues = [] } = data;

  // Header
  let yPos = addHeader(doc, config, 'Walk-Through Report');

  // Property details
  yPos = addPropertyDetails(doc, property, customer, yPos);

  // Technician info
  yPos = addTechnicianInfo(doc, technician, phase.completedAt, yPos);

  // Phase notes if any
  if (phase.notes) {
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', 20, yPos);
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    const noteLines = doc.splitTextToSize(phase.notes, 170);
    doc.text(noteLines, 20, yPos);
    yPos += noteLines.length * 5 + 10;
  }

  // Checklist
  if (phase.checklistItems && phase.checklistItems.length > 0) {
    yPos = addChecklistTable(doc, phase.checklistItems, yPos);
  }

  // Issues
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }
  yPos = addIssuesTable(doc, issues, yPos);

  // Photos
  if (config.includePhotos !== false && photos.length > 0) {
    yPos = await addPhotosSection(doc, photos, yPos);
  }

  // Signatures
  if (config.includeSignatures !== false) {
    yPos = addSignaturesSection(doc, phase, yPos);
  }

  // Footer
  addFooter(doc);

  return doc;
}

export interface MaterialsReportData {
  property: Property;
  customer?: Customer;
  materialsList: MaterialsList;
  preparedBy?: User;
}

/**
 * Generate a materials list report PDF
 */
export async function generateMaterialsReport(
  data: MaterialsReportData,
  config: ReportConfig = {}
): Promise<jsPDF> {
  const doc = new jsPDF();
  const { property, customer, materialsList, preparedBy } = data;

  // Header
  let yPos = addHeader(doc, config, 'Materials List');

  // Property details (abbreviated)
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Property:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(getFullAddress(property), 55, yPos);
  yPos += 6;

  if (customer) {
    doc.setFont('helvetica', 'bold');
    doc.text('Customer:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(`${customer.firstName} ${customer.lastName}`, 55, yPos);
    yPos += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Prepared By:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(preparedBy?.fullName || 'N/A', 55, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(materialsList.createdAt), 55, yPos);
  yPos += 15;

  // Materials table
  const items = materialsList.items || [];

  if (items.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.secondary);
    doc.text('No materials in this list.', 20, yPos);
  } else {
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Item', 'Qty', 'Unit', 'Category', 'Status', 'Est. Cost', 'Actual Cost']],
      body: items.map((item: Material, idx: number) => [
        idx + 1,
        item.name,
        item.quantity,
        item.unit,
        item.category,
        item.status.replace(/_/g, ' '),
        item.estimatedUnitCost ? `$${(item.estimatedUnitCost * item.quantity).toFixed(2)}` : '-',
        item.actualUnitCost ? `$${(item.actualUnitCost * item.quantity).toFixed(2)}` : '-',
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 45 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 22, halign: 'right' },
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      foot: [
        [
          '',
          'TOTAL',
          '',
          '',
          '',
          '',
          materialsList.totalEstimatedCost
            ? `$${materialsList.totalEstimatedCost.toFixed(2)}`
            : '-',
          materialsList.totalActualCost
            ? `$${materialsList.totalActualCost.toFixed(2)}`
            : '-',
        ],
      ],
      footStyles: {
        fillColor: COLORS.lightGray,
        textColor: COLORS.text,
        fontStyle: 'bold',
      },
    });

    yPos = doc.lastAutoTable.finalY + 10;
  }

  // Summary
  yPos += 10;
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 20, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const byStatus = items.reduce((acc: Record<string, number>, item: Material) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(byStatus).forEach(([status, count]) => {
    doc.text(`• ${status.replace(/_/g, ' ')}: ${count} items`, 25, yPos);
    yPos += 5;
  });

  // Footer
  addFooter(doc);

  return doc;
}

export interface IssueSummaryReportData {
  property: Property;
  customer?: Customer;
  issues: Issue[];
  generatedBy?: User;
}

/**
 * Generate an issue summary report PDF
 */
export async function generateIssueSummaryReport(
  data: IssueSummaryReportData,
  config: ReportConfig = {}
): Promise<jsPDF> {
  const doc = new jsPDF();
  const { property, customer, issues, generatedBy } = data;

  // Header
  let yPos = addHeader(doc, config, 'Issue Summary Report');

  // Property details
  yPos = addPropertyDetails(doc, property, customer, yPos);

  // Report metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.secondary);
  doc.text('Generated By:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text(generatedBy?.fullName || 'System', 60, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.secondary);
  doc.text('Report Date:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text(formatDate(new Date().toISOString()), 60, yPos);
  yPos += 15;

  // Summary stats
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Overview', 20, yPos);
  yPos += 8;

  const bySeverity = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    low: issues.filter((i) => i.severity === 'low').length,
  };

  const byStatus = {
    open: issues.filter((i) => ['reported', 'acknowledged', 'in_progress', 'pending_parts'].includes(i.status)).length,
    resolved: issues.filter((i) => i.status === 'resolved').length,
    closed: issues.filter((i) => ['wont_fix', 'duplicate'].includes(i.status)).length,
  };

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Severity breakdown
  doc.setFont('helvetica', 'bold');
  doc.text('By Severity:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Critical: ${bySeverity.critical} | High: ${bySeverity.high} | Medium: ${bySeverity.medium} | Low: ${bySeverity.low}`,
    60,
    yPos
  );
  yPos += 6;

  // Status breakdown
  doc.setFont('helvetica', 'bold');
  doc.text('By Status:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`Open: ${byStatus.open} | Resolved: ${byStatus.resolved} | Closed: ${byStatus.closed}`, 60, yPos);
  yPos += 15;

  // Issues table
  yPos = addIssuesTable(doc, issues, yPos);

  // Detailed issue cards (one per page for critical/high issues)
  const criticalIssues = issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
  
  if (criticalIssues.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(16);
    doc.setTextColor(...COLORS.danger);
    doc.setFont('helvetica', 'bold');
    doc.text('Critical & High Priority Issues - Details', 20, yPos);
    yPos += 15;

    criticalIssues.forEach((issue, idx) => {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Issue card
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(20, yPos - 5, 170, 45, 'F');

      doc.setFontSize(12);
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.text(`${idx + 1}. ${issue.title}`, 25, yPos + 3);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      doc.setTextColor(issue.severity === 'critical' ? COLORS.danger : [249, 115, 22]);
      doc.text(issue.severity.toUpperCase(), 25, yPos + 11);

      doc.setTextColor(...COLORS.secondary);
      doc.text(`Category: ${issue.category || 'N/A'}`, 60, yPos + 11);
      doc.text(`Status: ${issue.status.replace(/_/g, ' ')}`, 110, yPos + 11);
      doc.text(`Reported: ${formatDate(issue.createdAt)}`, 25, yPos + 18);

      if (issue.description) {
        doc.setTextColor(...COLORS.text);
        const descLines = doc.splitTextToSize(issue.description, 160);
        doc.text(descLines.slice(0, 3), 25, yPos + 26);
      }

      if (issue.resolution) {
        doc.setTextColor(...COLORS.success);
        doc.text(`Resolution: ${issue.resolution.substring(0, 80)}...`, 25, yPos + 38);
      }

      yPos += 55;
    });
  }

  // Footer
  addFooter(doc);

  return doc;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Download a PDF document
 */
export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

/**
 * Get PDF as blob for preview
 */
export function getPdfBlob(doc: jsPDF): Blob {
  return doc.output('blob');
}

/**
 * Get PDF as base64 data URL
 */
export function getPdfDataUrl(doc: jsPDF): string {
  return doc.output('dataurlstring');
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(type: string, property: Property): string {
  const address = property.street.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const date = new Date().toISOString().split('T')[0];
  return `${type}_${address}_${date}.pdf`;
}
