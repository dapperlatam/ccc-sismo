import type { CCCRecord } from "./types";

export async function exportToExcel(
  records: CCCRecord[],
  reviewed: Record<string, string>
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Registros");

  const cols: { header: string; key: string; width: number }[] = [
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Relacionado con el sismo", key: "sismo", width: 14 },
    { header: "Título", key: "titulo", width: 50 },
    { header: "Entidad", key: "entidad", width: 36 },
    { header: "Entidad emisora", key: "emisora", width: 32 },
    { header: "Ámbito", key: "ambito", width: 14 },
    { header: "Tipo de entidad", key: "entidadTipo", width: 16 },
    { header: "Ejes", key: "ejes", width: 36 },
    { header: "Fecha de publicación", key: "pub", width: 16 },
    { header: "Vigencia", key: "vigencia", width: 30 },
    { header: "Fecha de cierre", key: "cierre", width: 16 },
    { header: "Vigente", key: "vigente", width: 10 },
    { header: "Descripción", key: "desc", width: 70 },
    { header: "Epígrafe", key: "epigrafe", width: 50 },
    { header: "Beneficio", key: "beneficio", width: 40 },
    { header: "Requisitos", key: "req", width: 40 },
    { header: "Necesidad que atiende", key: "necesidad", width: 30 },
    { header: "Tipo de apoyo", key: "apoyo", width: 20 },
    { header: "Segmento", key: "segmento", width: 18 },
    { header: "Sector", key: "sector", width: 20 },
    { header: "Cobertura territorial", key: "cobertura", width: 20 },
    { header: "Contacto", key: "contacto", width: 28 },
    { header: "Teléfono", key: "tel", width: 16 },
    { header: "Enlace para aplicar", key: "aplicar", width: 40 },
    { header: "Enlace al documento", key: "documento", width: 40 },
    { header: "Fuente original", key: "fuente", width: 40 },
    { header: "Copia archivada", key: "archivo", width: 40 },
    { header: "Datos por verificar", key: "verificar", width: 14 },
    { header: "Motivo de verificación", key: "motivo", width: 28 },
    { header: "Detectado por primera vez", key: "primera", width: 20 },
    { header: "Estado de revisión", key: "estado", width: 16 },
    { header: "Fecha de revisión", key: "fechaRev", width: 16 },
    { header: "ID", key: "id", width: 20 },
  ];
  ws.columns = cols;

  const link = (url: string | null) =>
    url ? { text: url, hyperlink: url } : "";

  for (const r of records) {
    const rev = reviewed[r.id];
    ws.addRow({
      tipo: r.record_type === "ayuda" ? "Ayuda" : "Regulación",
      sismo: r.earthquake_related ? "Sí" : "No",
      titulo: r.title,
      entidad: r.entity,
      emisora: r.issuing_entity ?? "",
      ambito: r.entity_ambito,
      entidadTipo: r.entity_tipo,
      ejes: r.axes.join(", "),
      pub: r.publication_date ?? "",
      vigencia: r.end_date_text ?? "",
      cierre: r.end_date ?? "",
      vigente: r.is_active ? "Sí" : "No",
      desc: r.description ?? "",
      epigrafe: r.epigraph ?? "",
      beneficio: r.amount_or_benefit ?? "",
      req: r.eligibility ?? "",
      necesidad: r.specific_need ?? "",
      apoyo: r.support_type ?? "",
      segmento: r.segment ?? "",
      sector: r.sector_focus ?? "",
      cobertura: r.territorial_coverage ?? "",
      contacto: r.contact ?? "",
      tel: r.contact_phone ?? "",
      aplicar: link(r.application_url),
      documento: link(r.document_url),
      fuente: link(r.source_url),
      archivo: link(r.source_archive_url),
      verificar: r.needs_review ? "Sí" : "No",
      motivo: r.needs_review_reason ?? "",
      primera: r.first_seen_at.slice(0, 10),
      estado: rev ? "Revisada" : "Pendiente",
      fechaRev: rev ? new Date(rev).toLocaleDateString("es-CO") : "",
      id: r.id,
    });
  }

  // Encabezado con el color berenjena de Dapper
  const header = ws.getRow(1);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F1C5F" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.eachRow((row, n) => {
    if (n > 1) row.alignment = { vertical: "top", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cols.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ayudas-sismo-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}