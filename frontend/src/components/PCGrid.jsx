import PCCard from './PCCard';

function PCGrid({ pcs, loading, onEditPc, onAddService, onDeletePc, onEditService, onDeleteService, serviceHealth }) {
  return (
    <section className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {loading && (
        <div className="col-span-full flex items-center justify-center py-24">
          <span className="text-lg text-text-secondary animate-pulse">
            Loading servers...
          </span>
        </div>
      )}
      {!loading && pcs.length === 0 && (
        <div className="col-span-full text-center py-12 text-text-secondary">
          <p className="text-lg">No servers configured yet.</p>
          <p className="text-sm mt-2 text-text-muted">Use the + button to add your first server.</p>
        </div>
      )}
      {!loading && pcs.length > 0 && (
        <>
          {pcs.map((pc, index) => (
            <PCCard
              key={pc._id}
              pc={pc}
              index={index}
              onEditPc={onEditPc}
              onAddService={onAddService}
              onDeletePc={onDeletePc}
              onEditService={onEditService}
              onDeleteService={onDeleteService}
              healthStatuses={serviceHealth?.statuses}
              healthLoading={serviceHealth?.loading}
              onCheckPc={() => serviceHealth?.checkSinglePc(pc._id)}
            />
          ))}
        </>
      )}
    </section>
  );
}

export default PCGrid;
