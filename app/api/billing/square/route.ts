export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    error: 'Square integration coming soon',
    scaffold: true,
  }, { status: 501 })
}
