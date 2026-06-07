function Header({ pcs, currentPage = 'dashboard', onPageChange }) {
  const serverCount = pcs.length;
  const serviceCount = pcs.reduce(
    (total, pc) => total + (Array.isArray(pc.servicios) ? pc.servicios.length : 0),
    0,
  );

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'calculator', label: 'Calculadora GPU' },
  ];

  return (
    <header className="flex flex-col items-center gap-4">
      <div className="flex flex-col gap-2 text-center items-center">
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
          className="flex items-center justify-center gap-1 pt-1 md:pt-0"
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

    </header>
  );
}

export default Header;
