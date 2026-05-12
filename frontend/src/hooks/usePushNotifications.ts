import { useEffect, useState } from 'react'
import { useApiFetch } from '../context/AuthContext'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}

async function registerSubscription(apiFetch: ReturnType<typeof useApiFetch>) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const reg = await navigator.serviceWorker.ready
  const keyRes = await apiFetch('/api/push/key')
  if (!keyRes.ok) return
  const { publicKey } = await keyRes.json()

  // Re-use existing subscription if one exists
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = sub.toJSON()
  await apiFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
  })
}

export function usePushNotifications() {
  const apiFetch = useApiFetch()
  const [status, setStatus] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (!('Notification' in window)) return
    setStatus(Notification.permission)
    // Silently re-register if already granted (keeps server subscription fresh)
    if (Notification.permission === 'granted') {
      registerSubscription(apiFetch).catch(() => {})
    }
  }, [])

  const enable = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setStatus(permission)
    if (permission === 'granted') {
      await registerSubscription(apiFetch).catch(() => {})
    }
  }

  return { status, enable }
}
