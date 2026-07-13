import { useState, useEffect } from 'react';

/* ── Auth Context ──────────────────────────────────────────── */
import { useAuth }      from './context/AuthContext.jsx';

/* ── Auth UI ──────────────────────────────────────────────── */
import LoginPage        from './components/LoginPage.jsx';

/* ── Custom Hooks ─────────────────────────────────────────── */
import usePcs           from './hooks/usePcs.js';
import useCreatePc      from './hooks/useCreatePc.js';
import useUpdatePc      from './hooks/useUpdatePc.js';
import useDeletePc      from './hooks/useDeletePc.js';
import useServices      from './hooks/useServices.js';
import useCreateService from './hooks/useCreateService.js';
import useUpdateService from './hooks/useUpdateService.js';
import useDeleteService from './hooks/useDeleteService.js';
import useServiceHealth from './hooks/useServiceHealth.js';

/* ── UI Components ─────────────────────────────────────────── */
import Header               from './components/Header.jsx';
import PCGrid               from './components/PCGrid.jsx';
import GPUCalculatorPage    from './components/GpuCalculator/GPUCalculatorPage.jsx';
import AdminPanel           from './components/AdminPanel.jsx';

import AddPcModal           from './components/Modals/AddPcModal.jsx';
import EditPcModal          from './components/Modals/EditPcModal.jsx';
import AddServiceModal      from './components/Modals/AddServiceModal.jsx';
import EditServiceModal     from './components/Modals/EditServiceModal.jsx';
import DeleteConfirmModal   from './components/Modals/DeleteConfirmModal.jsx';

