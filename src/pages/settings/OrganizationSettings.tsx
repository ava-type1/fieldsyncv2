import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Save, MapPin, Phone, Mail, Globe } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import type { Organization, OrgSettings } from '../../types';

export function OrganizationSettings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    primaryEmail: '',
    primaryPhone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    settings: {
      timezone: 'America/New_York',
      requirePhotos: true,
      requireSignatures: true,
    } as OrgSettings,
  });

  useEffect(() => {
    loadOrganization();
  }, [user]);

  const loadOrganization = async () => {
    if (!user?.organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', user.organizationId)
        .single();

      if (error) throw error;

      setOrg(data);
      setFormData({
        name: data.name || '',
        primaryEmail: data.primary_email || '',
        primaryPhone: data.primary_phone || '',
        address: data.address || { street: '', city: '', state: '', zip: '' },
        settings: data.settings || {
          timezone: 'America/New_York',
          requirePhotos: true,
          requireSignatures: true,
        },
      });
    } catch (err) {
      console.error('Error loading organization:', err);
      setMessage({ type: 'error', text: 'Failed to load organization' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!org) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          primary_email: formData.primaryEmail,
          primary_phone: formData.primaryPhone,
          address: formData.address,
          settings: formData.settings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Organization updated successfully!' });
    } catch (err) {
      console.error('Error updating organization:', err);
      setMessage({ type: 'error', text: 'Failed to update organization' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
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
            <h1 className="text-lg font-semibold text-gray-900">Organization</h1>
            <p className="text-sm text-gray-500">Manage company settings</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mx-4 mt-4 p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Company Info */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-gray-400" />
          <p className="text-sm font-medium text-gray-900">Company Information</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your company name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <Input
                type="email"
                value={formData.primaryEmail}
                onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                placeholder="contact@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone
              </label>
              <Input
                type="tel"
                value={formData.primaryPhone}
                onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-gray-400" />
          <p className="text-sm font-medium text-gray-900">Business Address</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address
            </label>
            <Input
              value={formData.address.street}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, street: e.target.value }
              })}
              placeholder="123 Main St"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <Input
                value={formData.address.city}
                onChange={(e) => setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value }
                })}
                placeholder="Ocala"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <Input
                value={formData.address.state}
                onChange={(e) => setFormData({
                  ...formData,
                  address: { ...formData.address, state: e.target.value }
                })}
                placeholder="FL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP
              </label>
              <Input
                value={formData.address.zip}
                onChange={(e) => setFormData({
                  ...formData,
                  address: { ...formData.address, zip: e.target.value }
                })}
                placeholder="34470"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Work Requirements */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-gray-400" />
          <p className="text-sm font-medium text-gray-900">Work Requirements</p>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Require Photos</p>
              <p className="text-xs text-gray-500">Techs must take photos before completing phases</p>
            </div>
            <button
              onClick={() => setFormData({
                ...formData,
                settings: { ...formData.settings, requirePhotos: !formData.settings.requirePhotos }
              })}
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                formData.settings.requirePhotos ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                formData.settings.requirePhotos ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Require Signatures</p>
              <p className="text-xs text-gray-500">Customer signature required for walkthroughs</p>
            </div>
            <button
              onClick={() => setFormData({
                ...formData,
                settings: { ...formData.settings, requireSignatures: !formData.settings.requireSignatures }
              })}
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                formData.settings.requireSignatures ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                formData.settings.requireSignatures ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mx-4 mt-6 pb-8">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
