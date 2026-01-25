import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link2, Unlink, CheckCircle, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import {
  isQuickBooksConfigured,
  getAuthUrl,
  exchangeCodeForTokens,
  getStoredTokens,
  storeTokens,
  disconnectQuickBooks,
  type QBTokens,
} from '../../lib/quickbooks';

export function QuickBooksSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [tokens, setTokens] = useState<QBTokens | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isConfigured = isQuickBooksConfigured();

  useEffect(() => {
    checkConnection();
    handleOAuthCallback();
  }, [user]);

  const checkConnection = async () => {
    if (!user?.organizationId) return;
    
    setLoading(true);
    try {
      const storedTokens = await getStoredTokens(user.organizationId);
      setTokens(storedTokens);
    } catch (err) {
      console.error('Error checking QB connection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async () => {
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');

    if (error) {
      setMessage({ type: 'error', text: 'QuickBooks authorization was cancelled' });
      // Clear URL params
      navigate('/settings/quickbooks', { replace: true });
      return;
    }

    if (code && realmId && user?.organizationId) {
      setConnecting(true);
      try {
        const newTokens = await exchangeCodeForTokens(code);
        if (newTokens) {
          newTokens.realmId = realmId;
          await storeTokens(user.organizationId, newTokens);
          setTokens(newTokens);
          setMessage({ type: 'success', text: 'QuickBooks connected successfully!' });
        } else {
          setMessage({ type: 'error', text: 'Failed to connect QuickBooks' });
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setMessage({ type: 'error', text: 'Failed to complete authorization' });
      } finally {
        setConnecting(false);
        // Clear URL params
        navigate('/settings/quickbooks', { replace: true });
      }
    }
  };

  const handleConnect = () => {
    const authUrl = getAuthUrl();
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!user?.organizationId) return;
    if (!confirm('Are you sure you want to disconnect QuickBooks?')) return;

    setConnecting(true);
    try {
      const success = await disconnectQuickBooks(user.organizationId);
      if (success) {
        setTokens(null);
        setMessage({ type: 'success', text: 'QuickBooks disconnected' });
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    } finally {
      setConnecting(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">QuickBooks</h1>
              <p className="text-sm text-gray-500">Accounting integration</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Not Configured</p>
                <p className="text-sm text-yellow-700 mt-1">
                  QuickBooks integration requires app credentials. Contact your administrator to set up the integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">QuickBooks</h1>
            <p className="text-sm text-gray-500">Sync invoices and customers</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mx-4 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Connection Status
          </p>
        </div>
        
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : tokens ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">Connected</p>
                  <p className="text-sm text-green-700">
                    Company ID: {tokens.realmId}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDisconnect}
                disabled={connecting}
              >
                <Unlink className="w-4 h-4 mr-2" />
                {connecting ? 'Disconnecting...' : 'Disconnect QuickBooks'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Not Connected</p>
                  <p className="text-sm text-gray-500">
                    Connect to sync invoices and customers
                  </p>
                </div>
              </div>

              <Button
                className="w-full bg-[#2CA01C] hover:bg-[#248F17]"
                onClick={handleConnect}
                disabled={connecting}
              >
                <img 
                  src="https://developer.intuit.com/content/dam/intuit/intuit-developer/en_us/images/qb-connect-button.svg" 
                  alt="Connect to QuickBooks"
                  className="h-5 mr-2"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {connecting ? 'Connecting...' : 'Connect to QuickBooks'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      {tokens && (
        <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              What Gets Synced
            </p>
          </div>
          
          <div className="divide-y divide-gray-100">
            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Invoices</p>
                <p className="text-xs text-gray-500">Create invoices from completed work</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Customers</p>
                <p className="text-xs text-gray-500">Sync customer info automatically</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
            </div>

            <div className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Time & Mileage</p>
                <p className="text-xs text-gray-500">Convert time entries to billable items</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm p-4 mb-8">
        <p className="text-sm font-medium text-gray-900 mb-3">How it works</p>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="font-medium text-blue-600">1.</span>
            Complete a walkthrough or service call
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-blue-600">2.</span>
            Review time entries and materials
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-blue-600">3.</span>
            Click "Create Invoice" to sync to QuickBooks
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-blue-600">4.</span>
            Send invoice directly from QuickBooks
          </li>
        </ol>
      </div>
    </div>
  );
}
