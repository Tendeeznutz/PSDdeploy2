'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../lib/store'

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const WARNING_TIME = 2 * 60 * 1000 // 2 minutes countdown

export default function InactivityTimer() {
  const [showWarning, setShowWarning] = useState(false)
  const [remainingTime, setRemainingTime] = useState(WARNING_TIME)
  const router = useRouter()

  const { isAuthenticated, logout } = useAuthStore()

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const handleLogout = useCallback(async () => {
    setShowWarning(false)
    clearAllTimers()
    await logout()
    router.push('/login')
  }, [logout, router, clearAllTimers])

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return

    clearAllTimers()
    setShowWarning(false)
    setRemainingTime(WARNING_TIME)

    // Show warning after (INACTIVITY_TIMEOUT - WARNING_TIME) = 3 minutes
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
      setRemainingTime(WARNING_TIME)

      countdownRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1000) {
            clearInterval(countdownRef.current!)
            return 0
          }
          return prev - 1000
        })
      }, 1000)
    }, INACTIVITY_TIMEOUT - WARNING_TIME)

    // Auto-logout at full timeout
    timeoutRef.current = setTimeout(() => {
      handleLogout()
    }, INACTIVITY_TIMEOUT)
  }, [isAuthenticated, clearAllTimers, handleLogout])

  const handleStayLoggedIn = () => {
    resetTimer()
  }

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    if (!isAuthenticated) return

    const events: string[] = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart']

    let lastReset = Date.now()
    const throttledReset = () => {
      const now = Date.now()
      if (now - lastReset > 1000) {
        lastReset = now
        resetTimer()
      }
    }

    events.forEach((event) => {
      document.addEventListener(event, throttledReset, { passive: true })
    })

    resetTimer()

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledReset)
      })
      clearAllTimers()
    }
  }, [isAuthenticated, resetTimer, clearAllTimers])

  if (!isAuthenticated || !showWarning) return null

  const isUrgent = remainingTime < 30 * 1000

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="w-12 h-12 text-yellow-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Session Timeout Warning</h2>

        <p className="text-slate-300 mb-6">
          You will be logged out due to inactivity.
        </p>

        <div className="flex justify-center items-center gap-2 mb-6">
          <Clock className={`w-6 h-6 ${isUrgent ? 'text-red-500' : 'text-slate-400'}`} />
          <span className={`text-4xl font-mono font-bold ${isUrgent ? 'text-red-500' : 'text-white'}`}>
            {formatTime(remainingTime)}
          </span>
        </div>

        <button
          onClick={handleStayLoggedIn}
          className="w-full py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200"
        >
          Stay Logged In
        </button>
      </div>
    </div>
  )
}
