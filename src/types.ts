/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Activity {
  id: string;
  dia: string; // e.g. "Lunes"
  fecha: string; // e.g. "2026-06-15"
  tiempo: string; // e.g. "08:30"
  fin_de_hora?: string; // e.g. "10:30"
  descripcion: string;
  responsable: string;
  equipo: string;
  requisito: string;
  ingreso: number;
  gastos: number;
  resultado: string;
  numero_estudiantes?: number;
  fichero_url?: string;
  historial_cambios?: string;
  usuario_email?: string;
}

export type DayName = "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes";

export const WEEK_DAYS: { nombre: DayName; fecha: string }[] = [
  { nombre: "Lunes", fecha: "2026-06-15" },
  { nombre: "Martes", fecha: "2026-06-16" },
  { nombre: "Miércoles", fecha: "2026-06-17" },
  { nombre: "Jueves", fecha: "2026-06-18" },
  { nombre: "Viernes", fecha: "2026-06-19" },
];
