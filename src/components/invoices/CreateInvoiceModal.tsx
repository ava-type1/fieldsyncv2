import { useState, useEffect } from 'react';
import { X, FileText, Clock, Car, DollarSign, Send, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useTimeTracking, type TimeEntry } from '../../hooks/useTimeTracking';
import { createInvoiceFromTimeEntries, getStoredTokens } from '../../lib/quickbooks';
import { useAuthStore } from '../../stores/authStore';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  propertyAddress?: string;
  customerName?: string;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  propertyId,
  propertyAddress,
  customerName,
}: CreateInvoiceModalProps) {
  const { user } = useAuthStore();
  const { entries, loading: loadingEntries } = useTimeTracking({ propertyId });
  
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [includeLineItems, setIncludeLineItems] = useState(false);
  const [addMileage, setAddMileage] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [qbConnected, setQbConnected] = useState(false);

  // Filter to only unbilled, completed entries
  const billableEntries = entries.filter(e => e.endTime && !e.notes?.includes('[INVOICED]'));

  useEffect(() => {
    checkQBConnection();
    // Select all by default
    setSelectedEntries(billableEntries.map(e => e.id));
  }, [entries]);

  const checkQBConnection = async () => {
    if (!user?.organizationId) return;
    const tokens = await getStoredTokens(user.organizationId);
    setQbConnected(!!tokens);
  };

  const toggleEntry = (id: string) => {
    setSelectedEntries(prev =>
      prev.includes(id)
        ? prev.filter(e => e !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedEntries(billableEntries.map(e => e.id));
  };

  const selectNone = () => {
    setSelectedEntries([]);
  };

  const calculateTotals = () => {
    const selected = billableEntries.filter(e => selectedEntries.includes(e.id));
    
    const totalHours = selected.reduce((sum, e) => {
      const hours = (e.totalDuration || 0) / 1000 / 60 / 60;
      return sum + hours;
    }, 0);

    const avgRate = selected[0]?.hourlyRate || 40;
    const timeAmount = totalHours * avgRate;

    const totalMileage = selected.reduce((sum, e) => sum + (e.mileage || 0), 0);
    const mileageRate = selected[0]?.mileageRate || 0.67;
    const mileageAmount = addMileage ? totalMileage * mileageRate : 0;

    return {
      hours: totalHours,
      timeAmount,
      mileage: totalMileage,
      mileageAmount,
      total: timeAmount + mileageAmount,
      entries: selected.length,
    };
  };

  const handleCreate = async () => {
    if (!user?.organizationId || selectedEntries.length === 0) return;

    setCreating(true);
    setResult(null);

    try {
      const response = await createInvoiceFromTimeEntries(
        user.organizationId,
        propertyId,
        selectedEntries,
        { includeLineItems, addMileage }
      );

      if (response.success) {
        setResult({
          success: true,
          message: `Invoice #${response.qbId} created successfully!`,
        });
        // Could mark entries as invoiced here
      } else {
        setResult({
          success: false,
          message: response.error || 'Failed to create invoice',
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Failed to create invoice',
      });
    } finally {
      setCreating(false);
    }
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 1000 / 60 / 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Create Invoice</h2>
              <p className="text-sm text-gray-500">{customerName || 'Customer'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!qbConnected ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-800">
                Connect QuickBooks in Settings to create invoices
              </p>
            </div>
          ) : (
            <>
              {/* Property Info */}
              {propertyAddress && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Property</p>
                  <p className="font-medium">{propertyAddress}</p>
                </div>
              )}

              {/* Time Entries */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Time Entries</p>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      onClick={selectNone}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {loadingEntries ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : billableEntries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No billable time entries found
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {billableEntries.map(entry => (
                      <label
                        key={entry.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedEntries.includes(entry.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry.id)}
                          onChange={() => toggleEntry(entry.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {new Date(entry.startTime).toLocaleDateString()}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(entry.totalDuration || 0)}
                            </span>
                            {entry.mileage && (
                              <span className="flex items-center gap-1">
                                <Car className="w-3 h-3" />
                                {entry.mileage} mi
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-green-600">
                          ${(entry.earnings || 0).toFixed(2)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLineItems}
                    onChange={(e) => setIncludeLineItems(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Break out each entry as separate line item
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addMileage}
                    onChange={(e) => setAddMileage(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Include mileage charges
                  </span>
                </label>
              </div>

              {/* Totals */}
              {selectedEntries.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Labor ({totals.hours.toFixed(2)} hrs)
                    </span>
                    <span>${totals.timeAmount.toFixed(2)}</span>
                  </div>
                  {addMileage && totals.mileage > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Mileage ({totals.mileage} mi)
                      </span>
                      <span>${totals.mileageAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-green-600">${totals.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Result Message */}
              {result && (
                <div className={`p-3 rounded-lg text-sm ${
                  result.success
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {result.message}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleCreate}
            disabled={!qbConnected || selectedEntries.length === 0 || creating}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Create Invoice
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
