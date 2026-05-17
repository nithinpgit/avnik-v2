export type ConferenceGridLayout = {
  cols: number
  rows: number
}

/**
 * Grid dimensions that fill the conference stage:
 * - 1 participant → full area
 * - 2 participants → side-by-side halves
 * - 3+ → near-square grid sized to participant count
 */
export function getConferenceGridLayout(participantCount: number): ConferenceGridLayout {
  const n = Math.max(1, participantCount)
  if (n === 1) return { cols: 1, rows: 1 }
  if (n === 2) return { cols: 2, rows: 1 }

  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { cols, rows }
}
