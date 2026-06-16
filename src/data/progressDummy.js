// Dummy student progress data for the new Progress views.
// Replace with backend data when we wire up auth/storage.

export const SKILL_CATEGORIES = {
  vowel:     { label: 'Vowel',     color: '#7c1d1d' },
  consonant: { label: 'Consonant', color: '#1e40af' },
  sheva:     { label: 'Sheva',     color: '#15803d' },
}

export const dummyStudents = [
  {
    id: 's1',
    name: 'Daniel Cohen',
    totalRecordings: 12,
    avgScore: 87,
    monthlyAvg: 88,
    lastMonthAvg: 83,
    lastActivity: 'today',
    scoreHistory: [
      { date: 'May 14', score: 72 },
      { date: 'May 21', score: 76 },
      { date: 'May 28', score: 78 },
      { date: 'Jun 03', score: 81 },
      { date: 'Jun 06', score: 84 },
      { date: 'Jun 09', score: 86 },
      { date: 'Jun 11', score: 89 },
      { date: 'Jun 13', score: 88 },
      { date: 'Jun 15', score: 91 },
      { date: 'Jun 16', score: 87 },
    ],
    skills: [
      { name: 'Patach',          glyph: 'ַ',  accuracy: 95, attempts: 45, category: 'vowel' },
      { name: 'Cholam',          glyph: 'ֹ',  accuracy: 93, attempts: 38, category: 'vowel' },
      { name: 'Shin',            glyph: 'שׁ', accuracy: 94, attempts: 27, category: 'consonant' },
      { name: 'Kamatz',          glyph: 'ָ',  accuracy: 88, attempts: 38, category: 'vowel' },
      { name: 'Tav (w/ dagesh)', glyph: 'תּ', accuracy: 92, attempts: 20, category: 'consonant' },
      { name: 'Mappiq',          glyph: 'הּ', accuracy: 89, attempts: 8,  category: 'consonant' },
      { name: 'Sheva na',        glyph: 'ְ',  accuracy: 65, attempts: 22, category: 'sheva' },
      { name: 'Tav/Sav',         glyph: 'ת',  accuracy: 72, attempts: 15, category: 'consonant' },
      { name: 'Sin',             glyph: 'שׂ', accuracy: 78, attempts: 9,  category: 'consonant' },
      { name: 'Sheva nach',      glyph: 'ְ',  accuracy: 84, attempts: 30, category: 'sheva' },
    ],
    recordings: [
      { date: 'Today',      verseHe: 'בראשית יב:א', verseEn: 'Bereshit 12:1', score: 85, issues: ['Sheva na', 'Tav/Sav'] },
      { date: 'Yesterday',  verseHe: 'בראשית יב:ב', verseEn: 'Bereshit 12:2', score: 91, issues: ['Tav/Sav'] },
      { date: 'Jun 15',     verseHe: 'תהלים כג:א',  verseEn: 'Tehillim 23:1', score: 88, issues: ['Sheva na'] },
      { date: 'Jun 13',     verseHe: 'בראשית יב:א', verseEn: 'Bereshit 12:1', score: 90, issues: [] },
      { date: 'Jun 11',     verseHe: 'בראשית יב:ג', verseEn: 'Bereshit 12:3', score: 89, issues: ['Sheva na'] },
      { date: 'Jun 09',     verseHe: 'בראשית יב:ד', verseEn: 'Bereshit 12:4', score: 86, issues: ['Sin', 'Sheva na'] },
      { date: 'Jun 06',     verseHe: 'בראשית יב:ה', verseEn: 'Bereshit 12:5', score: 84, issues: ['Tav/Sav'] },
      { date: 'Jun 03',     verseHe: 'משלי ג:יז',   verseEn: 'Mishlei 3:17',  score: 81, issues: ['Mappiq'] },
      { date: 'May 28',     verseHe: 'תהלים כג:א',  verseEn: 'Tehillim 23:1', score: 78, issues: ['Sheva na', 'Sin'] },
      { date: 'May 21',     verseHe: 'בראשית יב:א', verseEn: 'Bereshit 12:1', score: 76, issues: ['Sheva na', 'Tav/Sav'] },
    ],
  },
  {
    id: 's2',
    name: 'Sarah Goldberg',
    totalRecordings: 8,
    avgScore: 91,
    monthlyAvg: 91,
    lastMonthAvg: 90,
    lastActivity: '2 days ago',
    scoreHistory: [
      { date: 'May 28', score: 88 },
      { date: 'Jun 02', score: 90 },
      { date: 'Jun 05', score: 91 },
      { date: 'Jun 07', score: 89 },
      { date: 'Jun 10', score: 92 },
      { date: 'Jun 12', score: 93 },
      { date: 'Jun 14', score: 92 },
      { date: 'Jun 14', score: 91 },
    ],
    skills: [
      { name: 'Patach',     glyph: 'ַ',  accuracy: 96, attempts: 32, category: 'vowel' },
      { name: 'Cholam',     glyph: 'ֹ',  accuracy: 94, attempts: 28, category: 'vowel' },
      { name: 'Shin',       glyph: 'שׁ', accuracy: 97, attempts: 18, category: 'consonant' },
      { name: 'Sin',        glyph: 'שׂ', accuracy: 95, attempts: 12, category: 'consonant' },
      { name: 'Kamatz',     glyph: 'ָ',  accuracy: 92, attempts: 28, category: 'vowel' },
      { name: 'Tav/Sav',    glyph: 'ת',  accuracy: 75, attempts: 12, category: 'consonant' },
      { name: 'Sheva na',   glyph: 'ְ',  accuracy: 87, attempts: 18, category: 'sheva' },
      { name: 'Sheva nach', glyph: 'ְ',  accuracy: 93, attempts: 22, category: 'sheva' },
    ],
    recordings: [
      { date: '2d ago',  verseHe: 'שמות טו:א',  verseEn: 'Shemot 15:1',  score: 91, issues: ['Tav/Sav'] },
      { date: '4d ago',  verseHe: 'בראשית יב:א', verseEn: 'Bereshit 12:1', score: 92, issues: [] },
      { date: '6d ago',  verseHe: 'בראשית יב:ב', verseEn: 'Bereshit 12:2', score: 93, issues: [] },
      { date: '8d ago',  verseHe: 'תהלים כג:א',  verseEn: 'Tehillim 23:1', score: 92, issues: ['Tav/Sav'] },
      { date: '11d ago', verseHe: 'בראשית יב:ג', verseEn: 'Bereshit 12:3', score: 89, issues: ['Tav/Sav'] },
    ],
  },
  {
    id: 's3',
    name: 'Avi Levin',
    totalRecordings: 3,
    avgScore: 75,
    monthlyAvg: 75,
    lastMonthAvg: null,
    lastActivity: 'today',
    scoreHistory: [
      { date: 'Jun 12', score: 71 },
      { date: 'Jun 14', score: 76 },
      { date: 'Jun 16', score: 78 },
    ],
    skills: [
      { name: 'Patach',   glyph: 'ַ',  accuracy: 88, attempts: 12, category: 'vowel' },
      { name: 'Kamatz',   glyph: 'ָ',  accuracy: 82, attempts: 11, category: 'vowel' },
      { name: 'Cholam',   glyph: 'ֹ',  accuracy: 80, attempts: 9,  category: 'vowel' },
      { name: 'Shin',     glyph: 'שׁ', accuracy: 65, attempts: 7,  category: 'consonant' },
      { name: 'Sin',      glyph: 'שׂ', accuracy: 58, attempts: 4,  category: 'consonant' },
      { name: 'Tav/Sav',  glyph: 'ת',  accuracy: 70, attempts: 6,  category: 'consonant' },
      { name: 'Sheva na', glyph: 'ְ',  accuracy: 68, attempts: 8,  category: 'sheva' },
    ],
    recordings: [
      { date: 'Today',    verseHe: 'בראשית יב:א', verseEn: 'Bereshit 12:1', score: 78, issues: ['Shin', 'Sin', 'Sheva na'] },
      { date: '2d ago',   verseHe: 'בראשית יב:א', verseEn: 'Bereshit 12:1', score: 76, issues: ['Shin', 'Sin'] },
      { date: '4d ago',   verseHe: 'תהלים כג:א',  verseEn: 'Tehillim 23:1', score: 71, issues: ['Shin', 'Sin', 'Sheva na', 'Tav/Sav'] },
    ],
  },
  {
    id: 's4',
    name: 'Rachel Stein',
    totalRecordings: 0,
    avgScore: null,
    monthlyAvg: null,
    lastMonthAvg: null,
    lastActivity: 'never',
    scoreHistory: [],
    skills: [],
    recordings: [],
  },
]

// Derive top issue across recent recordings
export function topIssueFor(student) {
  if (!student.recordings?.length) return null
  const counts = {}
  for (const r of student.recordings) for (const issue of r.issues) counts[issue] = (counts[issue] ?? 0) + 1
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

export function trendFor(student) {
  if (!student.monthlyAvg || !student.lastMonthAvg) return null
  const delta = student.monthlyAvg - student.lastMonthAvg
  if (delta > 1) return { dir: 'up', pct: `+${delta}%` }
  if (delta < -1) return { dir: 'down', pct: `${delta}%` }
  return { dir: 'flat', pct: '~' }
}
