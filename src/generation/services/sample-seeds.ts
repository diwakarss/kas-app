/**
 * Vertical-aware sample text and name seeds used when generating preview data.
 *
 * Used by both the runtime preview path (WebSpecProvider.generateSampleRecords)
 * and the offline harness (tests/__scratch/ui-review.test.ts) so the cards
 * rendered in both places match the user's actual business rather than
 * defaulting to dentist copy.
 */

import type { KASAppSpec } from '../../core/types/spec';

export type SampleTextBucket = Record<string, string[]>;

export type Vertical =
  | 'health'
  | 'legal'
  | 'real_estate'
  | 'tailoring'
  | 'tour_guide'
  | 'personal_chef'
  | 'wedding'
  | 'education'
  | 'pet_care'
  | 'fitness'
  | 'generic';

export const VERTICAL_SAMPLE_TEXT: Record<Vertical, SampleTextBucket> = {
  health: {
    description: ['Regular checkup and cleaning', 'Follow-up consultation', 'New patient intake'],
    reason: ['Annual wellness exam', 'Persistent cough', 'Post-surgery follow-up'],
    notes: ['Good progress overall', 'Follow up next week', 'On track with plan'],
    note: ['Good progress overall', 'Follow up next week', 'On track with plan'],
  },
  legal: {
    description: ['Drafting settlement agreement', 'Deposition preparation', 'Client discovery review'],
    reason: ['Contract dispute', 'Estate planning intake', 'Employment claim'],
    notes: ['Filing deadline next Friday', 'Awaiting opposing counsel response', 'Client signed retainer'],
    note: ['Filing deadline next Friday', 'Awaiting opposing counsel response', 'Client signed retainer'],
    topic: ['Motion to dismiss', 'Pretrial conference', 'Settlement discussion'],
    title: ['Smith v. Jones', 'Estate of Patel', 'Acme Corp Contract'],
  },
  real_estate: {
    description: ['First showing with buyers', 'Open house walkthrough', 'Offer review meeting'],
    reason: ['Relocation from Bangalore', 'Upsizing for family', 'Investment property search'],
    notes: ['Loved kitchen, unsure about yard', 'Needs inspection report', 'Bidding war expected'],
    note: ['Loved kitchen, unsure about yard', 'Needs inspection report', 'Bidding war expected'],
    address: ['12 Garden Estate, Whitefield', '88 Marine Drive, Mumbai', '5B Koramangala, Bangalore'],
    location: ['12 Garden Estate, Whitefield', '88 Marine Drive, Mumbai', '5B Koramangala, Bangalore'],
  },
  tailoring: {
    description: ['Bridal lehenga, heavy work', 'Two-piece suit, charcoal wool', 'Kurta set, festive trim'],
    reason: ['Wedding next month', 'Office formal wear', 'Festival outfit'],
    notes: ['Awaiting fabric delivery', 'Adjust waist by 2 cm', 'Ready for final fitting'],
    note: ['Awaiting fabric delivery', 'Adjust waist by 2 cm', 'Ready for final fitting'],
    title: ['Bridal lehenga', 'Charcoal suit', 'Festive kurta'],
  },
  tour_guide: {
    description: ['Half-day ancient city walk', 'Vatican and museums combo', 'Evening food and wine tour'],
    notes: ['Group includes two seniors', 'Vegetarian preferences noted', 'Early start requested'],
    note: ['Group includes two seniors', 'Vegetarian preferences noted', 'Early start requested'],
    topic: ['Ancient Rome', 'Vatican City', 'Trastevere food'],
    title: ['Ancient Rome walk', 'Vatican combo tour', 'Evening food tour'],
    meeting_point: ['Piazza del Popolo', 'Spanish Steps', 'Vatican entrance'],
  },
  personal_chef: {
    description: ['Plated tasting menu for six', 'Weekly meal prep, gluten-free', 'Anniversary dinner, coastal'],
    reason: ['Anniversary dinner', 'Dietary-specific meal prep', 'Dinner party for clients'],
    notes: ['No shellfish, pescatarian host', 'Bring own olive oil', 'Use induction cooktop'],
    note: ['No shellfish, pescatarian host', 'Bring own olive oil', 'Use induction cooktop'],
    title: ['Tasting menu', 'Weekly meal prep', 'Anniversary dinner'],
    menu_plan: ['Thai green curry + brown rice', 'Mediterranean bowls', 'Chicken tikka + naan'],
  },
  wedding: {
    description: ['Venue walkthrough and final layout', 'Vendor tasting and sign-off', 'Ceremony rehearsal'],
    notes: ['Bride wants mandap facing east', 'Confirm cocktail hour start time', 'Rain backup: banquet hall'],
    note: ['Bride wants mandap facing east', 'Confirm cocktail hour start time', 'Rain backup: banquet hall'],
    title: ['Venue walkthrough', 'Vendor tasting', 'Rehearsal'],
    topic: ['Mandap setup', 'Reception layout', 'Guest logistics'],
  },
  education: {
    description: ['Algebra fundamentals', 'Essay writing workshop', 'Science fair project'],
    topic: ['Algebra fundamentals', 'Essay writing', 'Science project'],
    activity: ['Arts and crafts', 'Story time', 'Outdoor play'],
    notes: ['Strong on fractions, weak on word problems', 'Needs more speaking practice', 'Ready to advance'],
    note: ['Strong on fractions, weak on word problems', 'Needs more speaking practice', 'Ready to advance'],
  },
  pet_care: {
    description: ['Full grooming package', 'Nail trim and bath', 'Behavioral training session'],
    service: ['Full grooming package', 'Nail trim only', 'Bath and brush'],
    notes: ['Anxious around dryers', 'Prefers female handlers', 'Watch the left hind leg'],
    note: ['Anxious around dryers', 'Prefers female handlers', 'Watch the left hind leg'],
  },
  fitness: {
    description: ['Hypertrophy block, lower body', 'Mobility and recovery session', 'Endurance intervals'],
    style: ['Strength', 'Mobility', 'Endurance'],
    activity: ['Squat progression', 'Mobility flow', 'Interval sprints'],
    notes: ['Tight hips, emphasize warmup', 'Rehab right shoulder', 'Push HR zone 4'],
    note: ['Tight hips, emphasize warmup', 'Rehab right shoulder', 'Push HR zone 4'],
  },
  generic: {
    description: ['First item in the list', 'Second item in the list', 'Third item in the list'],
    notes: ['Good progress.', 'Follow up next week.', 'On track.'],
    note: ['Good progress.', 'Follow up next week.', 'On track.'],
    address: ['123 MG Road, Bangalore', '45 Anna Nagar, Chennai', '78 Park Street, Kolkata'],
    location: ['Main Office', 'Field Site A', 'Field Site B'],
    title: ['Introduction', 'Follow-up', 'Review'],
  },
};

