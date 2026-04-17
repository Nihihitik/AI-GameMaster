"use client";

import * as React from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Key, Link2, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchemaColumn } from "@/lib/schema/types";

export interface TableNodeData extends Record<string, unknown> {
  name: string;
  columns: SchemaColumn[];
  highlighted: boolean;
  dimmed: boolean;
  highlightedColumns: Set<string>;
  onColumnClick?: (tableName: string, columnName: string) => void;
}

export type TableNodeType = Node<TableNodeData, "table">;

const COLUMN_HEIGHT = 28;

export function tableHandleId(table: string, column: string, side: "source" | "target"): string {
  return `${table}.${column}.${side}`;
}

function ColumnIcon({ column }: { column: SchemaColumn }) {
  if (column.is_pk) {
    return <Key className="h-3 w-3 shrink-0 text-amber-500" aria-label="primary key" />;
  }
  if (column.is_fk) {
    return <Link2 className="h-3 w-3 shrink-0 text-sky-500" aria-label="foreign key" />;
  }
  return <span className="h-3 w-3 shrink-0 opacity-0" aria-hidden />;
}

function ColumnRow({
  column,
  table,
  isHighlighted,
  onClick,
}: {
  column: SchemaColumn;
  table: string;
  isHighlighted: boolean;
  onClick?: (tableName: string, columnName: string) => void;
}) {
  return (
    <div
      onClick={() => onClick?.(table, column.name)}
      className={cn(
        "relative flex items-center justify-between gap-2 border-t border-border/50 px-3 text-[11px] transition-colors",
        isHighlighted ? "bg-sky-500/10" : "hover:bg-muted/40",
        onClick && "cursor-pointer",
      )}
      style={{ height: COLUMN_HEIGHT }}
    >
      <Handle
        id={tableHandleId(table, column.name, "target")}
        type="target"
        position={Position.Left}
        className={cn(
          "!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent",
          column.is_fk && "!bg-sky-500/60",
        )}
      />
      <div className="flex min-w-0 items-center gap-1.5">
        <ColumnIcon column={column} />
        <span
          className={cn(
            "truncate font-mono",
            column.is_pk ? "font-semibold text-foreground" : "text-foreground",
            column.is_fk && !column.is_pk && "text-sky-600 dark:text-sky-300",
          )}
        >
          {column.name}
        </span>
      </div>
      <span className="shrink-0 truncate font-mono text-[10px] text-muted-foreground">{column.type}</span>
      <Handle
        id={tableHandleId(table, column.name, "source")}
        type="source"
        position={Position.Right}
        className={cn(
          "!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent",
          column.is_fk && "!bg-sky-500/60",
        )}
      />
    </div>
  );
}

export const TableNode = React.memo(function TableNode({ data }: NodeProps<TableNodeType>) {
  return (
    <div
      className={cn(
        "min-w-56 rounded-lg border border-border bg-card shadow-sm transition-all",
        data.highlighted && "ring-2 ring-sky-500/40",
        data.dimmed && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between gap-2 rounded-t-lg bg-muted/60 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <TableIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-medium">{data.name}</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{data.columns.length}</span>
      </div>
      <div className="flex flex-col">
        {data.columns.map((col) => (
          <ColumnRow
            key={col.name}
            column={col}
            table={data.name}
            isHighlighted={data.highlightedColumns.has(col.name)}
            onClick={data.onColumnClick}
          />
        ))}
      </div>
    </div>
  );
});
