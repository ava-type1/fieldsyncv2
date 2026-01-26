import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Wrench, Truck, Factory } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { OrganizationType } from '../../types';

const orgTypes: { type: OrganizationType; label: string; description: string; icon: typeof Building2 }[] = [
  {
    type: 'dealership',
    label: 'Dealership',
    description: 'Sell and coordinate home installations',
    icon: Building2,
  },
  {
    type: 'service_company',
    label: 'Service Company',
    description: 'Post-sale service and warranty work',
    icon: Wrench,
  },
  {
    type: 'subcontractor',
    label: 'Subcontractor',
    description: 'Specific trade work (leveling, plumbing, etc.)',
    icon: Truck,
  },
  {
    type: 'manufacturer',
    label: 'Manufacturer',
    description: 'Home manufacturing',
    icon: Factory,
  },
];

export function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser, setOrganization } = useAuthStore();

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<OrganizationType | null>(null);
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (!selectedType || !orgName || !fullName || !user) return;

    setLoading(true);
    setError('');

    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          type: selectedType,
          settings: {
            timezone: 'America/New_York',
            requirePhotos: true,
            requireSignatures: true,
          },
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create/update user record
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          phone: phone || null,
          organization_id: org.id,
          role: 'owner',
          permissions: [],
        })
        .select()
        .single();

      if (userError) throw userError;

      // Create organization membership (required for job creation)
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert({
          user_id: user.id,
          organization_id: org.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('Membership creation error:', memberError);
        // Don't throw - membership might already exist or table might not exist
      }

      // Update local state
      setUser({
        ...user,
        fullName,
        phone: phone || undefined,
        organizationId: org.id,
        role: 'owner',
      });
      setOrganization({
        id: org.id,
        name: org.name,
        type: org.type,
        settings: org.settings,
        subscription: org.subscription,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      });

      navigate('/');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Welcome to FieldSync</h1>
        <p className="mt-2 text-center text-gray-600">Let&apos;s set up your organization</p>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mt-6">
          <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-primary-600' : 'bg-gray-200'}`} />
          <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
        </div>

        {error && (
          <div className="mt-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm font-medium text-gray-700">What type of organization are you?</p>
            {orgTypes.map(({ type, label, description, icon: Icon }) => (
              <Card
                key={type}
                onClick={() => setSelectedType(type)}
                className={`cursor-pointer ${
                  selectedType === type ? 'ring-2 ring-primary-500 border-primary-500' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      selectedType === type ? 'bg-primary-100' : 'bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 ${
                        selectedType === type ? 'text-primary-600' : 'text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-500">{description}</p>
                  </div>
                </div>
              </Card>
            ))}

            <Button
              fullWidth
              disabled={!selectedType}
              onClick={() => setStep(2)}
              className="mt-6"
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-6">
            <Input
              label="Organization name"
              placeholder="ABC Mobile Homes"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />

            <Input
              label="Your full name"
              placeholder="John Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Phone number (optional)"
              type="tel"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                fullWidth
                loading={loading}
                disabled={!orgName || !fullName}
                onClick={handleComplete}
              >
                Complete Setup
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
