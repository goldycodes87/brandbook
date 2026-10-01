/**
 * How an animal is named on anything an owner reads.
 *
 * "White Angus cow" put the tag colour where the hide colour goes, so Daphne
 * read as a white cow. She is black. The colour belongs to the ear tag, so it
 * goes with the tag:
 *
 *     Angus Cow
 *     White Tag 2
 *
 * Breed and sex say what she is; the tag says which one she is. Keeping them
 * apart also means a missing breed or a missing colour drops a word instead of
 * producing "Yellow cow" and leaving the reader to guess which half is true.
 */

const SEX_WORD: Record<string, string> = {
  cow: 'Cow', heifer: 'Heifer', calf: 'Calf',
  steer: 'Steer', bull: 'Bull',
}

export interface AnimalLabel {
  /** 'Angus Cow', 'Brangus Pair', 'Calf'. */
  title: string
  /** 'White Tag 2', 'Yellow Tags 41 & 38', 'Tag 37'. */
  tagLine: string
}

export function describeAnimal(a: {
  sex?: string | null
  breed?: string | null
  ear_tag_color?: string | null
  tag_number?: string | null
  name?: string | null
  /** A cow with a calf at side, sold and priced as one. */
  isPair?: boolean | null
  /** The calf's tag, when this is a pair. */
  pairTag?: string | null
}): AnimalLabel {
  const kind = a.isPair ? 'Pair' : (SEX_WORD[(a.sex ?? '').toLowerCase()] ?? 'Animal')
  const breed = (a.breed ?? '').trim()

  const tags = a.isPair && a.pairTag
    ? `Tags ${a.tag_number} & ${a.pairTag}`
    : `Tag ${a.tag_number ?? '—'}`

  const colour = (a.ear_tag_color ?? '').trim()
  const name   = (a.name ?? '').trim()

  return {
    title:   breed ? `${breed} ${kind}` : kind,
    // The name earns its place at the end: it is how the owner actually refers
    // to her, but the tag is how she is identified.
    tagLine: [colour ? `${colour} ${tags}` : tags, name].filter(Boolean).join(' · '),
  }
}
