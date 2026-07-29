import { useEffect, useState } from 'react'

type InjectorSnapshot = Awaited<ReturnType<typeof window.api.getInjectorSnapshot>>
type UpdateSnapshot = Awaited<ReturnType<typeof window.api.getUpdateSnapshot>>

function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<InjectorSnapshot | null>(null)
  const [updateSnapshot, setUpdateSnapshot] = useState<UpdateSnapshot | null>(null)
  const [pendingAddonId, setPendingAddonId] = useState<string | null>(null)
  const [pendingAutoStart, setPendingAutoStart] = useState(false)
  const [refreshingAddons, setRefreshingAddons] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)

  useEffect(() => {
    let mounted = true

    window.api.getInjectorSnapshot().then((nextSnapshot) => {
      if (mounted) setSnapshot(nextSnapshot)
    })

    window.api.getUpdateSnapshot().then((nextSnapshot) => {
      if (mounted) setUpdateSnapshot(nextSnapshot)
    })

    const unsubscribeInjector = window.api.onInjectorUpdate(setSnapshot)
    const unsubscribeUpdater = window.api.onUpdaterUpdate(setUpdateSnapshot)

    return () => {
      mounted = false
      unsubscribeInjector()
      unsubscribeUpdater()
    }
  }, [])

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

  const toggleAutoStart = async (enabled: boolean): Promise<void> => {
    setPendingAutoStart(true)
    try {
      setSnapshot(await window.api.setAutoStartEnabled(enabled))
    } finally {
      setPendingAutoStart(false)
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

  const checkUpdates = async (): Promise<void> => {
    setCheckingUpdates(true)
    try {
      const nextSnapshot = await window.api.checkForAppUpdates()
      setUpdateSnapshot(nextSnapshot)

      if (nextSnapshot.status === 'downloaded') {
        await window.api.installDownloadedUpdate()
      }
    } finally {
      setCheckingUpdates(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SimpleAddon</p>
          <h1>Mods NationsGlory</h1>
        </div>
        <div className="header-actions">
          <button disabled={refreshingAddons} type="button" onClick={refreshAddons}>
            {refreshingAddons ? 'Rafraichissement...' : 'Rafraichir les mods'}
          </button>
          <button
            disabled={checkingUpdates || updateSnapshot?.status === 'checking'}
            type="button"
            onClick={checkUpdates}
          >
            {getUpdateButtonLabel(updateSnapshot, checkingUpdates)}
          </button>
        </div>
      </header>

      <section className="panel addon-panel">
        <div className="panel-header">
          <div>
            <h2>Mods disponibles</h2>
            <p>{getSelectedAddonLabel(snapshot)}</p>
          </div>
        </div>

        <div className="addon-list">
          {(snapshot?.addons ?? []).map((addon) => {
            const selected = snapshot?.selectedAddonIds.includes(addon.id) ?? false
            const pending = pendingAddonId === addon.id

            return (
              <label
                className={`addon-row ${selected ? 'selected' : ''} ${addon.required ? 'locked' : ''}`}
                key={addon.id}
              >
                <input
                  checked={selected}
                  disabled={pendingAddonId !== null || addon.required}
                  type="checkbox"
                  onChange={(event) => toggleAddon(addon.id, event.currentTarget.checked)}
                />
                <span className="addon-main">
                  <span className="addon-title">
                    <strong>{addon.displayName}</strong>
                    {addon.version && <em>{formatVersion(addon.version)}</em>}
                    {addon.required && <em className="required-badge">requis</em>}
                  </span>
                  <small>{pending ? 'Mise a jour...' : addon.fileName}</small>
                </span>
                <span className="addon-size">{formatBytes(addon.size)}</span>
              </label>
            )
          })}

          {snapshot && snapshot.addons.length === 0 && (
            <div className="empty-state">Chargement des mods disponibles.</div>
          )}
        </div>
      </section>

      <section className="panel settings-panel">
        <label className="toggle-row">
          <input
            checked={snapshot?.autoStartEnabled ?? false}
            disabled={pendingAutoStart}
            type="checkbox"
            onChange={(event) => toggleAutoStart(event.currentTarget.checked)}
          />
          <span>
            <strong>Lancer au demarrage</strong>
            <small>SimpleAddon reste disponible en arriere-plan.</small>
          </span>
        </label>
      </section>
    </main>
  )
}

function getSelectedAddonLabel(snapshot: InjectorSnapshot | null): string {
  const selectedNames = snapshot?.selectedAddonNames ?? []

  if (selectedNames.length === 0) {
    return 'Aucun mod optionnel selectionne.'
  }

  return selectedNames.join(', ')
}

function formatVersion(version: string): string {
  return version.toLowerCase().includes('beta')
    ? version.replace(/\s*beta/i, ' beta')
    : `v${version}`
}

function getUpdateButtonLabel(snapshot: UpdateSnapshot | null, checkingUpdates: boolean): string {
  if (checkingUpdates || snapshot?.status === 'checking') return 'Verification...'
  if (snapshot?.status === 'downloaded') return 'Installer la mise a jour'
  if (snapshot?.status === 'available') return 'Telechargement...'
  return 'Verifier les mises a jour'
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'inconnue'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} mo`
}

export default App