/**
 * Detect the vertical from the spec's entity and field names.
 * Loose keyword matching — enough to pick the closest bucket.
 */
export function detectVertical(spec: Partial<KASAppSpec>): Vertical {
  const entityNames = (spec.entities || []).map(e => e.name.toLowerCase());
  const entityBag = entityNames.join(' ');
  const fieldBag = (spec.entities || [])
    .flatMap(e => (e.fields || []).map(f => f.name.toLowerCase()))
    .join(' ');
  const haystack = `${entityBag} ${fieldBag}`;

  if (/\b(matter|attorney|lawyer|counsel|plaintiff|retainer)\b/.test(haystack)) return 'legal';
  if (/\b(showing|listing|property|offer|realtor|mls)\b/.test(haystack)) return 'real_estate';
  if (/\b(fitting|tailor|fabric|garment|alteration|measurement)\b/.test(haystack)) return 'tailoring';
  if (/\b(tour|guide|itinerary|meeting_point|traveler)\b/.test(haystack)) return 'tour_guide';
  if (/\b(chef|menu|meal|dish|tasting|kitchen|booking)\b/.test(haystack) && /\b(client|customer)\b/.test(haystack)) return 'personal_chef';
  if (/\b(couple|wedding|bride|groom|vendor|venue|ceremony)\b/.test(haystack)) return 'wedding';
  if (/\b(student|lesson|assignment|grade|teacher)\b/.test(haystack)) return 'education';
  if (/\b(pet|kennel|vet|breed)\b/.test(haystack)) return 'pet_care';
  if (/\b(workout|exercise|trainer|gym|rep)\b/.test(haystack)) return 'fitness';
  if (/\b(patient|diagnosis|prescription|medication|dentist|clinic)\b/.test(haystack)) return 'health';
  return 'generic';
}

/** Merge the vertical's bucket over generic so vertical text wins, generic fills holes. */
export function buildSampleText(vertical: Vertical): SampleTextBucket {
  return { ...VERTICAL_SAMPLE_TEXT.generic, ...VERTICAL_SAMPLE_TEXT[vertical] };
}
