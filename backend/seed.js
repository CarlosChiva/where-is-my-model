import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

/* ------------------------------------------------------------------ */
/*  Environment loading (relative to this file's location)             */
/* ------------------------------------------------------------------ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.development') });

/* ------------------------------------------------------------------ */
/*  Model import                                                      */
/* ------------------------------------------------------------------ */

import PC from './models/PC.js';

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/where-is-my-model';

/* ------------------------------------------------------------------ */
/*  Data loading                                                      */
/* ------------------------------------------------------------------ */

function loadData() {
  const dataPath = resolve(__dirname, '..', 'data.json');
  const raw = readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw);
}

/* ------------------------------------------------------------------ */
/*  Data mapping: hyphenated slug-wrapped → Mongoose camelCase        */
/* ------------------------------------------------------------------ */

function mapToMongooseDocuments(rawData) {
  return rawData.pc.map((pcWrapper) => {
    const pcData = Object.values(pcWrapper)[0];
    const mappedServices = pcData.servicios.map((svcWrapper) => {
      const svcData = Object.values(svcWrapper)[0];
      return {
        nombre: svcData['nombre-servicio'],
        puerto: svcData.puerto,
        gpu: svcData['tamaño-de-servicio-en-gpu'],
      };
    });
    return {
      nombre: pcData.nombre,
      ip: pcData.ip,
      vram: pcData['memoria-vram-en-gb'],
      servicios: mappedServices,
    };
  });
}
