// Walk Through Outline for Contractors - Based on Nobility Homes Inc. form

export interface ChecklistItem {
  id: string;
  label: string;
  required?: boolean;
}

export interface ChecklistSection {
  id: string;
  name: string;
  items: ChecklistItem[];
}

// Simple task-based checklist matching the Nobility Homes form
export const walkthroughTasks: ChecklistItem[] = [
  { id: 'adjust-ext-doors', label: 'Adjust exterior doors', required: true },
  { id: 'adjust-int-doors', label: 'Adjust interior doors', required: true },
  { id: 'check-plumbing', label: 'Check and repair all plumbing', required: true },
  { id: 'check-electrical', label: 'Check and repair all electrical', required: true },
  { id: 'caulk-trim-gaps', label: 'Caulk all trim gaps', required: true },
  { id: 'caulk-plumbing', label: 'Caulk all plumbing fixtures', required: true },
  { id: 'secure-trim', label: 'Secure all loose trim', required: true },
  { id: 'secure-wall-panels', label: 'Secure all loose wall panels', required: true },
  { id: 'check-appliances', label: 'Check all appliances operate properly', required: true },
  { id: 'check-hvac', label: 'Check HVAC system', required: true },
  { id: 'check-windows', label: 'Check all windows open/close/lock', required: true },
  { id: 'check-water-heater', label: 'Check water heater', required: true },
  { id: 'take-return-notes', label: 'Take notes for return trip', required: true },
];

// Detailed room-by-room checklist for thorough inspections
export const walkthroughChecklist: ChecklistSection[] = [
  {
    id: 'exterior',
    name: 'Exterior',
    items: [
      { id: 'ext-doors', label: 'Exterior Doors (adjust/align)' },
      { id: 'ext-lights', label: 'Lights' },
      { id: 'ext-electrical', label: 'Electrical Receptacles' },
      { id: 'ext-bottom-board', label: 'Bottom Board' },
      { id: 'ext-skirting', label: 'Skirting' },
      { id: 'ext-siding', label: 'Siding' },
      { id: 'ext-steps', label: 'Steps/Handrails' },
      { id: 'ext-caulking', label: 'Caulking (trim/windows)' },
      { id: 'ext-other', label: 'Other' },
    ],
  },
  {
    id: 'interior-general',
    name: 'Interior - General',
    items: [
      { id: 'int-doors', label: 'Interior Doors (adjust/align)' },
      { id: 'int-trim', label: 'Loose Trim (secure)' },
      { id: 'int-wall-panels', label: 'Wall Panels (secure)' },
      { id: 'int-caulking', label: 'Caulking (trim gaps)' },
      { id: 'int-flooring', label: 'Floor Covering' },
      { id: 'int-ceiling', label: 'Ceilings' },
    ],
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    items: [
      { id: 'plumb-kitchen-faucet', label: 'Kitchen Faucet' },
      { id: 'plumb-kitchen-sink', label: 'Kitchen Sink' },
      { id: 'plumb-garbage-disposal', label: 'Garbage Disposal' },
      { id: 'plumb-dishwasher', label: 'Dishwasher Connection' },
      { id: 'plumb-bath-faucets', label: 'Bathroom Faucets' },
      { id: 'plumb-toilets', label: 'Toilets' },
      { id: 'plumb-showers', label: 'Showers/Tubs' },
      { id: 'plumb-water-heater', label: 'Water Heater' },
      { id: 'plumb-laundry', label: 'Laundry Connections' },
      { id: 'plumb-caulk-fixtures', label: 'Caulk Plumbing Fixtures' },
      { id: 'plumb-leaks', label: 'Check for Leaks' },
    ],
  },
  {
    id: 'electrical',
    name: 'Electrical',
    items: [
      { id: 'elec-panel', label: 'Electrical Panel' },
      { id: 'elec-outlets', label: 'All Outlets Working' },
      { id: 'elec-switches', label: 'All Switches Working' },
      { id: 'elec-lights', label: 'All Light Fixtures' },
      { id: 'elec-gfci', label: 'GFCI Outlets (test)' },
      { id: 'elec-smoke-detectors', label: 'Smoke Detectors' },
      { id: 'elec-exhaust-fans', label: 'Exhaust Fans' },
      { id: 'elec-dryer-outlet', label: 'Dryer Outlet' },
      { id: 'elec-range-outlet', label: 'Range Outlet' },
    ],
  },
  {
    id: 'appliances',
    name: 'Appliances',
    items: [
      { id: 'app-range', label: 'Range/Oven' },
      { id: 'app-range-vent', label: 'Range Vent Hood' },
      { id: 'app-refrigerator', label: 'Refrigerator' },
      { id: 'app-dishwasher', label: 'Dishwasher' },
      { id: 'app-microwave', label: 'Microwave' },
      { id: 'app-washer-hookup', label: 'Washer Hookup' },
      { id: 'app-dryer-hookup', label: 'Dryer Hookup' },
    ],
  },
  {
    id: 'hvac',
    name: 'HVAC',
    items: [
      { id: 'hvac-heat', label: 'Heating System' },
      { id: 'hvac-ac', label: 'Air Conditioning' },
      { id: 'hvac-thermostat', label: 'Thermostat' },
      { id: 'hvac-vents', label: 'All Vents Open' },
      { id: 'hvac-filter', label: 'Filter' },
    ],
  },
  {
    id: 'windows',
    name: 'Windows & Blinds',
    items: [
      { id: 'win-operation', label: 'Windows Open/Close' },
      { id: 'win-locks', label: 'Window Locks' },
      { id: 'win-screens', label: 'Screens' },
      { id: 'win-blinds', label: 'Mini-Blinds' },
      { id: 'win-drapes', label: 'Drapes' },
    ],
  },
];

// Status for each checklist item
export type ItemStatus = 'pending' | 'ok' | 'issue';

export interface ChecklistItemResult {
  itemId: string;
  status: ItemStatus;
  notes?: string;
  photoIds?: string[];
}

export interface WalkthroughResult {
  propertyId: string;
  serialNumber?: string;
  date: string;
  startedAt: string;
  completedAt?: string;
  results: ChecklistItemResult[];
  specialNotes?: string;
  customerSignature?: string;
  customerName?: string;
  technicianSignature?: string;
}
