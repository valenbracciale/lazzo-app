export type BusinessType =
  | "restaurante_bar"
  | "peluqueria_salon"
  | "gimnasio_academia";

export const BUSINESS_TYPES: {
  value: BusinessType;
  label: string;
  description: string;
}[] = [
  {
    value: "restaurante_bar",
    label: "Restaurante o bar",
    description: "Reservás mesas para tus comensales, con horarios de turno.",
  },
  {
    value: "peluqueria_salon",
    label: "Peluquería o salón",
    description: "Reservás turnos para servicios con uno o varios profesionales.",
  },
  {
    value: "gimnasio_academia",
    label: "Gimnasio o academia",
    description: "Reservás cupos en clases o actividades con horario fijo.",
  },
];
