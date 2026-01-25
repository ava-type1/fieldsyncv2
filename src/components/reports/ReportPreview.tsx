import { useState, useEffect, useCallback } from 'react';
import { X, Download, FileText, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { jsPDF } from 'jspdf';
import {
  generateWalkthroughReport,
  generateMaterialsReport,
  generateIssueSummaryReport,
  downloadPdf,
  getPdfBlob,
  generateFilename,
  type WalkthroughReportData,
  type MaterialsReportData,
  type IssueSummaryReportData,
} from '../../lib/reportGenerator';
import type { Property } from '../../types';

type ReportType = 'walkthrough' | 'materials' | 'issues';

interface ReportConfig {
  companyName?: string;
  companyLogo?: string;
  includePhotos?: boolean;
  includeSignatures?: boolean;
}

interface BaseReportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  config?: ReportConfig;
}

interface WalkthroughPreviewProps extends BaseReportPreviewProps {
  type: 'walkthrough';
  data: WalkthroughReportData;
}

interface MaterialsPreviewProps extends BaseReportPreviewProps {
  type: 'materials';
  data: MaterialsReportData;
}

interface IssuesPreviewProps extends BaseReportPreviewProps {
  type: 'issues';
  data: IssueSummaryReportData;
}

type ReportPreviewProps = WalkthroughPreviewProps | MaterialsPreviewProps | IssuesPreviewProps;

const REPORT_TITLES: Record<ReportType, string> = {
  walkthrough: 'Walk-Through Report',
  materials: 'Materials List',
  issues: 'Issue Summary',
};

export function ReportPreview({ isOpen, onClose, type, data, config = {} }: ReportPreviewProps) {
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let doc: jsPDF;

      switch (type) {
        case 'walkthrough':
          doc = await generateWalkthroughReport(data as WalkthroughReportData, config);
          break;
        case 'materials':
          doc = await generateMaterialsReport(data as MaterialsReportData, config);
          break;
        case 'issues':
          doc = await generateIssueSummaryReport(data as IssueSummaryReportData, config);
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      setPdfDoc(doc);

      // Create preview URL
      const blob = getPdfBlob(doc);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [type, data, config]);

  useEffect(() => {
    if (isOpen) {
      generateReport();
    }

    return () => {
      // Cleanup preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, generateReport]);

  const handleDownload = () => {
    if (!pdfDoc) return;

    let property: Property;
    switch (type) {
      case 'walkthrough':
        property = (data as WalkthroughReportData).property;
        break;
      case 'materials':
        property = (data as MaterialsReportData).property;
        break;
      case 'issues':
        property = (data as IssueSummaryReportData).property;
        break;
    }

    const filename = generateFilename(type, property);
    downloadPdf(pdfDoc, filename);
  };

  const handleRegenerate = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    generateReport();
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white flex flex-col ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{REPORT_TITLES[type]} Preview</h2>
              <p className="text-sm text-gray-500">Review before downloading</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-gray-600" />
              ) : (
                <Maximize2 className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4 bg-gray-100">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Generating report...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <Card className="max-w-md text-center p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Error Generating Report</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button variant="secondary" onClick={handleRegenerate}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </Card>
            </div>
          )}

          {!loading && !error && previewUrl && (
            <div className="h-full rounded-lg overflow-hidden shadow-inner bg-white">
              <iframe
                src={`${previewUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <Button variant="ghost" onClick={handleRegenerate} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleDownload} disabled={loading || !pdfDoc}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CONVENIENT HOOK FOR MANAGING REPORT PREVIEW STATE
// =============================================================================

interface UseReportPreviewReturn<T> {
  isOpen: boolean;
  data: T | null;
  openPreview: (data: T) => void;
  closePreview: () => void;
}

export function useReportPreview<T>(): UseReportPreviewReturn<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const openPreview = useCallback((reportData: T) => {
    setData(reportData);
    setIsOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setIsOpen(false);
    // Delay clearing data to allow for closing animation
    setTimeout(() => setData(null), 300);
  }, []);

  return { isOpen, data, openPreview, closePreview };
}

// =============================================================================
// QUICK REPORT BUTTONS - READY TO USE COMPONENTS
// =============================================================================

interface QuickReportButtonProps {
  property: Property;
  className?: string;
}

export function WalkthroughReportButton({
  data,
  config,
  className = '',
}: {
  data: WalkthroughReportData;
  config?: ReportConfig;
  className?: string;
}) {
  const { isOpen, openPreview, closePreview } = useReportPreview<WalkthroughReportData>();

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => openPreview(data)}
        className={className}
      >
        <FileText className="w-4 h-4 mr-2" />
        Generate Report
      </Button>
      <ReportPreview
        type="walkthrough"
        isOpen={isOpen}
        onClose={closePreview}
        data={data}
        config={config}
      />
    </>
  );
}

export function MaterialsReportButton({
  data,
  config,
  className = '',
}: {
  data: MaterialsReportData;
  config?: ReportConfig;
  className?: string;
}) {
  const { isOpen, openPreview, closePreview } = useReportPreview<MaterialsReportData>();

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => openPreview(data)}
        className={className}
      >
        <FileText className="w-4 h-4 mr-2" />
        Export Materials
      </Button>
      <ReportPreview
        type="materials"
        isOpen={isOpen}
        onClose={closePreview}
        data={data}
        config={config}
      />
    </>
  );
}

export function IssuesReportButton({
  data,
  config,
  className = '',
}: {
  data: IssueSummaryReportData;
  config?: ReportConfig;
  className?: string;
}) {
  const { isOpen, openPreview, closePreview } = useReportPreview<IssueSummaryReportData>();

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => openPreview(data)}
        className={className}
      >
        <FileText className="w-4 h-4 mr-2" />
        Issue Report
      </Button>
      <ReportPreview
        type="issues"
        isOpen={isOpen}
        onClose={closePreview}
        data={data}
        config={config}
      />
    </>
  );
}
