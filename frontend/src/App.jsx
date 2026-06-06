import { useState } from 'react';

/* ── Custom Hooks ─────────────────────────────────────────── */
import usePcs           from './hooks/usePcs.js';
import useCreatePc      from './hooks/useCreatePc.js';
import useUpdatePc      from './hooks/useUpdatePc.js';
import useDeletePc      from './hooks/useDeletePc.js';
import useServices      from './hooks/useServices.js';
import useCreateService from './hooks/useCreateService.js';
import useUpdateService from './hooks/useUpdateService.js';
import useDeleteService from './hooks/useDeleteService.js';

/* ── UI Components ─────────────────────────────────────────── */
import Header               from './components/Header.jsx';
import PCGrid               from './components/PCGrid.jsx';
import GPUCalculatorPage    from './components/GpuCalculator/GPUCalculatorPage.jsx';

import AddPcModal           from './components/Modals/AddPcModal.jsx';
import EditPcModal          from './components/Modals/EditPcModal.jsx';
import AddServiceModal      from './components/Modals/AddServiceModal.jsx';
import EditServiceModal     from './components/Modals/EditServiceModal.jsx';
import DeleteConfirmModal   from './components/Modals/DeleteConfirmModal.jsx';

export default function App() {
  /* ── Query hook — master PC list with automatic initial fetch ── */
  const { data: pcs, loading, refetch } = usePcs();

  /* ── Mutation hooks — each wired to refetch on success ──────── */
  const createPcHook       = useCreatePc({ onSuccess: refetch });
  const updatePcHook       = useUpdatePc({ onSuccess: refetch });
  const deletePcHook       = useDeletePc({ onSuccess: refetch });
  const createServiceHook  = useCreateService({ onSuccess: refetch });
  const updateServiceHook  = useUpdateService({ onSuccess: refetch });
  const deleteServiceHook  = useDeleteService({ onSuccess: refetch });

  /*
   * State: Modal router — single object pattern.
   *  type    → which modal dialog to render (null = none open)
   *  payload → data forwarded to the active modal component.
   */
  const [modalState, setModalState] = useState({ type: null, payload: null });

  /* State: Page router — 'dashboard' (default) or 'calculator' */
  const [currentPage, setCurrentPage] = useState('dashboard');

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
  const handleEditPc = async (pc) => {
    const result = await updatePcHook.mutate({ id: pc._id || pc.id, data: pc });
    if (!result?.error) {
      closeModal();
    }
  };

  /* PC — Open DeleteConfirmModal with payload including nombre */
  const handleDeletePc = ({ pcId, nombre }) => {
    setModalState({
      type: 'deleteConfirm',
      payload: { pcId, nombre, actionType: 'pc' },
    });
  };

  /* Service — Open AddServiceModal with PC context */
  const handleAddService = ({ pcId, gpus, servicios }) => {
    setModalState({
      type: 'addService',
      payload: { pcId, gpus, servicios },
    });
  };

  /* Service — Persist new service via mutation hook, close modal; refetch fires on success */
  const handleSaveService = async (serviceData) => {
    const { pcId, ...data } = serviceData;
    const result = await createServiceHook.mutate({ pcId, data });
    if (!result?.error) {
      closeModal();
    }
  };

  /* Service — Open EditServiceModal with existing service data */
  const handleEditService = ({ pcId, index, service, gpus, services }) => {
    setModalState({
      type: 'editService',
      payload: { pcId, index, service, gpus, services },
    });
  };

  /*
    * Service — Submit handler called by EditServiceModal.onSave.
    * Editservice modal passes { pcId, index, nombre, puerto, gpu }.
    * We extract pcId + index and bundle the rest as data for the hook.
    */
  const handleEditServiceSubmit = async (serviceData) => {
    const { pcId, index, ...data } = serviceData;
    const result = await updateServiceHook.mutate({ pcId, index, data });
    if (!result?.error) {
      closeModal();
    }
  };

  /* Service — Open DeleteConfirmModal with actionType: 'service' */
  const handleDeleteService = ({ pcId, index }) => {
    setModalState({
      type: 'deleteConfirm',
      payload: { pcId, index, actionType: 'service' },
    });
  };

  /*
   * Confirmation handler for delete modals.
   * Dispatches based on modalState.payload.actionType:
   *   'pc'     → calls deletePcHook.mutate
   *   'service'→ calls deleteServiceHook.mutate
   * Refetch fires automatically via each hook's onSuccess callback.
   */
  const handleConfirmDelete = async () => {
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
  };

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

  /* No-op onSave passed to Header — the component handles export internally. */
  const handleSave = () => {};

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-sans p-4 md:p-8">
      {/* Header: server count summary + add/save action buttons */}
      <Header
        currentPage={currentPage}
        onPageChange={handlePageChange}
        pcs={pcs}
        onAddPc={() => setModalState({ type: 'addPc', payload: null })}
        onSave={handleSave}
      />

      {/* Page router: dashboard (grid + modals) vs calculator */}
      {currentPage === 'dashboard' ? (
        <>
          {/* Responsive grid of PC cards with editing actions */}
          <PCGrid
            pcs={pcs}
            loading={loading}
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
      ) : (
        <GPUCalculatorPage />
      )}
    </div>
  );
}
