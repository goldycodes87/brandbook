export default function OwnerPortalPage() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      <div className="text-center">
        <div className="flex items-end justify-center gap-0 leading-none mb-4">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
        </div>
        <p className="type-page-subtitle">Owner Portal — Access restricted</p>
      </div>
    </div>
  )
}
