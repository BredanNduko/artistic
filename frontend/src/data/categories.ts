/**
 * Template taxonomy.
 *
 * Categories are data, not code — a backend can later serve this list and the
 * UI keeps working. `accent` drives the subtle colour coding on cards.
 */

export interface TemplateCategory {
  id: string;
  label: string;
  description: string;
  accent: string;
  icon: string;
}

export const CATEGORIES: TemplateCategory[] = [
  { id: 'church', label: 'Church', description: 'Services, youth nights and ministry events', accent: '#1d4ed8', icon: 'Church' },
  { id: 'events', label: 'Events', description: 'Concerts, festivals and live shows', accent: '#7c3aed', icon: 'Ticket' },
  { id: 'business', label: 'Business', description: 'Reports, decks and corporate collateral', accent: '#0f766e', icon: 'Briefcase' },
  { id: 'birthday', label: 'Birthday', description: 'Parties, milestones and celebrations', accent: '#db2777', icon: 'Cake' },
  { id: 'wedding', label: 'Wedding', description: 'Invitations, save-the-dates and signage', accent: '#b45309', icon: 'Heart' },
  { id: 'conference', label: 'Conference', description: 'Summits, talks and multi-day programmes', accent: '#4338ca', icon: 'Presentation' },
  { id: 'social-media', label: 'Social Media', description: 'Feed posts, stories and carousels', accent: '#0ea5e9', icon: 'Share2' },
  { id: 'announcements', label: 'Announcements', description: 'Notices, updates and community news', accent: '#ea580c', icon: 'Megaphone' },
  { id: 'education', label: 'Education', description: 'School, campus and learning programmes', accent: '#059669', icon: 'GraduationCap' },
  { id: 'marketing', label: 'Marketing', description: 'Promotions, launches and campaigns', accent: '#e11d48', icon: 'TrendingUp' },
  { id: 'real-estate', label: 'Real Estate', description: 'Listings, open houses and agents', accent: '#0369a1', icon: 'Home' },
  { id: 'technology', label: 'Technology', description: 'Product, SaaS and developer themes', accent: '#6d28d9', icon: 'Cpu' },
];

export function getCategory(id: string | undefined): TemplateCategory | undefined {
  if (!id) return undefined;
  return CATEGORIES.find((c) => c.id === id);
}

export function categoryLabel(id: string | undefined): string {
  return getCategory(id)?.label ?? 'Uncategorised';
}
