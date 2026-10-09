import DnsRow from './DnsRow';

/**
 * DnsCard — DNS resolvers card for the dashboard.
 *
 * Displays DNS resolver entries (via DnsRow) and check-health / add actions.
 *
 * Props:
 *   card          — useDns().data → { _id, entries: [...] } | null
 *   loading       — Boolean, whether the DNS card data is still loading
 *   error         — String | null, error message from the DNS hook
 *   health        — Whole useDnsHealth() object. DnsCard calls:
 *                     health.anyLoading()   → is any check in flight?
 *                     health.statusOf(id)   → 'up' | 'down' | null
 *                     health.detailOf(id)   → { reason, latencyMs } | null
 *   isAdmin       — Boolean, whether the current user has admin rights
 *   onAdd         — () => void, called when "Add" is clicked
 *   onEdit        — (entry) => void, called when a row's edit button is clicked
 *   onDelete      — (entry) => void, called when a row's delete button is clicked
 *   onCheckHealth — () => void, called when "Check health" is clicked.
 *                   KEYING PITFALL: onCheckHealth is called with no arguments.
 *                   The caller (App, task 017) must map card.entries to
 *                   { entryId: entry._id } before calling
 *                   useDnsHealth().checkAll(...), because checkAll keys
 *                   internally on entry.entryId while entries carry _id.
 *                   DnsCard never maps.
 */
export default function DnsCard({
  card, loading, error, health, isAdmin,
  onAdd, onEdit, onDelete, onCheckHealth
}) {
  const entries = card?.entries ?? [];
  const checking = health?.anyLoading?.() ?? false;

  return (
    <div className="bg-bg-card rounded-lg shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 border border-border animate-card-enter">
      {/* ── Header: title + entry count ── */}
      <div className="flex justify-between items-center p-4 pb-2 border-b border-border">
        <h2 className="text-lg font-bold text-text-primary">Resolvers DNS</h2>
        <span className="inline-block bg-bg-input px-2 py-1 rounded text-sm font-mono text-text-secondary">
          {entries.length}
        </span>
      </div>

      {/* ── Body: loading / error / empty / rows ── */}
      <div className="px-4 py-2">
        {loading ? (
          <p className="text-sm text-text-secondary animate-pulse">Loading DNS resolvers...</p>
        ) : error ? (
          <p className="text-sm text-text-muted">{error}</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-6 text-text-secondary">
            <p className="text-lg">No DNS resolvers configured.</p>
            {isAdmin && (
              <p className="text-sm mt-2 text-text-muted">Use the + button to add your first resolver.</p>
            )}
          </div>
        ) : (
          entries.map((entry) => (
            <DnsRow
              key={entry._id}
              entry={entry}
              status={health?.statusOf?.(entry._id) ?? null}
              detail={health?.detailOf?.(entry._id)}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex gap-2 p-4 pt-2 border-t border-border">
        <button
          type="button"
          className="border border-text-secondary text-text-secondary p-2 rounded-md hover:bg-bg-input transition-colors disabled:opacity-50"
          aria-label="Check DNS health"
          title="Check Health"
          disabled={checking}
          onClick={() => onCheckHealth?.()}
        >
          <span className={checking ? 'animate-spin' : ''}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </span>
        </button>
        {isAdmin && (
          <button
            type="button"
            className="border border-accent text-accent px-3 py-2 rounded-md hover:bg-accent-dim transition-colors flex-1"
            aria-label="Add DNS resolver"
            onClick={() => onAdd?.()}
          >
            ＋ Add
          </button>
        )}
      </div>
    </div>
  );
}
