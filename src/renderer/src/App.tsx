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

  const statusLabel = useMemo(() => {
    switch (snapshot?.status) {
      case 'syncing':
        return 'Recuperation GitHub'
      case 'needs-selection':
        return 'Choisis un addon'
      case 'armed':
        return 'Watcher installe'
      case 'waiting-game':
        return 'En attente du jeu'
      case 'watching':
        return 'Surveillance active'
      case 'injecting':
        return 'Injection en cours'
      case 'injected':
        return 'Addon injecte'
      case 'error':
        return 'Erreur'
      default:
        return 'Preparation'
    }
  }, [snapshot?.status])

  const selectedAddonName = snapshot?.selectedAddonName ?? 'Aucun addon selectionne'

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
      <section className="status-band">
        <div>
          <p className="eyebrow">Simple Addon Injector GROS CACA</p>
          <h1>{statusLabel}</h1>
          <p className="subtitle">
            Le watcher est pose automatiquement. Quand NationsGlory le retire, l addon choisi est
            injecte tout seul.
          </p>
        </div>
        <div className={`status-pill status-${snapshot?.status ?? 'syncing'}`}>
          <span></span>
          {snapshot?.gameRunning ? 'NationsGlory detecte' : 'En attente'}
        </div>
      </section>

      <section className="control-grid">
        <div className="panel addon-panel">
          <div className="panel-title">
            <div>
              <h2>Addons disponibles</h2>
              <p>Catalogue charge depuis github.com/Paxdu353/SimpleAddon.</p>
            </div>
            <strong>{snapshot?.addons.length ?? 0}</strong>
          </div>

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
                    <small>{pending ? 'Selection...' : formatBytes(addon.size)}</small>
                  </span>
                </label>
              )
            })}
            {snapshot?.repositoryReady === false && (
              <div className="empty-state">Connexion a GitHub en cours...</div>
            )}
          </div>
        </div>

        <div className="panel flow-panel">
          <div className="panel-title">
            <div>
              <h2>Fonctionnement</h2>
              <p>Selection actuelle: {selectedAddonName}</p>
            </div>
          </div>

          <ol className="flow-list">
            <li className={snapshot?.repositoryReady ? 'done' : ''}>
              Recuperation du watcher et des addons
            </li>
            <li className={snapshot?.selectedAddonId ? 'done' : ''}>Choix du mod a injecter</li>
            <li className={snapshot?.watcherReady ? 'done' : ''}>
              Watcher installe avant le lancement
            </li>
            <li className={snapshot?.lastInjectionAt ? 'done' : ''}>
              Injection automatique apres suppression
            </li>
          </ol>

          <label className="toggle-row">
            <input
              checked={snapshot?.autoStartEnabled ?? false}
              disabled={pendingAutoStart}
              type="checkbox"
              onChange={(event) => toggleAutoStart(event.currentTarget.checked)}
            />
            <span>
              <strong>Lancer avec Windows</strong>
              <small>L app restera prete en arriere-plan pour attendre NationsGlory.</small>
            </span>
          </label>
        </div>
      </section>

      <section className="log-panel">
        <div className="log-header">
          <h2>Journal</h2>
          <span>{snapshot?.logs.length ?? 0}</span>
        </div>
        <div className="log-list">
          {(snapshot?.logs ?? []).map((log) => (
            <div className="log-row" key={`${log.at}-${log.level}-${log.message}`}>
              <time>{new Date(log.at).toLocaleTimeString('fr-FR')}</time>
              <strong className={`log-${log.level.toLowerCase()}`}>{log.level}</strong>
              <p>{log.message}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'taille inconnue'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} mo`
}

export default App
