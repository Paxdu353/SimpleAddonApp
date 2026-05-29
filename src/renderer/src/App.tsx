import { useEffect, useMemo, useState } from 'react'

type InjectorSnapshot = Awaited<ReturnType<typeof window.api.getInjectorSnapshot>>
type UpdateSnapshot = Awaited<ReturnType<typeof window.api.getUpdateSnapshot>>

function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<InjectorSnapshot | null>(null)
  const [updateSnapshot, setUpdateSnapshot] = useState<UpdateSnapshot | null>(null)
  const [pendingAddonId, setPendingAddonId] = useState<string | null>(null)
  const [pendingAutoStart, setPendingAutoStart] = useState(false)
  const [refreshingAddons, setRefreshingAddons] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)

  useEffect(() => {
    let mounted = true

    window.api.getInjectorSnapshot().then((nextSnapshot) => {
      if (mounted) setSnapshot(nextSnapshot)
    })

    const unsubscribe = window.api.onInjectorUpdate((nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })

    window.api.getUpdateSnapshot().then((nextSnapshot) => {
      if (mounted) setUpdateSnapshot(nextSnapshot)
    })

    const unsubscribeUpdater = window.api.onUpdaterUpdate((nextSnapshot) => {
      setUpdateSnapshot(nextSnapshot)
    })

    return () => {
      mounted = false
      unsubscribe()
      unsubscribeUpdater()
    }
  }, [])

  const selectedAddonLabel = getSelectedAddonLabel(snapshot)
  const recentLogs = useMemo(() => [...(snapshot?.logs ?? [])].reverse(), [snapshot?.logs])

  const toggleAddon = async (addonId: string, selected: boolean): Promise<void> => {
    const addon = snapshot?.addons.find((candidate) => candidate.id === addonId)
    if (addon?.required) return

    setPendingAddonId(addonId)
    try {
      const currentSelection = snapshot?.selectedAddonIds ?? []
      const nextSelection = selected
        ? [...currentSelection, addonId]
        : currentSelection.filter((selectedAddonId) => selectedAddonId !== addonId)

      setSnapshot(await window.api.setSelectedAddons(nextSelection))
    } finally {
      setPendingAddonId(null)
    }
  }

  const refreshAddons = async (): Promise<void> => {
    setRefreshingAddons(true)
    try {
      setSnapshot(await window.api.refreshAddons())
    } finally {
      setRefreshingAddons(false)
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

  const installUpdate = async (): Promise<void> => {
    setInstallingUpdate(true)
    await window.api.installDownloadedUpdate()
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>SimpleAddon</h1>
        <div className={`status-pill status-${snapshot?.status ?? 'syncing'}`}>
          <span></span>
          {snapshot?.gameRunning ? 'NationsGlory actif' : 'En veille'}
        </div>
      </section>

      {updateSnapshot?.status === 'downloaded' && (
        <section className="update-banner">
          <div>
            <strong>Mise à jour prête</strong>
            <p>
              La version {updateSnapshot.version ?? 'téléchargée'} est téléchargée. Redémarre
              l&apos;application pour l&apos;installer maintenant.
            </p>
          </div>
          <button disabled={installingUpdate} type="button" onClick={installUpdate}>
            {installingUpdate ? 'Redémarrage...' : 'Redémarrer et installer'}
          </button>
        </section>
      )}

      <section className="workspace">
        <div className="left-column">
          <section className="panel selection-panel">
            <header className="panel-header">
              <div>
                <h2>Addons à injecter</h2>
                <p>{selectedAddonLabel}</p>
              </div>
              <button
                className="refresh-button"
                disabled={refreshingAddons}
                type="button"
                onClick={refreshAddons}
              >
                {refreshingAddons ? 'Rafraîchissement...' : 'Rafraîchir'}
              </button>
            </header>

            <div className="addon-list">
              {(snapshot?.addons ?? []).map((addon) => {
                const selected = snapshot?.selectedAddonIds.includes(addon.id) ?? false
                const pending = pendingAddonId === addon.id

                return (
                  <label
                    className={`addon-option ${selected ? 'selected' : ''} ${addon.required ? 'locked' : ''}`}
                    key={addon.id}
                  >
                    <input
                      checked={selected}
                      disabled={pendingAddonId !== null || addon.required}
                      name="addon"
                      type="checkbox"
                      onChange={(event) => toggleAddon(addon.id, event.currentTarget.checked)}
                    />
                    <span>
                      <div className="addon-title-row">
                        <strong>{addon.displayName}</strong>
                        {addon.version && <em>v{addon.version}</em>}
                      </div>
                      <small>{pending ? 'Sélection en cours...' : formatBytes(addon.size)}</small>
                    </span>
                  </label>
                )
              })}
              {snapshot?.repositoryReady === false && (
                <div className="empty-state">Récupération du catalogue GitHub...</div>
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
                <small>Garde l&apos;injecteur prêt en arrière-plan.</small>
              </span>
            </label>
          </section>
        </div>

        <section className="panel log-panel">
          <header className="panel-header">
            <div>
              <h2>Activité</h2>
              <p>Les événements les plus récents sont affichés en premier.</p>
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

function getSelectedAddonLabel(snapshot: InjectorSnapshot | null): string {
  const selectedNames = snapshot?.selectedAddonNames ?? []

  if (selectedNames.length === 0) {
    return 'Aucun addon sélectionné'
  }

  return selectedNames.join(', ')
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'taille inconnue'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} mo`
}

export default App
