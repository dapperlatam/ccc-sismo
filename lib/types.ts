export type Axis =
  | "Financiamiento y liquidez"
  | "Operación o ventas"
  | "Conexiones";

export interface CCCRecord {
  id: string;
  record_type: "ayuda" | "regulacion";
  earthquake_related: boolean;
  earthquake_evidence: string | null;
  title: string;
  issuing_entity: string | null;
  description: string | null;
  epigraph: string | null;
  key_points: string[];
  axes: Axis[];
  publication_date: string | null;
  end_date: string | null;
  end_date_text: string | null;
  is_active: boolean;
  contact: string | null;
  contact_phone: string | null;
  application_url: string | null;
  document_url: string | null;
  source_url: string;
  source_archive_url: string | null;
  also_seen_at: string[];
  entity: string;
  entity_tipo: string;
  entity_ambito: string;
  support_type: string | null;
  sector_focus: string | null;
  segment: string | null;
  territorial_coverage: string | null;
  eligibility: string | null;
  specific_need: string | null;
  amount_or_benefit: string | null;
  needs_review: boolean;
  needs_review_reason: string | null;
  first_seen_at: string;
  extracted_at: string;
}

export interface Dataset {
  schema_version: string;
  generated_at: string;
  stats: {
    silver_rows: number;
    passed_qa: number;
    rejected_qa: number;
    published: number;
  };
  records: CCCRecord[];
}