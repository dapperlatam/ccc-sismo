import type { Dataset } from "./types";

const DATA_URL =
  process.env.DATA_URL ??
  "https://storage.googleapis.com/prod_public_access_files/Colombia/CCCali/structured_output/records_latest.json";

export async function getDataset(): Promise<Dataset> {
  const res = await fetch(DATA_URL, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`No se pudo cargar el dataset (${res.status})`);
  }
  return res.json();
}