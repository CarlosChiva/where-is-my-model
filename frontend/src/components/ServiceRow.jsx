import GPUBar from './GPUBar';

function ServiceRow({ service, vramGb, index, pcId, isAdmin, onEdit, onDelete, gpuName, status }) {
  const { nombre, puerto, gpu } = service;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">
      {/* ── Left: name + port badge + GPU assignment badge ── */}
      <div className="flex-1 min-w-0 flex items-center gap-2 shrink">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
            status === 'up'     ? 'bg-gpu-green' :
            status === 'down'   ? 'bg-gpu-red'   :
                                 'bg-text-muted animate-pulse'
          }`}
        />
        <span className="truncate text-text-primary font-medium text-[0.875rem]">
          {nombre}
        </span>
        <span className="shrink-0 font-mono text-sm text-text-secondary bg-bg-input px-2 py-0.5 rounded">
          {puerto}
        </span>
        {gpuName && (
          <span className="shrink-0 text-xs text-text-muted bg-accent/10 text-accent px-2 py-0.5 rounded font-medium">
            gpu: {gpuName}
          </span>
        )}
      </div>

      {/* ── Center: GPU bar ── */}
      <div className="w-24 shrink-0">
        <GPUBar gpuGb={gpu} vramGb={vramGb} />
      </div>

      {/* ── Right: action buttons ── */}
      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="p-1.5 rounded text-text-secondary hover:text-accent transition-colors duration-200"
            aria-label={`Edit service ${nombre}`}
            onClick={() => onEdit({ pcId, index })}
          >
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
              <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>

          <button
            type="button"
            className="p-1.5 rounded text-text-secondary hover:text-danger transition-colors duration-200"
            aria-label={`Delete service ${nombre}`}
            onClick={() => onDelete({ pcId, index })}
          >
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default ServiceRow;
