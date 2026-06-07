# Where Is My Model

Dashboard para gestionar la infraestructura GPU de servidores que ejecutan modelos de IA, con visibilidad del uso de VRAM por GPU y una calculadora para estimar si un modelo cabe en hardware concreto.

## Funcionalidades

**Dashboard — CRUD de servidores y servicios**

| Acción | Descripción |
|--------|-------------|
| Gestionar PCs | Añadir, editar y borrar servidores con su nombre e IP |
| Configuración multi-GPU | Cada servidor define un array de GPUs con nombre y VRAM |
| Servicios por PC | Asignar servicios a GPUs específicas verificando que la suma de uso no exceda la capacidad de cada GPU |
| Barras de uso visual | Indicadores por GPU con colores según umbrales (verde ≤35%, amarillo 36-70%, rojo >70%, pulso >80%) |
| Exportar datos | Descarga JSON con el estado completo de la infraestructura |

**Calculadora VRAM**

Estima cuánto consume un modelo en memoria GPU antes de desplegarlo. Soporta múltiples arquitecturas de atención: MHA, GQA, MQA, MLA, MLA+RoPE, SWA y SWA+Global. Considera tamaño del modelo, KV cache por secuencia, precaching con hit ratio, overhead de activaciones y techo de utilización de la GPU.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 8 + Tailwind CSS 3.4 |
| Backend | Express 4 + Mongoose 8 (ESM) |
| Base de datos | MongoDB 7 |
| Orquestación | Docker Compose |

## Estructura del repositorio

```
├── frontend/                 # React — Vite dev server (puerto 3000)
│   ├── src/
│   │   ├── App.jsx          # Router de páginas y modales
│   │   ├── components/      # UI: Header, PCGrid, PCCard, Modals...
│   │   │   └── GpuCalculator/  # Calculadora VRAM
│   │   ├── hooks/           # usePcs, useServices, etc.
│   │   ├── services/        # apiClient (fetch wrapper) + API clients
│   │   └── utils/           # calculatorEngine, gpuHelpers, validators
│   └── vite.config.js       # Proxy /api → backend
├── backend/                 # Express — API REST (puerto 8080)
│   ├── server.js            # Entrypoint: conexión DB + registro de rutas
│   ├── models/PC.js         # Schema multi-GPU con validadores
│   ├── routes/              # pcs.js + services.js
│   ├── middleware/          # Validación de bodies
│   └── seed.js              # Carga datos de ejemplo desde data.json
├── docker-compose.yml       # 3 servicios: frontend, backend, mongo
└── docs/                    # Documentación detallada del proyecto
```

## Levantar el servicio

Prerrequisitos: Docker y Docker Compose instalados.

```bash
docker compose up --build
```

Se levantan tres contenedores en la red `app-network`:

| Servicio   | Puerto local | Descripción                          |
|-----------:|:------------:|--------------------------------------|
| frontend    | **3000**     | Vite dev server con HMR              |
| backend     | 9003         | API Express (expone 8080 → 9003)     |
| mongo       | —            | MongoDB interno (no accesible fuera) |

## Acceder al frontend

> **http://localhost:3000**

El proxy de Vite reenvía las peticiones `/api/*` al backend automáticamente. No hace falta configurar nada adicional.

