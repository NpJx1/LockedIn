import { FormEvent, useEffect, useRef, useState } from 'react'
import { DEFAULT_TAB_URL, getBlockedPageUrl, isBlockedSocialUrl } from './sitePolicy'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: any
    }
  }
}

type SessionMode = 'idle' | 'locked' | 'break'

type HomeTab = {
  id: string
  type: 'home'
  title: string
}

type WebTab = {
  id: string
  type: 'web'
  title: string
  url: string
  startUrl: string
}

type Tab = HomeTab | WebTab

type WebviewElement = HTMLElement & {
  getURL: () => string
  getTitle: () => string
  loadURL: (url: string) => Promise<void> | void
  goBack: () => void
  goForward: () => void
}

const HOME_TAB_ID = 'home'
const POINTS_STORAGE_KEY = 'lockedin-points'
const STARTING_POINTS = 20
const POINTS_PER_MINUTE = 1
const BREAK_COST = 10
const EMERGENCY_COST = 15
const COMPLETION_BONUS = 20

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createWebTab(url: string, title = 'New Tab'): WebTab {
  return {
    id: createId(),
    type: 'web',
    title,
    url,
    startUrl: url
  }
}

function toFileUrl(filePath: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(filePath)) return filePath
  const normalized = filePath.replace(/\\/g, '/')
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return `file://${encodeURI(withLeadingSlash)}`
}

