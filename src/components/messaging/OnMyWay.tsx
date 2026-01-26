import { useState } from 'react';
import { Navigation, MessageCircle, Clock, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface OnMyWayProps {
  customerName: string;
  customerPhone: string;
  address: string;
  onNavigate?: () => void;
}

export function OnMyWay({ customerName, customerPhone, address, onNavigate }: OnMyWayProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [selectedETA, setSelectedETA] = useState<number | null>(null);

  const etaOptions = [
    { minutes: 10, label: '10 min' },
    { minutes: 15, label: '15 min' },
    { minutes: 20, label: '20 min' },
    { minutes: 30, label: '30 min' },
    { minutes: 45, label: '45 min' },
    { minutes: 60, label: '1 hour' },
  ];

  const sendOnMyWay = async (minutes: number) => {
    if (!customerPhone) {
      alert('No phone number for this customer');
      return;
    }

    setSending(true);
    setSelectedETA(minutes);

    // Format phone number for SMS
    const phoneClean = customerPhone.replace(/\D/g, '');
    const phoneFormatted = phoneClean.startsWith('1') ? phoneClean : `1${phoneClean}`;

    // Create message
    const firstName = customerName.split(' ')[0];
    const message = `Hi ${firstName}! This is your service technician. I'm on my way and should arrive in about ${minutes} minutes. See you soon!`;

    // Open SMS app with pre-filled message
    const smsUrl = `sms:+${phoneFormatted}?body=${encodeURIComponent(message)}`;
    
    // Small delay to show the sending state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    window.open(smsUrl, '_self');
    
    setSending(false);
    setSent(true);
    setShowOptions(false);

    // Also open navigation if callback provided
    if (onNavigate) {
      setTimeout(() => onNavigate(), 1000);
    }
  };

  const openNavigation = () => {
    const encodedAddress = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS 
      ? `maps://maps.apple.com/?daddr=${encodedAddress}`
      : `https://maps.google.com/maps?daddr=${encodedAddress}`;
    window.open(url, '_blank');
  };

  if (sent) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-800">Message sent!</p>
            <p className="text-sm text-green-600">
              {customerName} knows you're {selectedETA} min away
            </p>
          </div>
          <button
            onClick={openNavigation}
            className="p-2 bg-green-600 text-white rounded-lg"
          >
            <Navigation className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (showOptions) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-blue-800">How long until you arrive?</p>
          <button
            onClick={() => setShowOptions(false)}
            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {etaOptions.map(({ minutes, label }) => (
            <button
              key={minutes}
              onClick={() => sendOnMyWay(minutes)}
              disabled={sending}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                sending && selectedETA === minutes
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-blue-200 hover:border-blue-400 text-blue-700'
              }`}
            >
              <Clock className="w-4 h-4 mx-auto mb-1" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
        
        <p className="text-xs text-blue-600 mt-2 text-center">
          This will open your SMS app with a pre-written message
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <MessageCircle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Heading to this job?</p>
          <p className="text-sm text-blue-100">Let {customerName.split(' ')[0]} know you're coming</p>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3">
        <Button
          onClick={() => setShowOptions(true)}
          className="flex-1 bg-white text-blue-600 hover:bg-blue-50"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          On My Way
        </Button>
        <button
          onClick={openNavigation}
          className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
