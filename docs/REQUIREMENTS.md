# Requirements — where-is-my-model

## Contexto del Proyecto
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 3.4, ubicado en `/home/dread/VsCode/where-is-my-model/frontend/src/`
- **Estilo actual:** La app tiene un dashboard de PCs con Header, PCGrid, PCCard, modales, hooks y servicios API. Usa Google Fonts (Spectral + JetBrains Mono). Tiene animaciones y colores personalizados en `tailwind.config.js`.
- **Backend y DB existen** pero esta nueva página NO se conecta a ninguno.

## Requerimiento del Usuario

### 1. Navegación: Switcher de páginas
- Añadir un switcher/navegador en la parte superior de la ventana para cambiar entre:
  - **"Dashboard"** → la página actual (PCGrid con los PCs y servicios, toda la lógica existente)
  - **"Calculadora GPU"** → la nueva página (formulario + cálculos)
- El switcher debe integrarse visualmente con el Header existente o colocarse en el top de la ventana.

### 2. Nueva Página: Calculadora GPU / Modelo IA
- **100% frontend**, sin conexión al backend ni a la base de datos.
- Contiene un formulario con los siguientes campos organizados en grupos:

#### 📐 Del modelo (arquitectura)
- `num_hidden_layers` — número de capas transformer (number input)
- `num_key_value_heads` — cabezas KV (en GQA/MQA es menor que num_attention_heads) (number input)
- `head_dim` — dimensión por cabeza (hidden_size / num_attention_heads) (number input)
- `hidden_size` — dimensión oculta total (number input)
- `num_parameters` — totale de parámetros del modelo (number input, puede ser grande: millones/miles de millones)

#### 🔢 Precisión y cuantización
- `dtype_bytes` — bytes por elemento del modelo: float32=4, bfloat16/float16=2, int8=1, int4=0.5 (select con opciones predefinidas)
- `kv_cache_dtype_bytes` — bytes por elemento del KV cache (puede diferir del modelo, ej. fp8=1) (select con opciones predefinidas)

#### 🖥️ Hardware
- `vram_total_gb` — VRAM total de la GPU (number input)
- `gpu_memory_utilization` — fracción reservada para vLLM (default 0.90, number input entre 0 y 1)

#### 🎯 Carga de trabajo objetivo
- `max_model_len` — longitud de contexto deseada (tokens de input + output) (number input)
- `max_num_seqs` — número de usuarios/requests concurrentes objetivo (number input)
- `avg_prompt_len` — longitud media del prompt (tokens) (number input)
- `avg_output_len` — longitud media de la respuesta generada (tokens) (number input)
- `prefix_cache_hit_ratio` — % de tokens reutilizados por prefix caching (para usuarios recurrentes con system prompt fijo) (number input, porcentaje 0-100 o decimal 0-1)

### 3. Funcionalidad de Cálculos
La página debe realizar cálculos en tiempo real basados en los inputs del formulario. Los cálculos típicos de esta calculadora para vLLM/GPU son:
- **Tamaño del modelo en VRAM:** `num_parameters * dtype_bytes` (convertido a GB)
- **KV Cache por secuencia:** `(max_model_len * num_key_value_heads * head_dim * kv_cache_dtype_bytes * 2)` (por key + value, convertido a MB o GB)
- **KV Cache total:** `"KV cache por secuencia" * max_num_seqs`
- **VRAM disponible para vLLM:** `vram_total_gb * gpu_memory_utilization`
- **VRAM utilizada total:** modelo + KV cache total
- **VRAM restante:** disponible - utilizada
- **Efecto del prefix cache** en la reducción del KV cache

### 4. Resultados visuales
Mostrar los resultados de forma clara y visual similar al estilo existente (barras, colores GPU green/yellow/red según porcentaje ya definido en la app). Usar el mismo sistema de diseño Tailwind que ya tiene el proyecto.

### 5. Consideraciones
- Mantener coherencia visual con la paleta, tipografía y componentes existentes.
- El modelo debe seguir siendo un componente independiente bien estructurado.
- Validación básica de inputs (valores positivos, ranges válidos).
- Responsive design como el resto de la app.
