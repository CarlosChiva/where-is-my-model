function Header({ pcs, onAddPc, onSave, currentPage = 'dashboard', onPageChange }) {
  const serverCount = pcs.length;
  const serviceCount = pcs.reduce(
    (total, pc) => total + (Array.isArray(pc.servicios) ? pc.servicios.length : 0),
    0,
  );

  const handleExport = () => {
    const json = JSON.stringify(pcs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gpu-infra-${timestamp}.json`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    if (typeof onSave === 'function') {
      onSave();
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'calculator', label: 'Calculadora GPU' },
  ];

  return (
    <header className="flex flex-col md:flex-row items-start justify-between gap-4">
      <div className="flex flex-col w-full md:w-auto gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
          Where Is My Model
        </h1>
        <span
          aria-live="polite"
          className="text-sm text-text-secondary"
        >
          {serverCount} servers, {serviceCount} services
        </span>

        <nav
          aria-label="Page navigation"
          className="flex items-center gap-1 pt-1 md:pt-0"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={currentPage === tab.id}
              onClick={() => onPageChange && onPageChange(tab.id)}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none
                focus:ring-[0_0_0_2px] focus:ring-accent-dim
                ${
                  currentPage === tab.id
                    ? 'bg-accent text-bg-primary'
                    : 'bg-bg-input text-text-secondary hover:text-text-primary'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {currentPage === 'dashboard' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAddPc}
            className="bg-accent text-bg-primary font-semibold px-4 py-2 rounded-md shadow-btn-primary hover:bg-accent-hover transition-colors flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
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
            Add PC
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="border border-border text-text-secondary px-3 py-2 rounded-md hover:text-text-primary transition-colors flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export JSON
          </button>
        </div>
      )}
    </header>
  );
}

export default Header;
