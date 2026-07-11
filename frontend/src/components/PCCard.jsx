/**
 * PCCard — Individual GPU server card for the dashboard grid.
 *
 * Displays server name, IP, running services (via ServiceRow),
 * aggregate GPU usage (via GPUDetails), and edit/add/delete actions.
 *
 * Props:
 *   pc          — Server object  { _id, nombre, ip, gpus[], servicios[] }
 *                 GPU usage is computed via computeGpuUsage(gpus, servicios).
 *   index       — Array index for stagger animation delay
 *   onEditPc    — (pc) => void        Called when Edit PC is clicked
 *   onAddService— ({ pcId, gpus, servicios }) => void  Called when Add Service is clicked
 *   onDeletePp  — ({ pcId, nombre }) => void  Called when Delete PC is clicked
 *   healthStatuses — Object keyed by "pcId---serviceIndex" with values 'up'|'down'|null
 *   healthLoading  — Boolean indicating whether a health check is in flight
 *   onCheckPc    — () => Promise<void>  Called when per-PC health check is requested
 */
import ServiceRow from './ServiceRow';
import GPUDetails from './GPUDetails';
import { computeGpuUsage } from '../utils/gpuHelpers.js';

export default function PCCard({
  pc, index, isAdmin, onEditPc, onAddService, onDeletePc, onEditService, onDeleteService,
  healthStatuses = {}, healthLoading = false, onCheckPc
}) {
  const services = pc?.servicios ?? [];
  const gpus     = pc?.gpus ?? [];
  const gpuUsage = computeGpuUsage(gpus, services);

  return (
    <div
      className="bg-bg-card rounded-lg shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 border border-border animate-card-enter"
      style={{ animationDelay: `${index * 100}ms` }}
      data-pc-id={pc?._id}
    >
      {/* ── Header: server name + IP badge ── */}
      <div className="flex justify-between items-center p-4 pb-2 border-b border-border">
        <h2 className="text-lg font-bold text-text-primary">{pc?.nombre ?? ''}</h2>
        <span className="inline-block bg-bg-input px-2 py-1 rounded text-sm font-mono text-text-secondary">
          {pc?.ip ?? ''}
        </span>
      </div>

      {/* ── Service count ── */}
      <div className="px-4 pt-3">
        <p className="text-sm text-text-secondary">
          {services.length} service{services.length !== 1 ? 's' : ''} running
        </p>
      </div>

      {/* ── Services list ── */}
      <div className="px-4 py-2">
        {services.map((service, i) => {
          const assignedIdx    = service.assignedGpu ?? 0;
          const serviceGpuData = gpuUsage.find(g => g.gpuIndex === assignedIdx);
          const resolvedVramGb = serviceGpuData?.totalVram ?? 0;
          const resolvedGpuName = serviceGpuData?.name ?? null;

          const healthKey = `${pc?._id}---${i}`;
          const serviceStatus = healthStatuses[healthKey] ?? null;

          return (
            <ServiceRow
              key={i}
              service={service}
              vramGb={resolvedVramGb}
              gpuName={resolvedGpuName}
              pcId={pc?._id}
              index={i}
              isAdmin={isAdmin}
              onEdit={isAdmin ? (editPayload) => onEditService({ ...editPayload, service, gpus, services }) : () => {}}
              onDelete={onDeleteService}
              status={serviceStatus}
            />
          );
        })}
      </div>

      {/* ── Per-GPU bars ── */}
      <div className="px-4 pb-2">
        <GPUDetails gpuUsage={gpuUsage} />
      </div>

      {/* ── Action buttons ── */}
      <div className="flex gap-2 p-4 pt-2 border-t border-border">
        {isAdmin && (
          <button
            type="button"
            className="bg-accent text-bg-primary font-semibold px-3 py-2 rounded-md shadow-btn-primary hover:bg-accent-hover transition-colors flex-1"
            aria-label={`Edit server ${pc?.nombre ?? ''}`}
            onClick={() => onEditPc(pc)}
          >
            ✏ Edit PC
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            className="border border-accent text-accent px-3 py-2 rounded-md hover:bg-accent-dim transition-colors flex-1"
            aria-label={`Add service to ${pc?.nombre ?? ''}`}
            onClick={() => onAddService({ pcId: pc?._id, gpus: pc?.gpus ?? [], servicios: pc?.servicios ?? [] })}
          >
            ＋ Add Service
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            className="border border-danger text-danger px-3 py-2 rounded-md hover:bg-danger/10 transition-colors flex-1"
            aria-label={`Delete server ${pc?.nombre ?? ''}`}
            onClick={() => onDeletePc({ pcId: pc?._id, nombre: pc?.nombre })}
          >
            ✕ Delete PC
          </button>
        )}
        <button
          type="button"
          className="border border-text-secondary text-text-secondary p-2 rounded-md hover:bg-bg-input transition-colors disabled:opacity-50"
          aria-label={`Check services on ${pc?.nombre ?? ''}`}
          title="Check Services"
          disabled={healthLoading}
          onClick={() => onCheckPc?.()}
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
            className={healthLoading ? 'animate-spin' : ''}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