export default function App() {
  /* ── Auth hooks — must fire before any data hooks ─────────── */
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAdmin = user?.role === 'admin';

  /* ── Query hook — master PC list with automatic initial fetch ── */
  const { data: pcs, loading, refetch } = usePcs();

  /* ── Mutation hooks — each wired to refetch on success ──────── */
  const createPcHook       = useCreatePc({ onSuccess: refetch });
  const updatePcHook       = useUpdatePc({ onSuccess: refetch });
  const deletePcHook       = useDeletePc({ onSuccess: refetch });
  const createServiceHook  = useCreateService({ onSuccess: refetch });
  const updateServiceHook  = useUpdateService({ onSuccess: refetch });
  const deleteServiceHook  = useDeleteService({ onSuccess: refetch });

  /* ── Health check hook — per-service TCP status manager ─── */
  const serviceHealth      = useServiceHealth();

  /* Post-auth refetch trigger — fires when authentication resolves */
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      refetch();
      serviceHealth.checkAll();
    }
  }, [isAuthenticated, isLoading, refetch, serviceHealth.checkAll]);

  /*
   * State: Modal router — single object pattern.
   *  type    → which modal dialog to render (null = none open)
   *  payload → data forwarded to the active modal component.
   */
  const [modalState, setModalState] = useState({ type: null, payload: null });

  /* State: Page router — 'dashboard' (default), 'admin', or 'calculator' */
  const [currentPage, setCurrentPage] = useState('dashboard');

  /* Guard: show spinner while auth state resolves */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
      </div>
    );
  }

  /* Guard: unauthenticated users see the login page */
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  /* ── Callback handlers ──────────────────────────────────────── */

  /* Close modal and reset modalState to idle */
  const closeModal = () => setModalState({ type: null, payload: null });

  /* PC — Persist new server via mutation hook, close modal; refetch fires on success */
  const handleAddPc = async (pcData) => {
    const result = await createPcHook.mutate(pcData);
    if (!result?.error) {
      closeModal();
    }
  };

  /* PC — Persist edited server via mutation hook, close modal; refetch fires on success */
  const handleEditPc = isAdmin
    ? async (pc) => {
        const result = await updatePcHook.mutate({ id: pc._id || pc.id, data: pc });
        if (!result?.error) {
          closeModal();
        }
      }
    : () => {};

  /* PC — Open Add PC modal (FAB button handler) */
  const handleOpenAddPc = isAdmin
    ? () => setModalState({ type: 'addPc', payload: null })
    : () => {};

  /* PC — Open DeleteConfirmModal with payload including nombre */
  const handleDeletePc = isAdmin
    ? ({ pcId, nombre }) => {
        setModalState({
          type: 'deleteConfirm',
          payload: { pcId, nombre, actionType: 'pc' },
        });
      }
    : () => {};

  /* Service — Open AddServiceModal with PC context */
  const handleAddService = isAdmin
    ? ({ pcId, gpus, servicios }) => {
        setModalState({
          type: 'addService',
          payload: { pcId, gpus, servicios },
        });
      }
    : () => {};

  /* Service — Persist new service via mutation hook, close modal; refetch fires on success */
  const handleSaveService = async (serviceData) => {
    const { pcId, ...data } = serviceData;
    const result = await createServiceHook.mutate({ pcId, data });
    if (!result?.error) {
      closeModal();
    }
  };

  /* Service — Open EditServiceModal with existing service data */
  const handleEditService = isAdmin
    ? ({ pcId, index, service, gpus, services }) => {
        setModalState({
          type: 'editService',
          payload: { pcId, index, service, gpus, services },
        });
      }
    : () => {};

  /*
    * Service — Submit handler called by EditServiceModal.onSave.
    * Editservice modal passes { pcId, index, nombre, puerto, gpu }.
    * We extract pcId + index and bundle the rest as data for the hook.
    */
  const handleEditServiceSubmit = isAdmin
    ? async (serviceData) => {
        const { pcId, index, ...data } = serviceData;
        const result = await updateServiceHook.mutate({ pcId, index, data });
        if (!result?.error) {
          closeModal();
        }
      }
    : () => {};

  /* Service — Open DeleteConfirmModal with actionType: 'service' */
  const handleDeleteService = isAdmin
    ? ({ pcId, index }) => {
        setModalState({
          type: 'deleteConfirm',
          payload: { pcId, index, actionType: 'service' },
        });
      }
    : () => {};

  /*
   * Confirmation handler for delete modals.
   * Dispatches based on modalState.payload.actionType:
   *   'pc'     → calls deletePcHook.mutate
   *   'service'→ calls deleteServiceHook.mutate
   * Refetch fires automatically via each hook's onSuccess callback.
   */
  const handleConfirmDelete = isAdmin
    ? async () => {
        const { actionType, pcId, index } = modalState.payload || {};
        let result;
        if (actionType === 'pc') {
          result = await deletePcHook.mutate(pcId);
        } else if (actionType === 'service') {
          result = await deleteServiceHook.mutate({ pcId, index });
        }
        if (!result?.error) {
          closeModal();
        }
      }
    : () => {};

  /* Build confirmation message from modal payload */
  const deleteMessage = modalState.payload
    ? (modalState.payload.actionType === 'pc'
        ? `Delete server '${modalState.payload.nombre}'? This cannot be undone.`
        : 'Delete this service? This cannot be undone.')
    : '';

  /*
   * Page navigation handler — switches page and closes any open modal.
   * Modals are scoped to dashboard; switching away should dismiss them.
   */
  const handlePageChange = (page) => {
    setCurrentPage(page);
    setModalState({ type: null, payload: null });
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-sans p-4 md:p-8">
      {/* Header: server count summary + add/save action buttons */}
      <Header
        currentPage={currentPage}
        onPageChange={handlePageChange}
        pcs={pcs}
        isAdmin={isAdmin}
      />

       {/* Page router: dashboard (grid + modals), admin user management, or calculator */}
       {currentPage === 'dashboard' ? (
         <>
           {/* Responsive grid of PC cards with editing actions */}
          <PCGrid
            pcs={pcs}
            loading={loading}
            serviceHealth={serviceHealth}
            isAdmin={isAdmin}
            onEditPc={(pc) => setModalState({ type: 'editPc', payload: pc })}
            onAddService={handleAddService}
            onDeletePc={handleDeletePc}
            onEditService={handleEditService}
            onDeleteService={handleDeleteService}
          />

          {/*
           * ── Modal Routing — Phase 5 Integration ────────────────
           * Conditional rendering based on modalState.type.
           * Each case passes payload as data props and callbacks for save/close.
           */}
          {modalState.type === 'addPc' && (
            <AddPcModal
              onSave={handleAddPc}
              onClose={closeModal}
              loading={createPcHook.loading}
              error={createPcHook.error}
              clearError={createPcHook.clearError}
            />
          )}
          {modalState.type === 'editPc' && (
            <EditPcModal
              pc={modalState.payload}
              onSave={handleEditPc}
              onClose={closeModal}
              loading={updatePcHook.loading}
              error={updatePcHook.error}
              clearError={updatePcHook.clearError}
            />
          )}
          {modalState.type === 'addService' && (
            <AddServiceModal
              pcId={modalState.payload.pcId}
              pcGpus={modalState.payload.gpus ?? []}
              pcServices={modalState.payload.servicios ?? []}
              onSave={handleSaveService}
              onClose={closeModal}
              loading={createServiceHook.loading}
              error={createServiceHook.error}
              clearError={createServiceHook.clearError}
            />
          )}
          {modalState.type === 'editService' && (
            <EditServiceModal
              pcId={modalState.payload.pcId}
              serviceIndex={modalState.payload.index}
              service={modalState.payload.service}
              pcGpus={modalState.payload.gpus ?? []}
              pcServices={modalState.payload.services ?? []}
              onSave={handleEditServiceSubmit}
              onCancel={closeModal}
              loading={updateServiceHook.loading}
              error={updateServiceHook.error}
              clearError={updateServiceHook.clearError}
            />
          )}
          {modalState.type === 'deleteConfirm' && (
            <DeleteConfirmModal
              isOpen={true}
              message={deleteMessage}
              onConfirm={handleConfirmDelete}
              onCancel={closeModal}
              loading={modalState.payload?.actionType === 'pc' ? deletePcHook.loading : deleteServiceHook.loading}
              error={modalState.payload?.actionType === 'pc' ? deletePcHook.error : deleteServiceHook.error}
            />
          )}
        </>
       ) : currentPage === 'admin' ? (
         <AdminPanel />
       ) : (
         <GPUCalculatorPage />
       )}

      {/* Floating "Refresh Health" button — dashboard only */}
      {currentPage === 'dashboard' && (
        <button
          type="button"
          onClick={() => serviceHealth.checkAll()}
          aria-label="Refresh service health"
          className="fixed bottom-[6.5rem] right-6 z-40 w-12 h-12 md:w-14 md:h-14 rounded-full bg-accent text-bg-primary shadow-fab hover:bg-accent-hover active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-[0_0_0_3px] focus:ring-accent-dim"
        >
          <span className={serviceHealth.loading ? 'animate-spin' : ''}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </span>
        </button>
      )}

      {/* Floating "Add PC" button — dashboard only, admin only */}
      {currentPage === 'dashboard' && isAdmin && (
        <button
          type="button"
          onClick={handleOpenAddPc}
          aria-label="Add PC"
          className="fixed bottom-6 right-6 z-40 w-12 h-12 md:w-14 md:h-14 rounded-full bg-accent text-bg-primary shadow-fab hover:bg-accent-hover active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-[0_0_0_3px] focus:ring-accent-dim"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
