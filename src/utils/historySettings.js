// Settings an attempt was graded with. Entries saved before settings were stored
// on the entry fall back to the rules-engine raw segment (Manual / OpenAI Rules);
// older Azure / OpenAI (LLM) entries have no record and return null.
export function entrySettings(entry) {
  return entry?.settings ?? entry?.rawSegments?.[0]?.settings ?? null
}

// Human-readable list of the ways an attempt's grading settings differ from the
// current ones, e.g. ["Ashkenazic", "sheva ignored"]. Empty when they match.
export function settingsDiff(graded, current) {
  if (!graded) return []
  const out = []
  const tradition = graded.tradition ?? 'sephardic'
  const shevaMode = graded.shevaMode ?? 'enforce'
  if (tradition !== current.tradition) out.push(tradition === 'ashkenazic' ? 'Ashkenazic' : 'Sephardic')
  if (shevaMode !== current.shevaMode) out.push(shevaMode === 'ignore' ? 'sheva ignored' : 'sheva enforced')
  return out
}
