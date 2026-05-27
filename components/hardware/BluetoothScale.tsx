'use client'

// Gallagher W0 Bluetooth support
// Web Bluetooth works on: Chrome desktop, Android Chrome
// Does NOT work on iOS Safari — iOS users: use CSV import instead

import { useState } from 'react'
import { Bluetooth, BluetoothConnected, BluetoothOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'

interface BluetoothScaleProps {
  onWeight: (lbs: number) => void
}

// Web Bluetooth API types not in default TS lib
interface BtDevice {
  name?: string
  gatt?: { connect(): Promise<BtServer>; disconnect(): void }
}
interface BtServer {
  getPrimaryService(uuid: string): Promise<BtService>
}
interface BtService {
  getCharacteristics(): Promise<BtChar[]>
}
interface BtChar {
  readValue(): Promise<DataView>
}

type State = 'idle' | 'connecting' | 'connected' | 'reading'

export function BluetoothScale({ onWeight }: BluetoothScaleProps) {
  const [state, setState]   = useState<State>('idle')
  const [device, setDevice] = useState<BtDevice | null>(null)
  const [error, setError]   = useState('')

  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

  const connect = async () => {
    setError('')
    setState('connecting')
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dev: BtDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'heart_rate',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
        ],
      })
      setDevice(dev)
      setState('connected')
    } catch (err: unknown) {
      setState('idle')
      if ((err as Error).name !== 'NotFoundError') {
        setError('Could not connect — check the scale is on and in range')
      }
    }
  }

  const readWeight = async () => {
    if (!device) return
    setState('reading')
    setError('')
    try {
      const server  = await device.gatt!.connect()
      let value: DataView | null = null
      for (const serviceUuid of ['0000ffe0-0000-1000-8000-00805f9b34fb', 'heart_rate']) {
        try {
          const service = await server.getPrimaryService(serviceUuid)
          const chars   = await service.getCharacteristics()
          if (chars.length > 0) {
            value = await chars[0].readValue()
            break
          }
        } catch { /* try next service */ }
      }
      if (value) {
        // Attempt to parse as little-endian uint16 (grams → lbs) or float
        const raw = value.byteLength >= 4
          ? value.getFloat32(0, true)
          : value.getUint16(0, true) / 1000
        const lbs = parseFloat((raw * 2.20462).toFixed(1))
        onWeight(lbs)
      } else {
        setError('Could not read weight — try again')
      }
    } catch {
      setError('Read failed — ensure scale is showing a stable weight')
    } finally {
      setState('connected')
    }
  }

  const disconnect = () => {
    device?.gatt?.disconnect?.()
    setDevice(null)
    setState('idle')
    setError('')
  }

  if (!supported) {
    return (
      <div className="flex items-center gap-2 py-2">
        <BluetoothOff size={16} style={{ color: 'var(--text-muted)' }} />
        <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
          Bluetooth not supported — use CSV import or manual entry
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {state === 'idle' && (
        <Button type="button" intent="secondary" size="sm" leading={<Bluetooth size={15} />} onClick={connect}>
          CONNECT SCALE
        </Button>
      )}

      {state === 'connecting' && (
        <Button type="button" intent="secondary" size="sm" loading disabled>
          CONNECTING…
        </Button>
      )}

      {(state === 'connected' || state === 'reading') && (
        <div className="flex items-center gap-2 flex-wrap">
          <Chip tone="success" size="sm">
            <BluetoothConnected size={12} className="mr-1" />
            {device?.name ?? 'Connected'}
          </Chip>
          <Button
            type="button"
            intent="primary"
            size="sm"
            loading={state === 'reading'}
            onClick={readWeight}
          >
            READ WEIGHT
          </Button>
          <Button type="button" intent="ghost" size="sm" onClick={disconnect}>
            DISCONNECT
          </Button>
        </div>
      )}

      {error && (
        <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>
      )}
    </div>
  )
}
