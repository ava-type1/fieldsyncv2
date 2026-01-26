import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Car, 
  Clock, 
  ClipboardCheck,
  Send,
  Calculator,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

// Pay rates
const MILEAGE_RATE = 0.55; // per mile
const WALKTHROUGH_RATE = 400; // flat
const HOURLY_RATE = 40; // per hour for return work

interface PayEntry {
  id: string;
  date: string;
  dateEnd?: string; // For multi-day jobs
  type: 'walkthrough' | 'return' | 'windshield';
  milesOneWay: number;
  trips: number; // Number of round trips
  hours?: number;
  customerName?: string;
  poNumber?: string;
  serialNumber?: string;
  address?: string;
  notes?: string;
}

export function PayCalculator() {
  const [entries, setEntries] = useState<PayEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(true);
  
  // Form state
  const [entryType, setEntryType] = useState<'walkthrough' | 'return' | 'windshield'>('walkthrough');
  const [milesOneWay, setMilesOneWay] = useState('');
  const [trips, setTrips] = useState('1');
  const [hours, setHours] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState('');

  // Load entries from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('payEntries');
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  // Save entries to localStorage
  useEffect(() => {
    localStorage.setItem('payEntries', JSON.stringify(entries));
  }, [entries]);

  const calculateEntry = (entry: PayEntry) => {
    const totalMiles = entry.milesOneWay * 2 * entry.trips;
    const mileageTotal = totalMiles * MILEAGE_RATE;
    let serviceTotal = 0;
    
    if (entry.type === 'walkthrough') {
      serviceTotal = WALKTHROUGH_RATE;
    } else if (entry.type === 'return' || entry.type === 'windshield') {
      serviceTotal = (entry.hours || 0) * HOURLY_RATE;
    }
    
    return {
      miles: totalMiles,
      mileage: mileageTotal,
      service: serviceTotal,
      total: mileageTotal + serviceTotal,
    };
  };

  const addEntry = () => {
    if (!milesOneWay) return;
    
    const newEntry: PayEntry = {
      id: Date.now().toString(),
      date,
      dateEnd: dateEnd || undefined,
      type: entryType,
      milesOneWay: parseFloat(milesOneWay) || 0,
      trips: parseInt(trips) || 1,
      hours: entryType !== 'walkthrough' ? parseFloat(hours) || 0 : undefined,
      customerName,
      poNumber,
      serialNumber,
      address,
      notes,
    };
    
    setEntries(prev => [newEntry, ...prev]);
    
    // Reset form
    setMilesOneWay('');
    setTrips('1');
    setHours('');
    setCustomerName('');
    setPoNumber('');
    setSerialNumber('');
    setAddress('');
    setNotes('');
    setDateEnd('');
    setShowAddForm(false);
  };

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const totals = entries.reduce(
    (acc, entry) => {
      const calc = calculateEntry(entry);
      return {
        mileage: acc.mileage + calc.mileage,
        service: acc.service + calc.service,
        total: acc.total + calc.total,
        miles: acc.miles + calc.miles,
        walkthroughs: acc.walkthroughs + (entry.type === 'walkthrough' ? 1 : 0),
        returnHours: acc.returnHours + ((entry.type === 'return' || entry.type === 'windshield') ? (entry.hours || 0) : 0),
      };
    },
    { mileage: 0, service: 0, total: 0, miles: 0, walkthroughs: 0, returnHours: 0 }
  );

  const emailPaySheet = () => {
    const subject = `Invoice - Kameron Martin - ${new Date().toLocaleDateString()}`;
    
    // Generate invoice for each entry
    const invoiceLines = entries.map(e => {
      const calc = calculateEntry(e);
      const dateRange = e.dateEnd ? `${e.date} - ${e.dateEnd}` : e.date;
      return `
INVOICE
=======
Date: ${dateRange}
${e.poNumber ? `P.O.#: ${e.poNumber}` : ''}
${e.customerName ? `Customer: ${e.customerName}` : ''}
${e.serialNumber ? `Serial#: ${e.serialNumber}` : ''}

Mileage: ${e.milesOneWay} mi × ${e.trips} trips × 2 = ${calc.miles} mi
         ${calc.miles} × $${MILEAGE_RATE.toFixed(2)} = $${calc.mileage.toFixed(2)}
${e.type === 'walkthrough' 
  ? `Walk-through: $${WALKTHROUGH_RATE.toFixed(2)}`
  : `Hours: ${e.hours || 0} × $${HOURLY_RATE} = $${calc.service.toFixed(2)}`}

TOTAL: $${calc.total.toFixed(2)}
`;
    }).join('\n---\n');

    const body = `From: Kameron Martin
To: Nobility Homes
    3741 SW 7th St
    Ocala, FL 34474

${invoiceLines}

================
GRAND TOTAL: $${totals.total.toFixed(2)}
================

Mileage Summary: ${totals.miles.toFixed(0)} mi × $${MILEAGE_RATE} = $${totals.mileage.toFixed(2)}
Walk-throughs: ${totals.walkthroughs} × $${WALKTHROUGH_RATE} = $${(totals.walkthroughs * WALKTHROUGH_RATE).toFixed(2)}
Return Hours: ${totals.returnHours.toFixed(1)} hrs × $${HOURLY_RATE} = $${(totals.returnHours * HOURLY_RATE).toFixed(2)}

Please submit with receipts and signed work order.

--
Generated by FieldSync`;

    const recipients = 'Matt@nobilityhomes.com,Sharon@nobilityhomes.com,Diane@nobilityhomes.com';
    window.location.href = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Pay Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">Track mileage, walk-throughs, and return work</p>
      </div>

      {/* Summary Card */}
      <div className="p-4">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-center">
            <p className="text-green-100 text-sm">Total Earnings</p>
            <p className="text-4xl font-bold mt-1">${totals.total.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-green-400">
            <div className="text-center">
              <p className="text-green-100 text-xs">Walk-throughs</p>
              <p className="font-semibold">{totals.walkthroughs}</p>
            </div>
            <div className="text-center">
              <p className="text-green-100 text-xs">Return Hrs</p>
              <p className="font-semibold">{totals.returnHours.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-green-100 text-xs">Miles</p>
              <p className="font-semibold">{totals.miles.toFixed(0)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Add Entry Form */}
      <div className="px-4">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full flex items-center justify-between p-4 bg-white rounded-lg border mb-4"
        >
          <span className="font-medium text-gray-900">Add Entry</span>
          {showAddForm ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showAddForm && (
          <Card className="mb-4">
            {/* Entry Type */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { type: 'walkthrough' as const, label: 'Walk-through', icon: ClipboardCheck },
                { type: 'return' as const, label: 'Return Work', icon: Clock },
                { type: 'windshield' as const, label: 'Windshield', icon: Car },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setEntryType(type)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    entryType === type
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Input
                  label="End Date (if multi-day)"
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="P.O. #"
                  placeholder="e.g., 9090"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
                <Input
                  label="Serial #"
                  placeholder="e.g., N1-17679 AB"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>

              <Input
                label="Customer name"
                placeholder="Steven Cover"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Miles (one way)"
                  type="number"
                  placeholder="e.g., 59"
                  value={milesOneWay}
                  onChange={(e) => setMilesOneWay(e.target.value)}
                />
                <Input
                  label="# of trips"
                  type="number"
                  placeholder="e.g., 4"
                  value={trips}
                  onChange={(e) => setTrips(e.target.value)}
                />
              </div>

              {entryType !== 'walkthrough' && (
                <Input
                  label="Hours worked"
                  type="number"
                  step="0.5"
                  placeholder="e.g., 16"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              )}

              {/* Live calculation */}
              {milesOneWay && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Mileage: {milesOneWay} × {trips || 1} × 2 = {(parseFloat(milesOneWay) || 0) * (parseInt(trips) || 1) * 2} mi</span>
                    <span className="font-medium">${((parseFloat(milesOneWay) || 0) * (parseInt(trips) || 1) * 2 * MILEAGE_RATE).toFixed(2)}</span>
                  </div>
                  {entryType === 'walkthrough' && (
                    <div className="flex justify-between mt-1">
                      <span>Walk-through flat rate</span>
                      <span className="font-medium">${WALKTHROUGH_RATE.toFixed(2)}</span>
                    </div>
                  )}
                  {entryType !== 'walkthrough' && hours && (
                    <div className="flex justify-between mt-1">
                      <span>Hours: {hours} × ${HOURLY_RATE}</span>
                      <span className="font-medium">${(parseFloat(hours) * HOURLY_RATE).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mt-2 pt-2 border-t font-semibold">
                    <span>Entry Total</span>
                    <span className="text-green-600">
                      ${(
                        (parseFloat(milesOneWay) || 0) * (parseInt(trips) || 1) * 2 * MILEAGE_RATE +
                        (entryType === 'walkthrough' ? WALKTHROUGH_RATE : (parseFloat(hours) || 0) * HOURLY_RATE)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <Button onClick={addEntry} fullWidth disabled={!milesOneWay}>
                <Calculator className="w-4 h-4 mr-2" />
                Add Entry
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Entries List */}
      <div className="px-4 space-y-2">
        {entries.map((entry) => {
          const calc = calculateEntry(entry);
          const dateDisplay = entry.dateEnd ? `${entry.date} - ${entry.dateEnd}` : entry.date;
          return (
            <Card key={entry.id} className="relative">
              <button
                onClick={() => removeEntry(entry.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-xs"
              >
                ✕
              </button>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-500">{dateDisplay}</p>
                  <p className="font-medium text-gray-900">{entry.customerName || 'N/A'}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {entry.type.replace('_', ' ')}
                    {entry.poNumber && ` • P.O.# ${entry.poNumber}`}
                  </p>
                  {entry.serialNumber && (
                    <p className="text-xs text-gray-400">Serial# {entry.serialNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">${calc.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">
                    {entry.milesOneWay} × {entry.trips} × 2 = {calc.miles} mi
                  </p>
                  {entry.hours && (
                    <p className="text-xs text-gray-500">{entry.hours} hrs</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {entries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Calculator className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No entries yet</p>
            <p className="text-sm">Add your first work entry above</p>
          </div>
        )}
      </div>

      {/* Email Button */}
      {entries.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t">
          <Button onClick={emailPaySheet} fullWidth>
            <Send className="w-4 h-4 mr-2" />
            Email Pay Sheet to Matt, Sharon & Diane
          </Button>
        </div>
      )}
    </div>
  );
}
