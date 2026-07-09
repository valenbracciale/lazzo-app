export type BusinessType =
  | "restaurante_bar"
  | "peluqueria_salon"
  | "gimnasio_academia";

// "Reservas" stays as-is for restaurante_bar; peluqueria_salon and
// gimnasio_academia call the same feature "Turnos" throughout the UI.
export function reservationsLabel(businessType: BusinessType | null): string {
  return businessType === "restaurante_bar" || businessType === null
    ? "Reservas"
    : "Turnos";
}

export type BusinessTypeSummary = {
  reservations: string;
  stock: string;
  finance: string;
};

export const BUSINESS_TYPES: {
  value: BusinessType;
  label: string;
  summary: BusinessTypeSummary;
}[] = [
  {
    value: "restaurante_bar",
    label: "Restaurante o bar",
    summary: {
      reservations: "Mesas y turnos de comensales.",
      stock: "Insumos de cocina y barra.",
      finance: "Cierre de caja diario.",
    },
  },
  {
    value: "peluqueria_salon",
    label: "Peluquería o salón",
    summary: {
      reservations: "Turnos por profesional y servicio.",
      stock: "Productos usados en cada servicio.",
      finance: "Comisiones por profesional.",
    },
  },
  {
    value: "gimnasio_academia",
    label: "Gimnasio o academia",
    summary: {
      reservations: "Cupos por clase y horario.",
      stock: "Suplementos y artículos a la venta.",
      finance: "Cuotas y pagos recurrentes.",
    },
  },
];
