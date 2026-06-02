interface BreedEntry { breed: string; pct: number }

interface Props {
  breeds?: BreedEntry[] | null
  breed?: string | null
  breedPercentage?: number | null
  className?: string
}

export function BreedDisplay({ breeds, breed, breedPercentage, className }: Props) {
  if (breeds && breeds.length > 0) {
    return (
      <span className={className}>
        {breeds.map((b, i) => (
          <span key={b.breed}>
            {i > 0 && <span style={{ color: 'var(--text-muted)' }}> / </span>}
            {b.pct < 100 ? `${b.pct}% ${b.breed}` : b.breed}
          </span>
        ))}
      </span>
    )
  }
  if (breed) {
    return (
      <span className={className}>
        {breedPercentage && breedPercentage < 100 ? `${breedPercentage}% ${breed}` : breed}
      </span>
    )
  }
  return <span className={className}>—</span>
}
