import { useEffect, useMemo, useState } from 'react'

type InjectorSnapshot = Awaited<ReturnType<typeof window.api.getInjectorSnapshot>>

function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<InjectorSnapshot | null>(null)
  const [pendingAddonId, setPendingAddonId] = useState<string | null>(null)
  const [pendingAutoStart, setPendingAutoStart] = useState(false)

  useEffect(() => {
    let mounted = true

    window.api.getInjectorSnapshot().then((nextSnapshot) => {
      if (mounted) setSnapshot(nextSnapshot)
    })

    const unsubscribe = window.api.onInjectorUpdate((nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const status = getStatus(snapshot)
  const selectedAddonName = snapshot?.selectedAddonName ?? 'Aucun addon selectionne'
  const recentLogs = useMemo(() => [...(snapshot?.logs ?? [])].reverse(), [snapshot?.logs])

  const selectAddon = async (addonId: string): Promise<void> => {
    setPendingAddonId(addonId)
    try {
      setSnapshot(await window.api.setSelectedAddon(addonId))
    } finally {
      setPendingAddonId(null)
    }
  }

  const toggleAutoStart = async (enabled: boolean): Promise<void> => {
    setPendingAutoStart(true)
    try {
      setSnapshot(await window.api.setAutoStartEnabled(enabled))
    } finally {
      setPendingAutoStart(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SimpleAddonApp</p>
          <h1>{status.title}</h1>
          <p className="subtitle">{status.description}</p>
        </div>
        <div className={`status-pill status-${snapshot?.status ?? 'syncing'}`}>
          <span></span>
          {snapshot?.gameRunning ? 'NationsGlory actif' : 'En veille'}
        </div>
      </section>

      <section className="workspace">
        <div className="left-column">
          <section className="panel selection-panel">
            <header className="panel-header">
              <div>
                <h2>Addon a injecter</h2>
                <p>{selectedAddonName}</p>
              </div>
              <strong>{snapshot?.addons.length ?? 0}</strong>
            </header>

            <div className="addon-list">
              {(snapshot?.addons ?? []).map((addon) => {
                const selected = snapshot?.selectedAddonId === addon.id
                const pending = pendingAddonId === addon.id

                return (
                  <label className={`addon-option ${selected ? 'selected' : ''}`} key={addon.id}>
                    <input
                      checked={selected}
                      disabled={pendingAddonId !== null}
                      name="addon"
                      type="radio"
                      onChange={() => selectAddon(addon.id)}
                    />
                    <span>
                      <strong>{addon.name}</strong>
                      <small>{pending ? 'Selection en cours...' : formatBytes(addon.size)}</small>
                    </span>
                  </label>
                )
              })}
              {snapshot?.repositoryReady === false && (
                <div className="empty-state">Recuperation du catalogue GitHub...</div>
              )}
            </div>
          </section>

          <section className="settings-panel">
            <label className="toggle-row">
              <input
                checked={snapshot?.autoStartEnabled ?? false}
                disabled={pendingAutoStart}
                type="checkbox"
                onChange={(event) => toggleAutoStart(event.currentTarget.checked)}
              />
              <span>
                <strong>Lancer avec Windows</strong>
                <small>Garde l&apos;injector pret en arriere-plan.</small>
              </span>
            </label>
          </section>
        </div>

        <section className="panel log-panel">
          <header className="panel-header">
            <div>
              <h2>Activite</h2>
              <p>Les evenements les plus recents sont affiches en premier.</p>
            </div>
            <strong>{recentLogs.length}</strong>
          </header>

          <div className="log-list">
            {recentLogs.map((log) => (
              <div className="log-row" key={`${log.at}-${log.level}-${log.message}`}>
                <time>{new Date(log.at).toLocaleTimeString('fr-FR')}</time>
                <strong className={`log-${log.level.toLowerCase()}`}>{log.level}</strong>
                <p>{log.message}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

function getStatus(snapshot: InjectorSnapshot | null): { title: string; description: string } {
  switch (snapshot?.status) {
    case 'syncing':
      return {
        title: 'Synchronisation',
        description: 'Recuperation du watcher et des addons depuis GitHub.'
      }
    case 'needs-selection':
      return {
        title: 'Selection requise',
        description: 'Choisis un addon avant de lancer NationsGlory.'
      }
    case 'armed':
    case 'waiting-game':
      return {
        title: 'Pret',
        description: 'Le watcher est en place. Lance NationsGlory pour demarrer la surveillance.'
      }
    case 'watching':
      return {
        title: 'Surveillance active',
        description: 'A chaque suppression du watcher, le mod choisi est reinjecte automatiquement.'
      }
    case 'injecting':
      return {
        title: 'Injection',
        description: 'Le watcher a ete retire, injection du mod selectionne.'
      }
    case 'injected':
      return {
        title: 'Injection terminee',
        description: 'Le mod a ete injecte avec succes.'
      }
    case 'error':
      return {
        title: 'Action requise',
        description: 'Une erreur bloque le cycle. Consulte les logs pour le detail.'
      }
    default:
      return {
        title: 'Preparation',
        description: 'Initialisation de l injector.'
      }
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'taille inconnue'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} mo`
}

export default App
