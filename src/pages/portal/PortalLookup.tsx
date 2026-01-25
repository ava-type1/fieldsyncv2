import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Phone, Hash, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';

type SearchType = 'code' | 'address' | 'phone';

export function PortalLookup() {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState<SearchType>('code');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let query = supabase
        .from('properties')
        .select('id, portal_code')
        .limit(1);

      if (searchType === 'code') {
        query = query.eq('portal_code', searchValue.toUpperCase().trim());
      } else if (searchType === 'address') {
        // Search by street address (case-insensitive partial match)
        query = query.ilike('street', `%${searchValue.trim()}%`);
      } else if (searchType === 'phone') {
        // Search by customer phone - need to join
        const { data: customers } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', searchValue.replace(/\D/g, '').trim())
          .limit(1);

        if (customers && customers.length > 0) {
          query = query.eq('customer_id', customers[0].id);
        } else {
          setError('No property found with that phone number. Please check and try again.');
          setLoading(false);
          return;
        }
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError || !data) {
        setError(
          searchType === 'code'
            ? 'Invalid property code. Please check the code and try again.'
            : searchType === 'address'
            ? 'No property found at that address. Please check the spelling and try again.'
            : 'No property found with that phone number.'
        );
        setLoading(false);
        return;
      }

      // Navigate to the property portal
      navigate(`/portal/${data.portal_code || data.id}`);
    } catch (err) {
      console.error('Search error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const searchTypeOptions = [
    { type: 'code' as SearchType, icon: Hash, label: 'Property Code' },
    { type: 'address' as SearchType, icon: Home, label: 'Address' },
    { type: 'phone' as SearchType, icon: Phone, label: 'Phone Number' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-primary-600">FieldSync</h1>
          <p className="text-sm text-gray-500">Customer Portal</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Welcome card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Track Your Home Setup</h2>
            <p className="text-gray-600">
              Enter your property code to see the progress on your new home.
            </p>
          </div>

          {/* Search type selector */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
            {searchTypeOptions.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => {
                  setSearchType(type);
                  setSearchValue('');
                  setError('');
                }}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors
                  ${searchType === type
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <Input
              placeholder={
                searchType === 'code'
                  ? 'Enter your property code (e.g., ABC123)'
                  : searchType === 'address'
                  ? 'Enter your street address'
                  : 'Enter your phone number'
              }
              type={searchType === 'phone' ? 'tel' : 'text'}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={searchType === 'code' ? 'text-center uppercase tracking-wider font-mono' : ''}
            />

            <Button type="submit" fullWidth loading={loading} disabled={!searchValue.trim()}>
              <Search className="w-5 h-5 mr-2" />
              Find My Property
            </Button>
          </form>
        </div>

        {/* Help text */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            <strong>Need your code?</strong> Check your welcome email or contact your sales representative.
          </p>
          <p className="text-xs">
            Your property code should be 6 characters (e.g., XK7M2P)
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-3">
        <p className="text-center text-xs text-gray-400">
          Powered by FieldSync • Questions? Contact your dealership
        </p>
      </footer>
    </div>
  );
}
