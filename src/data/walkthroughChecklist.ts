// Room-by-room walkthrough checklist based on Nobility Homes form

export interface ChecklistItem {
  id: string;
  label: string;
  category?: string;
}

export interface Room {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export const walkthroughChecklist: Room[] = [
  {
    id: 'exterior',
    name: 'Exterior',
    items: [
      { id: 'ext-lights', label: 'Lights' },
      { id: 'ext-electrical', label: 'Electrical Receptacles' },
      { id: 'ext-bottom-board', label: 'Bottom Board' },
      { id: 'ext-skirting', label: 'Skirting' },
      { id: 'ext-siding', label: 'Siding' },
      { id: 'ext-steps', label: 'Steps/Handrails' },
      { id: 'ext-other', label: 'Other' },
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    items: [
      { id: 'kit-faucets', label: 'Faucets' },
      { id: 'kit-walls', label: 'Walls' },
      { id: 'kit-windows', label: 'Windows' },
      { id: 'kit-doors', label: 'Doors' },
      { id: 'kit-ceiling', label: 'Ceiling' },
      { id: 'kit-moldings', label: 'Moldings' },
      { id: 'kit-range', label: 'Range (damage)' },
      { id: 'kit-range-vent', label: 'Range Vent & Fan' },
      { id: 'kit-dishwasher', label: 'Dishwasher' },
      { id: 'kit-oven', label: 'Oven' },
      { id: 'kit-refrigerator', label: 'Refrigerator' },
      { id: 'kit-countertops', label: 'Countertops' },
      { id: 'kit-cabinetry', label: 'Cabinetry' },
      { id: 'kit-island', label: 'Island' },
      { id: 'kit-ceramic-tile', label: 'Ceramic Tile' },
      { id: 'kit-sink', label: 'Sink' },
      { id: 'kit-water-connections', label: 'Water Connections' },
      { id: 'kit-garbage-disposal', label: 'Garbage Disposal' },
      { id: 'kit-drapes', label: 'Drapes' },
      { id: 'kit-mini-blinds', label: 'Mini-Blinds' },
      { id: 'kit-floor-covering', label: 'Floor Covering' },
      { id: 'kit-light-fixtures', label: 'Light Fixtures' },
      { id: 'kit-switches', label: 'Switches/Receptacles' },
      { id: 'kit-other', label: 'Other' },
    ],
  },
  {
    id: 'utility',
    name: 'Utility Room',
    items: [
      { id: 'util-faucet', label: 'Faucet' },
      { id: 'util-laundry-tub', label: 'Laundry Tub' },
      { id: 'util-walls', label: 'Walls' },
      { id: 'util-windows', label: 'Windows' },
      { id: 'util-doors', label: 'Doors' },
      { id: 'util-ceiling', label: 'Ceiling' },
      { id: 'util-cabinetry', label: 'Cabinetry' },
      { id: 'util-countertops', label: 'Counter Tops' },
      { id: 'util-moldings', label: 'Mouldings' },
      { id: 'util-drapes', label: 'Drapes' },
      { id: 'util-mini-blinds', label: 'Mini-Blinds' },
      { id: 'util-floor-covering', label: 'Floor Coverings' },
      { id: 'util-light-fixtures', label: 'Light Fixtures' },
      { id: 'util-dryer-receptacle', label: 'Dryer Receptacles' },
      { id: 'util-drain', label: 'Drain Operations' },
      { id: 'util-other', label: 'Other' },
    ],
  },
  {
    id: 'living',
    name: 'Living Room',
    items: [
      { id: 'liv-walls', label: 'Walls' },
      { id: 'liv-windows', label: 'Windows' },
      { id: 'liv-doors', label: 'Doors' },
      { id: 'liv-ceiling', label: 'Ceiling' },
      { id: 'liv-moldings', label: 'Mouldings' },
      { id: 'liv-marble-sills', label: 'Marble Window Sills' },
      { id: 'liv-drapes', label: 'Drapes' },
      { id: 'liv-mini-blinds', label: 'Mini-Blinds' },
      { id: 'liv-floor-covering', label: 'Floor Coverings' },
      { id: 'liv-light-fixtures', label: 'Light Fixtures' },
      { id: 'liv-switches', label: 'Switches/Receptacles' },
      { id: 'liv-other', label: 'Other' },
    ],
  },
  {
    id: 'dining',
    name: 'Dining Room',
    items: [
      { id: 'din-walls', label: 'Walls' },
      { id: 'din-windows', label: 'Windows' },
      { id: 'din-doors', label: 'Door' },
      { id: 'din-cabinetry', label: 'Cabinetry' },
      { id: 'din-countertops', label: 'Countertops' },
      { id: 'din-ceiling', label: 'Ceiling' },
      { id: 'din-moldings', label: 'Mouldings' },
      { id: 'din-marble-sills', label: 'Marble Window Sills' },
      { id: 'din-drapes', label: 'Drapes' },
      { id: 'din-mini-blinds', label: 'Mini-Blinds' },
      { id: 'din-floor-covering', label: 'Floor Coverings' },
      { id: 'din-light-fixtures', label: 'Light Fixtures' },
      { id: 'din-switches', label: 'Switches/Receptacles' },
      { id: 'din-other', label: 'Other' },
    ],
  },
  {
    id: 'den',
    name: 'Den/Family Room',
    items: [
      { id: 'den-walls', label: 'Walls' },
      { id: 'den-windows', label: 'Windows' },
      { id: 'den-doors', label: 'Door' },
      { id: 'den-cabinetry', label: 'Cabinetry' },
      { id: 'den-countertops', label: 'Countertops' },
      { id: 'den-ceiling', label: 'Ceiling' },
      { id: 'den-moldings', label: 'Mouldings' },
      { id: 'den-marble-sills', label: 'Marble Window Sills' },
      { id: 'den-drapes', label: 'Drapes' },
      { id: 'den-mini-blinds', label: 'Mini-Blinds' },
      { id: 'den-floor-covering', label: 'Floor Coverings' },
      { id: 'den-light-fixtures', label: 'Light Fixtures' },
      { id: 'den-switches', label: 'Switches/Receptacles' },
      { id: 'den-other', label: 'Other' },
    ],
  },
  {
    id: 'master-bedroom',
    name: 'Master Bedroom',
    items: [
      { id: 'mbed-walls', label: 'Walls' },
      { id: 'mbed-windows', label: 'Windows' },
      { id: 'mbed-doors', label: 'Doors' },
      { id: 'mbed-ceiling', label: 'Ceiling' },
      { id: 'mbed-moldings', label: 'Mouldings' },
      { id: 'mbed-marble-sills', label: 'Marble Window Sills' },
      { id: 'mbed-drapes', label: 'Drapes' },
      { id: 'mbed-mini-blinds', label: 'Mini-Blinds' },
      { id: 'mbed-floor-covering', label: 'Floor Coverings' },
      { id: 'mbed-light-fixtures', label: 'Light Fixtures' },
      { id: 'mbed-switches', label: 'Switches/Receptacles' },
      { id: 'mbed-closet', label: 'Closet' },
      { id: 'mbed-other', label: 'Other' },
    ],
  },
  {
    id: 'master-bathroom',
    name: 'Master Bathroom',
    items: [
      { id: 'mbath-faucets', label: 'Faucets (Lav/Tub/Shower)' },
      { id: 'mbath-sinks', label: 'Sinks' },
      { id: 'mbath-walls', label: 'Walls' },
      { id: 'mbath-windows', label: 'Windows' },
      { id: 'mbath-doors', label: 'Door' },
      { id: 'mbath-ceiling', label: 'Ceiling' },
      { id: 'mbath-cabinetry', label: 'Cabinetry' },
      { id: 'mbath-countertops', label: 'Countertops' },
      { id: 'mbath-ceramic-tile', label: 'Ceramic Tile' },
      { id: 'mbath-exhaust-fan', label: 'Exhaust Fan' },
      { id: 'mbath-solar-tube', label: 'Solar Tube' },
      { id: 'mbath-drapes', label: 'Drapes' },
      { id: 'mbath-mini-blinds', label: 'Mini-Blinds' },
      { id: 'mbath-floor-covering', label: 'Floor Coverings' },
      { id: 'mbath-light-fixtures', label: 'Light Fixtures' },
      { id: 'mbath-switches', label: 'Switches/Receptacles' },
      { id: 'mbath-linen', label: 'Linen' },
      { id: 'mbath-shower-rod', label: 'Shower Rod' },
      { id: 'mbath-shower-curtain', label: 'Shower Curtain/Décor Drape' },
      { id: 'mbath-shower-head', label: 'Shower Head' },
      { id: 'mbath-tub-shower', label: 'Tub/Shower' },
      { id: 'mbath-commode', label: 'Commode' },
      { id: 'mbath-other', label: 'Other' },
    ],
  },
  {
    id: 'bedroom-2',
    name: 'Bedroom 2',
    items: [
      { id: 'bed2-walls', label: 'Walls' },
      { id: 'bed2-windows', label: 'Windows' },
      { id: 'bed2-doors', label: 'Door' },
      { id: 'bed2-ceiling', label: 'Ceiling' },
      { id: 'bed2-moldings', label: 'Mouldings' },
      { id: 'bed2-marble-sills', label: 'Marble Window Sills' },
      { id: 'bed2-drapes', label: 'Drapes' },
      { id: 'bed2-mini-blinds', label: 'Mini-Blinds' },
      { id: 'bed2-floor-covering', label: 'Floor Coverings' },
      { id: 'bed2-light-fixtures', label: 'Light Fixtures' },
      { id: 'bed2-switches', label: 'Switches/Receptacles' },
      { id: 'bed2-closet', label: 'Closet' },
      { id: 'bed2-other', label: 'Other' },
    ],
  },
  {
    id: 'bedroom-3',
    name: 'Bedroom 3',
    items: [
      { id: 'bed3-walls', label: 'Walls' },
      { id: 'bed3-windows', label: 'Windows' },
      { id: 'bed3-doors', label: 'Door' },
      { id: 'bed3-ceiling', label: 'Ceiling' },
      { id: 'bed3-moldings', label: 'Mouldings' },
      { id: 'bed3-marble-sills', label: 'Marble Window Sills' },
      { id: 'bed3-drapes', label: 'Drapes' },
      { id: 'bed3-mini-blinds', label: 'Mini-Blinds' },
      { id: 'bed3-floor-covering', label: 'Floor Coverings' },
      { id: 'bed3-light-fixtures', label: 'Light Fixtures' },
      { id: 'bed3-switches', label: 'Switches/Receptacles' },
      { id: 'bed3-closet', label: 'Closet' },
      { id: 'bed3-other', label: 'Other' },
    ],
  },
  {
    id: 'bedroom-4',
    name: 'Bedroom 4/5',
    items: [
      { id: 'bed4-walls', label: 'Walls' },
      { id: 'bed4-windows', label: 'Windows' },
      { id: 'bed4-doors', label: 'Door' },
      { id: 'bed4-ceiling', label: 'Ceiling' },
      { id: 'bed4-moldings', label: 'Mouldings' },
      { id: 'bed4-marble-sills', label: 'Marble Window Sills' },
      { id: 'bed4-drapes', label: 'Drapes' },
      { id: 'bed4-mini-blinds', label: 'Mini-Blinds' },
      { id: 'bed4-floor-covering', label: 'Floor Coverings' },
      { id: 'bed4-light-fixtures', label: 'Light Fixtures' },
      { id: 'bed4-switches', label: 'Switches/Receptacles' },
      { id: 'bed4-closet', label: 'Closet' },
      { id: 'bed4-other', label: 'Other' },
    ],
  },
  {
    id: 'guest-bathroom',
    name: 'Guest Bathroom',
    items: [
      { id: 'gbath-faucets', label: 'Faucets (Lav/Tub/Shower)' },
      { id: 'gbath-sinks', label: 'Sinks' },
      { id: 'gbath-walls', label: 'Walls' },
      { id: 'gbath-windows', label: 'Windows' },
      { id: 'gbath-ceiling', label: 'Ceiling' },
      { id: 'gbath-cabinetry', label: 'Cabinetry' },
      { id: 'gbath-countertops', label: 'Countertops' },
      { id: 'gbath-ceramic-tile', label: 'Ceramic Tile' },
      { id: 'gbath-exhaust-fan', label: 'Exhaust Fan' },
      { id: 'gbath-moldings', label: 'Mouldings' },
      { id: 'gbath-marble-sills', label: 'Marble Window Sills' },
      { id: 'gbath-solar-tube', label: 'Solar Tube' },
      { id: 'gbath-drapes', label: 'Drapes' },
      { id: 'gbath-mini-blinds', label: 'Mini-Blinds' },
      { id: 'gbath-floor-covering', label: 'Floor Coverings' },
      { id: 'gbath-light-fixtures', label: 'Light Fixtures' },
      { id: 'gbath-switches', label: 'Switches/Receptacles' },
      { id: 'gbath-linen', label: 'Linen' },
      { id: 'gbath-shower-rod', label: 'Shower Rod' },
      { id: 'gbath-shower-curtain', label: 'Shower Curtain/Décor Drape' },
      { id: 'gbath-shower-head', label: 'Shower Head' },
      { id: 'gbath-tub-shower', label: 'Tub/Shower' },
      { id: 'gbath-commode', label: 'Commode' },
      { id: 'gbath-other', label: 'Other' },
    ],
  },
  {
    id: 'hallway',
    name: 'Hallway',
    items: [
      { id: 'hall-walls', label: 'Walls' },
      { id: 'hall-moldings', label: 'Mouldings' },
      { id: 'hall-floor-covering', label: 'Floor Coverings' },
      { id: 'hall-light-fixtures', label: 'Light Fixtures' },
      { id: 'hall-switches', label: 'Switches/Receptacles' },
      { id: 'hall-pantry', label: 'Pantry/Linen Closet' },
      { id: 'hall-other', label: 'Other' },
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
  startedAt: string;
  completedAt?: string;
  results: ChecklistItemResult[];
  customerSignature?: string;
  technicianSignature?: string;
}