function isPdfUrl(url: string): boolean {
  return /\.pdf($|[?#])/i.test(url)
}

function normalizeAddress(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return DEFAULT_TAB_URL
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed
  if (trimmed.includes(' ') || !trimmed.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  }
  return `https://${trimmed}`
}

function loadPoints(): number {
  const raw = window.localStorage.getItem(POINTS_STORAGE_KEY)
  if (raw === null) return STARTING_POINTS
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : STARTING_POINTS
}

function App() {
  const [timeLeft, setTimeLeft] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [isLockedIn, setIsLockedIn] = useState(false)
  const [phase, setPhase] = useState<SessionMode>('idle')
  const [points, setPoints] = useState(loadPoints)
  const [tabs, setTabs] = useState<Tab[]>([{ id: HOME_TAB_ID, type: 'home', title: 'Timer' }])
  const [activeTabId, setActiveTabId] = useState(HOME_TAB_ID)
  const [address, setAddress] = useState('')
  const intervalRef = useRef<number | null>(null)
  const focusedSecondsRef = useRef(0)
  const webviewRefs = useRef<Record<string, WebviewElement | null>>({})

  const presetTimes = [
    { label: '15 MIN', minutes: 15 },
    { label: '30 MIN', minutes: 30 },
    { label: '60 MIN', minutes: 60 },
    { label: '120 MIN', minutes: 120 }
  ]

  const canUseBrowser = phase === 'locked' || phase === 'break'
  const canAffordBreak = points >= BREAK_COST
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const webTabs = tabs.filter((tab): tab is WebTab => tab.type === 'web')
  const showBrowserRoom = canUseBrowser && activeTab?.type === 'web'

  useEffect(() => {
    window.localStorage.setItem(POINTS_STORAGE_KEY, String(points))
  }, [points])

  useEffect(() => {
    window.api?.setSessionMode?.(phase)
    setIsLockedIn(phase === 'locked')
  }, [phase])

  useEffect(() => {
    if (isActive && phase === 'locked' && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        focusedSecondsRef.current += 1
        if (focusedSecondsRef.current % 60 === 0) {
          setPoints((current) => current + POINTS_PER_MINUTE)
        }

        setTimeLeft((time) => {
          if (time <= 1) {
            setIsActive(false)
            setPhase('idle')
            setActiveTabId(HOME_TAB_ID)
            setPoints((current) => current + COMPLETION_BONUS)
            focusedSecondsRef.current = 0
            return 0
          }
          return time - 1
        })
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isActive, phase, timeLeft])

  useEffect(() => {
    const unsubscribe = window.api?.onOpenTab?.((url) => {
      if (phase === 'idle') return
      openUrlInTab(url)
    })
    return () => {
      unsubscribe?.()
    }
  }, [phase, webTabs])

  const updateWebTab = (id: string, patch: Partial<WebTab>): void => {
    setTabs((current) =>
      current.map((tab) => (tab.id === id && tab.type === 'web' ? { ...tab, ...patch } : tab))
    )
  }

  const openUrlInTab = (rawUrl: string, targetTabId?: string): void => {
    if (phase === 'idle') return

    const shouldBlock = phase === 'locked' && isBlockedSocialUrl(rawUrl)
    const url = shouldBlock ? getBlockedPageUrl() : rawUrl
    const existing = targetTabId ? webTabs.find((tab) => tab.id === targetTabId) : undefined

    if (existing) {
      const webview = webviewRefs.current[existing.id]
      if (webview) {
        void webview.loadURL(url)
      }
      updateWebTab(existing.id, { url, title: shouldBlock ? 'Blocked' : existing.title })
      setActiveTabId(existing.id)
      setAddress(shouldBlock ? rawUrl : url)
      return
    }

    const tab = createWebTab(url)
    setTabs((current) => [...current, tab])
    setActiveTabId(tab.id)
    setAddress(url)
  }

  const openPdfInTab = (filePath: string): void => {
    if (phase === 'idle') return
    const url = toFileUrl(filePath)
    const fileName = filePath.split(/[\\/]/).pop() ?? 'PDF'
    const tab = createWebTab(url, fileName)
    setTabs((current) => [...current, tab])
    setActiveTabId(tab.id)
    setAddress(url)
  }

  const handleOpenPdf = async (): Promise<void> => {
    if (!canUseBrowser) return
    const filePath = await window.api?.openPdfDialog?.()
    if (!filePath) return
    openPdfInTab(filePath)
  }

  const ensureBrowserTab = (): void => {
    if (webTabs.length === 0) {
      const tab = createWebTab(DEFAULT_TAB_URL)
      setTabs((current) => [...current, tab])
      setActiveTabId(tab.id)
      setAddress(DEFAULT_TAB_URL)
      return
    }

    const lastWebTab = webTabs[webTabs.length - 1]
    setActiveTabId(lastWebTab.id)
    setAddress(lastWebTab.url)
  }

  const startTimer = (minutes: number): void => {
    focusedSecondsRef.current = 0
    setTimeLeft(minutes * 60)
    setIsActive(true)
    setPhase('locked')
    ensureBrowserTab()
  }

  const resumeLock = (): void => {
    if (timeLeft <= 0) return
    setIsActive(true)
    setPhase('locked')
    ensureBrowserTab()
  }

  const takeBreak = (): void => {
    if (phase !== 'locked' || !canAffordBreak) return
    setPoints((current) => current - BREAK_COST)
    setIsActive(false)
    setPhase('break')
  }

  const takeEmergencyBreak = (): void => {
    if (phase !== 'locked') return
    setPoints((current) => current - EMERGENCY_COST)
    setIsActive(false)
    setPhase('break')
  }

  const endSession = (): void => {
    setIsActive(false)
    setPhase('idle')
    setTimeLeft(0)
    setActiveTabId(HOME_TAB_ID)
    focusedSecondsRef.current = 0
  }

  const addTab = (): void => {
    if (!canUseBrowser) return
    openUrlInTab(DEFAULT_TAB_URL)
  }

  const closeTab = (id: string): void => {
    if (!canUseBrowser) return
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id)
      if (activeTabId === id) {
        const fallback = next[next.length - 1] ?? next[0]
        setActiveTabId(fallback.id)
        setAddress(fallback.type === 'web' ? fallback.url : '')
      }
      return next
    })
    delete webviewRefs.current[id]
  }

  const selectTab = (tab: Tab): void => {
    if (!canUseBrowser && tab.type === 'web') return
    setActiveTabId(tab.id)
    if (tab.type === 'home') {
      setAddress('')
      return
    }
    setAddress(tab.url)
  }

  const goBack = (): void => {
    if (activeTab?.type === 'web') {
      webviewRefs.current[activeTab.id]?.goBack()
    }
  }

  const goForward = (): void => {
    if (activeTab?.type === 'web') {
      webviewRefs.current[activeTab.id]?.goForward()
    }
  }

  const submitAddress = (event: FormEvent): void => {
    event.preventDefault()
    if (!canUseBrowser) return
    if (activeTab?.type !== 'web') {
      openUrlInTab(normalizeAddress(address))
      return
    }
    openUrlInTab(normalizeAddress(address), activeTab.id)
  }

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`
  }

  const attachWebview = (id: string, node: HTMLElement | null): void => {
    const webview = node as WebviewElement | null
    webviewRefs.current[id] = webview
    if (!webview || webview.dataset.bound === 'true') return
    webview.dataset.bound = 'true'

    const syncTab = (): void => {
      const currentUrl = webview.getURL()
      const rawTitle = webview.getTitle()
      const fallbackTitle = isPdfUrl(currentUrl)
        ? decodeURIComponent(currentUrl.split(/[\\/]/).pop() ?? 'PDF')
        : 'New Tab'
      const title = rawTitle || fallbackTitle
      updateWebTab(id, { url: currentUrl, title })
      setActiveTabId((currentId) => {
        if (currentId === id) {
          setAddress(currentUrl.startsWith('data:') ? '' : currentUrl)
        }
        return currentId
      })
    }

    webview.addEventListener('did-navigate', syncTab)
    webview.addEventListener('did-navigate-in-page', syncTab)
    webview.addEventListener('page-title-updated', syncTab)
    webview.addEventListener('did-finish-load', syncTab)
  }

  return (
    <div className="app-shell">
      {canUseBrowser && (
        <div className="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'tab-active' : ''}`}
              onClick={() => selectTab(tab)}
            >
              <span className="tab-title">{tab.title}</span>
              {tab.type === 'web' && (
                <span
                  className="tab-close"
                  onClick={(event) => {
                    event.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button className="tab tab-new" onClick={addTab} title="New tab">
            +
          </button>
          <button className="tab tab-pdf" onClick={handleOpenPdf} title="Open a local PDF">
            Open PDF
          </button>
          <span className={`tab-points ${points < 0 ? 'points-debt' : ''}`}>
            {points} PTS
          </span>
          {formatTime(timeLeft)}
                  </div>
      )}

      {showBrowserRoom && (
        <form className="address-bar" onSubmit={submitAddress}>
          <button type="button" className="btn btn-small" onClick={goBack}>
            ←
          </button>
          <button type="button" className="btn btn-small" onClick={goForward}>
            →
          </button>
          <input
            className="address-input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Search or enter a URL"
          />
          <button type="submit" className="btn btn-small">
            Go
          </button>
        </form>
      )}

      <div className="content-area">
        <div className={showBrowserRoom ? 'home-view home-view-hidden' : 'home-view'}>
          <div className="app-container">
            <h1 className="title">Locked In</h1>
            <div className={`points-display ${points < 0 ? 'points-debt' : ''}`}>
              {points} PTS
            </div>
            <div className="timer-display">{formatTime(timeLeft)}</div>
            {phase === 'idle' && (
              <div className="controls-container">
                {presetTimes.map((preset) => (
                  <button
                    key={preset.minutes}
                    className="btn"
                    onClick={() => startTimer(preset.minutes)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            {phase === 'locked' && (
              <div className="controls-container">
                <button
                  className="btn"
                  onClick={takeBreak}
                  disabled={!canAffordBreak}
                  title={canAffordBreak ? `Spend ${BREAK_COST} points` : `Need ${BREAK_COST} points`}
                >
                  Take Break · {BREAK_COST} PTS
                </button>
                <button className="btn btn-danger" onClick={takeEmergencyBreak}>
                  Emergency Break · {EMERGENCY_COST} PTS
                </button>
              </div>
            )}
            {phase === 'break' && (
              <div className="controls-container">
                {timeLeft > 0 && (
                  <button className="btn btn-active" onClick={resumeLock}>
                    Resume Lock
                  </button>
                )}
                <button className="btn" onClick={endSession}>
                  End Session
                </button>
              </div>
            )}
            <p className="session-copy">
              {phase === 'idle' && 'Set a timer to lock in. The browser stays closed until a session starts. It is recommended you use only one screen to focus and not cheat yourself.'}
              {phase === 'locked' &&
                `Locked in. Earn ${POINTS_PER_MINUTE} pt per minute. A break costs ${BREAK_COST} pts. Emergency break costs ${EMERGENCY_COST} pts and can go into debt.`}
              {phase === 'break' &&
                'On break. This window is unlocked so you can alt-tab. Resume to lock in again.'}
            </p>
          </div>
        </div>

        <div className={showBrowserRoom ? 'browser-container' : 'browser-container browser-hidden'}>
          {webTabs.map((tab) => (
            <webview
              key={tab.id}
              className={tab.id === activeTabId ? 'webview-frame' : 'webview-frame webview-hidden'}
              src={tab.startUrl}
              partition="persist:lockedin"
              allowpopups={true}
              webpreferences="plugins"
              ref={(node) => attachWebview(tab.id, node)}
            />
          ))}
          {isLockedIn && (
            <div className="floating-timer">
              <span className="floating-time">{formatTime(timeLeft)}</span>
              <span className={`floating-points ${points < 0 ? 'points-debt' : ''}`}>
                {points} PTS
              </span>
              <button
                className="btn btn-small"
                onClick={takeBreak}
                disabled={!canAffordBreak}
              >
                Break
              </button>
              <button className="btn btn-danger btn-small" onClick={takeEmergencyBreak}>
                Emergency
              </button>
            </div>
          )}
          {phase === 'break' && (
            <div className="floating-timer">
              <span className="floating-time">BREAK</span>
              <span className={`floating-points ${points < 0 ? 'points-debt' : ''}`}>
                {points} PTS
              </span>
              {timeLeft > 0 && (
                <button className="btn btn-small btn-active" onClick={resumeLock}>
                  Resume
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
