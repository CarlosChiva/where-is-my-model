# Project Structure — where-is-my-model

## Architecture

```
where-is-my-model/
├── backend/                          # Express + Mongoose API ✅ COMPLETE
│   ├── .dockerignore
│   ├── .env.development              # NODE_ENV, PORT=8080, MONGODB_URI, CLIENT_URL
│   ├── Dockerfile                    # Node 20 Alpine, single-stage
│   ├── middleware/
│   │   ├── auth.js                 # [AUTH] authMiddleware (JWT validation), requireAdmin (role check)
│   │   └── validation.js           # validatePcBody, validateServiceBody, validateServiceUpdate
│   ├── models/
│   │   ├── PC.js                  # Schema: {nombre, ip, vram, servicios[]}, virtual totalGpu, GPU cap validator
│   │   └── User.js                # [AUTH] Schema: {username (unique), password (bcrypt), role ('admin'|'user')}
│   ├── routes/
    │   │   ├── auth.js            # [AUTH] POST /register, POST /login, GET /me, GET /users, PUT /users/:userId/role
    │   │   ├── pcs.js             # GET /, GET /:id, POST /, PUT /:id, DELETE /:id (+ auth middleware)
    │   │   ├── services.js        # GET /, POST /, PUT /:index, DELETE /:index (+ auth middleware)
    │   │   └── health.js          # POST /check-health/pcs/:pcId, POST /check-health/all
    │   ├── services/
    │   │   └── healthChecker.js   # TCP connect checker (net module, ESM)
    │   ├── seed.js                # Manual seed from data.json
│   ├── server.js                 # Entry: MongoDB connect, auto-seed, route registration (+ auth routes), listen(8080)
│   ├── package.json
│   └── package-lock.json
│
├── frontend/                         # React + Vite + Tailwind ✅ COMPLETE
│   ├── .dockerignore
│   ├── .env                          # VITE_API_PROXY_TARGET=http://backend:8080
│   ├── .env.development              # VITE_API_PROXY_TARGET=http://localhost:9003
│   ├── Dockerfile                    # 3 stages: dev (Vite), build, production (nginx)
│   ├── eslint.config.js
│   ├── index.html                    # Vite entry + Google Fonts
│   ├── nginx.conf                    # Production: SPA fallback, /api proxy to backend
│   ├── postcss.config.js
│   ├── tailwind.config.js            # Full theme: colors, fonts, animations, keyframes, screens
│   ├── vite.config.js                # React plugin, port 3000, /api proxy
│   ├── package.json                  # react 19, vite 8, tailwind 3.4
│   ├── package-lock.json
│   ├── public/icons.svg
│   └── src/
│       ├── main.jsx                  # ReactDOM.createRoot('#app', <App />)
│       ├── App.jsx                   # Modal router, 8 hooks, 6 callback handlers
│       ├── index.css                 # @tailwind directives
│       ├── components/
│       │   ├── Header.jsx            # Title, server/service counts, Add PC + Save buttons
│       │   ├── PCGrid.jsx            # Responsive 3→2→1 grid, loading/empty states
│       │   ├── PCCard.jsx            # Name, IP, service count, ServiceRow[], GPUDetails, actions
│       │   ├── ServiceRow.jsx        # Name, port badge, GPUBar, edit/delete buttons
│       │   ├── GPUBar.jsx            # Per-service bar (color + animation via --gpu-target-width)
│       │   ├── GPUDetails.jsx        # Aggregate bar with "TOTAL GPU" label + percentage text
│       │   └── Modals/
│       │       ├── AddPcModal.jsx    # Form: nombre, ip, vram + live validation
│       │       ├── EditPcModal.jsx   # Pre-filled form, dispatches with _id
│       │       ├── AddServiceModal.jsx # Form: nombre, puerto, gpu + VRAM cap check
│       │       ├── EditServiceModal.jsx # Pre-filled, recalc cap (frees old allocation)
│       │       └── DeleteConfirmModal.jsx # Warning message, auto-close on confirm
│       │   └── GpuCalculator/              # [NEW] Feature folder for GPU Calculator page
│       │       ├── GPUCalculatorPage.jsx              # Page container, form state, results orchestration
│       │       ├── ModelFormSection.jsx               # 📐 Architecture fields group (5 number inputs)
│       │       ├── PrecisionFormSection.jsx           # 🔢 Quantization fields group (2 selects)
│       │       ├── HardwareFormSection.jsx            # 🖥️ Hardware fields group (2 number inputs)
│       │       ├── WorkloadFormSection.jsx            # 🎯 Workload target fields group (5 number inputs)
│       │       └── ResultsDisplay.jsx                 # Visual bars + numbers with gpu color thresholds
    │       ├── hooks/
    │       │   ├── usePcs.js             # GET all PCs on mount, refetch
    │       │   └── useServiceHealth.js   # [NEW] TCP health status state + auto-check on load
│       │   ├── useCreatePc.js        # POST new PC
│       │   ├── useUpdatePc.js        # PUT update PC
│       │   ├── useDeletePc.js        # DELETE PC
│       │   ├── useServices.js        # GET services by pcId
│       │   ├── useCreateService.js   # POST service to PC
│       │   ├── useUpdateService.js   # PUT service by index
│       │   └── useDeleteService.js   # DELETE service by index
    │       ├── services/
    │       │   ├── apiClient.js          # Unified fetch wrapper (get, post, put, del)
    │       │   └── healthApi.js          # [NEW] checkPcHealth, checkAllHealth wrappers
│       │   ├── pcApi.js              # fetchPcs, createPc, updatePc, deletePc
│       │   └── serviceApi.js         # fetchServices, createService, updateService, deleteService
│       └── utils/
│           ├── gpuHelpers.js         # getGpuColorClass, clamp (REUSED by calculator)
│           ├── slugify.js            # URL-safe slug (unused)
│           ├── validators.js         # validatePcForm, validateServiceForm
│           └── calculatorEngine.js   # [NEW] Pure calc functions: model size, KV cache, VRAM breakdown
│
├── docker-compose.yml                # 3 services: frontend (3000), backend (9003:8080), mongo (27017)
├── data.json                         # Sample seed data (3 PCs, 8 services)
├── docs/                             # Documentation
│   ├── REQUIREMENTS.md
│   ├── PROJECT_STRUCTURE.md
│   ├── FRAMEWORKS.md
│   ├── PROJECT_STATE.md
│   └── documentation/                # Generated docs
│
├── LEGACY (unused by React build):
│   ├── index.html                    # Vanilla entry point (loads css/ + js/)
│   ├── css/                          # styles.css, base.css, layout.css, components.css, animations.css
│   └── js/                           # app.js, data.js, editors.js, models.js, views.js
```

## Data Flow
```
React UI (port 3000) → Vite proxy /api → Backend (port 8080, host 9003) → MongoDB (port 27017 internal)
```

## Data Model
- **PC**: `{ _id: ObjectId, nombre: String, ip: String, vram: Number, servicios: [Service] }`
- **Service** (embedded): `{ nombre: String, puerto: Number, gpu: Number }` (no `_id`)
- **Virtual field**: `totalGpu` computed via Mongoose virtual = `sum(servicios[].gpu)`
- **Validator**: `sum(servicios[].gpu) <= pc.vram` at document level
