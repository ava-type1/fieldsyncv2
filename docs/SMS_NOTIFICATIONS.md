# SMS Notification System

FieldSync supports SMS notifications via Twilio to keep customers and technicians informed about service progress.

## Features

- **On My Way**: Notify customers when a technician starts traveling to their property
- **Phase Complete**: Notify customers when a service phase is completed
- **Ready for Inspection**: Notify customers when property is ready for inspection
- **Walkthrough Scheduled**: Notify customers when a walkthrough is scheduled
- **Tech Assignment**: Notify technicians of new assignments

## Rate Limiting

To prevent notification spam, the system enforces rate limiting:
- Maximum 1 SMS per customer per hour for the same event type
- Rate limiting is tracked in the `sms_notifications` table
- Technician notifications are not rate limited

## Setup

### 1. Twilio Configuration

Create a Twilio account and set up the following environment variables in your Supabase project:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

To set these in Supabase:
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** > **Secrets**
3. Add each variable

### 2. Database Migration

Run the migration to create the required tables:

```sql
-- Run supabase/migrations/004_sms_notifications.sql
```

This creates:
- `notification_preferences` - Customer notification settings
- `sms_notifications` - SMS log with status tracking

### 3. Deploy Edge Function

Deploy the SMS sending Edge Function:

```bash
supabase functions deploy send-sms
```

## Usage

### In Components

Use the `useNotifications` hook to send notifications:

```tsx
import { useNotifications } from '../hooks/useNotifications';

function MyComponent({ property }) {
  const { sendOnMyWay, sendPhaseComplete, sending, lastError } = useNotifications();

  const handleStartTravel = async () => {
    const success = await sendOnMyWay(property);
    if (success) {
      console.log('Customer notified!');
    }
  };

  return (
    <button onClick={handleStartTravel} disabled={sending}>
      Start Travel
    </button>
  );
}
```

### Direct API Usage

```typescript
import { 
  sendSMS, 
  notifyCustomerOnMyWay,
  notifyCustomerPhaseComplete,
  notifyCustomerReadyForInspection,
  notifyCustomerWalkthroughScheduled,
  notifyTechNewAssignment
} from '../lib/notifications';

// Low-level SMS sending
await sendSMS('+15551234567', 'Hello from FieldSync!');

// High-level notification functions (includes preference checking & rate limiting)
await notifyCustomerOnMyWay(property, 'John Smith');
await notifyCustomerPhaseComplete(property, phase);
await notifyCustomerReadyForInspection(property, '2025-01-25');
await notifyCustomerWalkthroughScheduled(property, '2025-01-26');
await notifyTechNewAssignment(user, property, phase);
```

### Notification Settings Component

Add the `NotificationSettings` component to manage customer preferences:

```tsx
import { NotificationSettings } from '../components/notifications';

<NotificationSettings 
  customer={customer} 
  onClose={() => setShowSettings(false)} 
/>
```

### Notification History Component

Display SMS history for a property:

```tsx
import { NotificationHistory } from '../components/notifications';

<NotificationHistory propertyId={property.id} limit={10} />
```

### Inline Toggle

For quick enable/disable in lists:

```tsx
import { NotificationToggle } from '../components/notifications';

<NotificationToggle 
  customerId={customer.id} 
  initialEnabled={true}
  onChange={(enabled) => console.log('Notifications:', enabled)}
/>
```

## Integration Points

The SMS system is integrated into these existing workflows:

### TimeTracker Component
- Shows toggle to enable/disable "On My Way" notification
- Automatically sends SMS when timer starts (if enabled)
- Shows confirmation when notification is sent

### WalkthroughForm Component
- Fetches customer data for notifications
- Sends "Phase Complete" notification when walkthrough is submitted

### Adding to Other Components

To add notifications to other workflows:

1. Import the hook:
```tsx
import { useNotifications } from '../hooks/useNotifications';
```

2. Use the appropriate send function:
```tsx
const { sendPhaseComplete, sending } = useNotifications();

// When phase is completed
await sendPhaseComplete(property, phase);
```

3. Ensure the property has customer data:
```tsx
// Fetch with customer relation
const { data } = await supabase
  .from('properties')
  .select('*, customer:customers(*)')
  .eq('id', propertyId)
  .single();
```

## Message Templates

Templates are defined in `src/lib/notifications.ts`:

| Event Type | Template |
|------------|----------|
| On My Way | "Hi! Your technician {name} is on the way to {address}. Expected arrival: ~{time} - FieldSync" |
| Phase Complete | "Great news! The {phase} phase has been completed at {address}. We'll keep you updated on the next steps. - FieldSync" |
| Ready for Inspection | "Your property at {address} is ready for inspection! Scheduled for {date}. Please contact us with any questions. - FieldSync" |
| Walkthrough Scheduled | "Your walkthrough at {address} has been scheduled for {date}. We look forward to seeing you! - FieldSync" |
| Tech Assignment | "New assignment: {address}, {city}. Task: {phase}. Open FieldSync for details." |

## Database Schema

### notification_preferences

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK to customers |
| enabled | BOOLEAN | Master toggle |
| on_my_way | BOOLEAN | "On My Way" enabled |
| phase_complete | BOOLEAN | "Phase Complete" enabled |
| ready_for_inspection | BOOLEAN | "Ready for Inspection" enabled |
| walkthrough_scheduled | BOOLEAN | "Walkthrough Scheduled" enabled |

### sms_notifications

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| to_phone | TEXT | Recipient phone number |
| message | TEXT | SMS content |
| event_type | TEXT | Type of notification |
| customer_id | UUID | FK to customers |
| property_id | UUID | FK to properties |
| phase_id | UUID | FK to phases |
| user_id | UUID | FK to users (for tech notifications) |
| status | TEXT | pending/sent/failed/rate_limited |
| twilio_sid | TEXT | Twilio message SID |
| error_message | TEXT | Error details if failed |
| sent_at | TIMESTAMPTZ | When message was sent |

## Testing

Use the test function to verify configuration:

```typescript
import { sendTestSMS } from '../lib/notifications';

const result = await sendTestSMS('+15551234567', 'on_my_way');
console.log(result); // { success: true, messageSid: 'SM...' }
```

Or use the test button in the `NotificationSettings` component.

## Troubleshooting

### SMS not sending

1. Check Twilio credentials are set in Supabase Edge Function secrets
2. Verify phone number format (E.164: +1XXXXXXXXXX)
3. Check `sms_notifications` table for error messages
4. Ensure customer has notifications enabled in preferences

### Rate limited

The system allows max 1 SMS per hour per customer per event type. Check `sms_notifications` for recent sent messages.

### Edge function errors

```bash
# View logs
supabase functions logs send-sms
```
