import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';

const BASE_URL = 'http://localhost:4173';
const SCREENSHOT_DIR = './screenshots';

// Seed some test data via localStorage before navigating
const seedData = JSON.stringify({
  state: {
    jobs: [
      {
        id: 'demo-1',
        jobType: 'walkthrough',
        status: 'active',
        customerName: 'Jessica Noel-Medeiros',
        phone: '904-555-1234',
        street: '14523 SE 77th Lane',
        city: 'Jacksonville',
        state: 'FL',
        zip: '32218',
        serialNumber: 'N1-17697AB',
        poNumber: '9090',
        model: 'Hailey',
        salesperson: 'Taylor',
        notes: 'Initial walkthrough scheduled',
        photos: [],
        materials: [
          { id: 'm1', name: 'Marriage Line Trim', quantity: 2, unit: 'pcs', category: 'trim', status: 'needed' },
          { id: 'm2', name: 'Caulk', quantity: 4, unit: 'tubes', category: 'other', status: 'purchased' }
        ],
        signatures: [],
        checklistItems: [
          { id: 'c1', label: 'Inspect marriage line', completed: true, completedAt: '2025-01-15T10:00:00Z' },
          { id: 'c2', label: 'Check plumbing', completed: true, completedAt: '2025-01-15T10:30:00Z' },
          { id: 'c3', label: 'Check electrical', completed: false },
          { id: 'c4', label: 'HVAC startup', completed: false },
          { id: 'c5', label: 'Inspect flooring', completed: false },
        ],
        createdAt: '2025-01-15T08:00:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      },
      {
        id: 'demo-2',
        jobType: 'work_order',
        status: 'in_progress',
        customerName: 'Steven Cover',
        phone: '352-555-5678',
        street: '8810 NW 144th Ave',
        city: 'Trenton',
        state: 'FL',
        zip: '32693',
        serialNumber: 'N1-17679AB',
        poNumber: '9085',
        model: 'Kingswood',
        notes: 'Return work - trim and paint touchup',
        photos: [],
        materials: [],
        signatures: [],
        checklistItems: [],
        createdAt: '2025-01-14T09:00:00Z',
        updatedAt: '2025-01-15T14:00:00Z',
      },
      {
        id: 'demo-3',
        jobType: 'walkthrough',
        status: 'completed',
        customerName: 'Maria Rodriguez',
        phone: '352-555-9012',
        street: '2201 SW 3rd St',
        city: 'Ocala',
        state: 'FL',
        zip: '34471',
        serialNumber: 'N1-17552',
        model: 'Palm Bay',
        notes: '',
        photos: [],
        materials: [],
        signatures: [],
        checklistItems: [],
        createdAt: '2025-01-10T08:00:00Z',
        updatedAt: '2025-01-12T16:00:00Z',
        completedAt: '2025-01-12T16:00:00Z',
      }
    ]
  },
  version: 0,
});

// Seed pay entries
const seedPayData = JSON.stringify([
  {
    id: '1',
    date: '2025-01-15',
    type: 'walkthrough',
    milesOneWay: 45,
    trips: 1,
    customerName: 'Jessica Noel-Medeiros',
    poNumber: '9090',
    serialNumber: 'N1-17697AB',
  },
  {
    id: '2',
    date: '2025-01-14',
    dateEnd: '2025-01-15',
    type: 'return',
    milesOneWay: 59,
    trips: 4,
    hours: 16,
    customerName: 'Steven Cover',
    poNumber: '9085',
    serialNumber: 'N1-17679AB',
  }
]);

async function takeScreenshots() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: 'new',
  });

  const page = await browser.newPage();
  
  // iPhone 14 Pro viewport
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
  
  // Navigate to base URL first to set localStorage
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  
  // Inject seed data
  await page.evaluate((jobsData, payData) => {
    localStorage.setItem('fieldsync-jobs', jobsData);
    localStorage.setItem('payEntries', payData);
  }, seedData, seedPayData);

  // 1. Jobs Screen
  await page.goto(`${BASE_URL}/jobs`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-jobs.png`, fullPage: false });
  console.log('✅ Jobs screenshot');

  // 2. Scan Screen
  await page.goto(`${BASE_URL}/scan`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-scan.png`, fullPage: false });
  console.log('✅ Scan screenshot');

  // 3. Map Screen
  await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-map.png`, fullPage: false });
  console.log('✅ Map screenshot');

  // 4. Pay Screen
  await page.goto(`${BASE_URL}/pay`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-pay.png`, fullPage: false });
  console.log('✅ Pay screenshot');

  // 5. Job Detail Screen
  await page.goto(`${BASE_URL}/job/demo-1`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-job-detail.png`, fullPage: false });
  console.log('✅ Job Detail screenshot');

  await browser.close();
  console.log('\n📸 All screenshots saved to ./screenshots/');
}

takeScreenshots().catch(err => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
