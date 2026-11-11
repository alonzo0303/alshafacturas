export type PurchaseTax = {
  tipo: string;
  gravada: boolean;
  incluye: boolean;
  credito: boolean;
  ruc: string;
};
export const emptyPurchaseTax: PurchaseTax = {
  tipo: "INTERNO",
  gravada: false,
  incluye: true,
  credito: false,
  ruc: "",
};
