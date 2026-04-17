export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  is_pk: boolean;
  is_fk: boolean;
  references: { table: string; column: string } | null;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

export interface SchemaRelationship {
  from: { table: string; column: string };
  to: { table: string; column: string };
}

export interface SchemaResponse {
  tables: SchemaTable[];
  relationships: SchemaRelationship[];
}
