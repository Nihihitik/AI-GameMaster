"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type ColorMode,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableNode, type TableNodeData, type TableNodeType, tableHandleId } from "@/components/database/table-node";
import { layoutTables } from "@/lib/schema/layout";
import type { SchemaResponse } from "@/lib/schema/types";

const nodeTypes = { table: TableNode };

const EMPTY_COLUMN_SET: ReadonlySet<string> = new Set<string>();

interface HighlightState {
  tables: ReadonlySet<string>;
  columns: ReadonlyMap<string, ReadonlySet<string>>;
}

const EMPTY_HIGHLIGHT: HighlightState = { tables: new Set(), columns: new Map() };

function buildHighlight(
  schema: SchemaResponse,
  focus: { table: string; column: string } | null,
): HighlightState {
  if (!focus) return EMPTY_HIGHLIGHT;
  const tables = new Set<string>([focus.table]);
  const columns = new Map<string, Set<string>>();
  columns.set(focus.table, new Set([focus.column]));
  for (const rel of schema.relationships) {
    if (rel.from.table === focus.table && rel.from.column === focus.column) {
      tables.add(rel.to.table);
      const s = columns.get(rel.to.table) ?? new Set<string>();
      s.add(rel.to.column);
      columns.set(rel.to.table, s);
    }
    if (rel.to.table === focus.table && rel.to.column === focus.column) {
      tables.add(rel.from.table);
      const s = columns.get(rel.from.table) ?? new Set<string>();
      s.add(rel.from.column);
      columns.set(rel.from.table, s);
    }
  }
  return { tables, columns };
}

interface EdgeMeta {
  from: { table: string; column: string };
  to: { table: string; column: string };
}

function ErdCanvas({ schema }: { schema: SchemaResponse }) {
  const [focus, setFocus] = React.useState<{ table: string; column: string } | null>(null);
  const { resolvedTheme } = useTheme();
  const colorMode: ColorMode = resolvedTheme === "dark" ? "dark" : "light";

  const onColumnClick = React.useCallback((table: string, column: string) => {
    setFocus((prev) => (prev?.table === table && prev?.column === column ? null : { table, column }));
  }, []);

  // Базовый набор нод со свежим layout'ом — создаётся только при изменении схемы
  // или reloadKey. Положения не зависят от focus, поэтому user-drag не сбрасывается
  // при подсветке связей.
  const initialNodes = React.useMemo<TableNodeType[]>(() => {
    const positions = layoutTables(schema.tables, schema.relationships);
    const byName = new Map(positions.map((p) => [p.name, p]));
    return schema.tables.map((t) => {
      const pos = byName.get(t.name);
      const data: TableNodeData = {
        name: t.name,
        columns: t.columns,
        highlighted: false,
        dimmed: false,
        highlightedColumns: EMPTY_COLUMN_SET as Set<string>,
        onColumnClick,
      };
      return {
        id: t.name,
        type: "table" as const,
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
        data,
        draggable: true,
      } satisfies TableNodeType;
    });
  }, [schema, onColumnClick]);

  const initialEdges = React.useMemo<Edge[]>(() => {
    return schema.relationships.map((rel, i) => ({
      id: `${rel.from.table}.${rel.from.column}-${rel.to.table}.${rel.to.column}-${i}`,
      source: rel.from.table,
      sourceHandle: tableHandleId(rel.from.table, rel.from.column, "source"),
      target: rel.to.table,
      targetHandle: tableHandleId(rel.to.table, rel.to.column, "target"),
      type: "smoothstep",
      animated: false,
      style: { stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)", width: 12, height: 12 },
      data: { from: rel.from, to: rel.to } satisfies EdgeMeta,
    }));
  }, [schema]);

  const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeType>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // Сброс focus при перезагрузке схемы — ссылка могла стать невалидной
  // (таблица/колонка больше не существует).
  React.useEffect(() => {
    setFocus(null);
  }, [schema]);

  // Полный ресет нод/edges при смене схемы.
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const highlight = React.useMemo(() => buildHighlight(schema, focus), [schema, focus]);

  // Один эффект вместо двух: обновляет data-поля нод и style/animated у edges
  // при смене focus. Identity short-circuit возвращает тот же объект если ничего
  // не изменилось — так на initial mount с focus=null React не видит diff и
  // избегает лишнего рендера всего списка.
  React.useEffect(() => {
    const focusActive = focus !== null;

    setNodes((prev) =>
      prev.map((n) => {
        const nextHighlighted = focusActive && highlight.tables.has(n.id);
        const nextDimmed = focusActive && !highlight.tables.has(n.id);
        const nextCols = (highlight.columns.get(n.id) ?? EMPTY_COLUMN_SET) as Set<string>;
        if (
          n.data.highlighted === nextHighlighted &&
          n.data.dimmed === nextDimmed &&
          n.data.highlightedColumns === nextCols
        ) {
          return n;
        }
        return {
          ...n,
          data: {
            ...n.data,
            highlighted: nextHighlighted,
            dimmed: nextDimmed,
            highlightedColumns: nextCols,
          },
        };
      }),
    );

    setEdges((prev) =>
      prev.map((e) => {
        const rel = e.data as EdgeMeta | undefined;
        if (!rel) return e;
        const isFocused =
          focusActive &&
          ((rel.from.table === focus.table && rel.from.column === focus.column) ||
            (rel.to.table === focus.table && rel.to.column === focus.column));
        const nextOpacity = !focusActive ? 1 : isFocused ? 1 : 0.15;
        const nextStroke = isFocused ? "rgb(14 165 233)" : "var(--muted-foreground)";
        const nextWidth = isFocused ? 1.5 : 1;
        if (
          e.animated === isFocused &&
          e.style?.opacity === nextOpacity &&
          e.style?.stroke === nextStroke &&
          e.style?.strokeWidth === nextWidth
        ) {
          return e;
        }
        return {
          ...e,
          animated: isFocused,
          style: {
            ...e.style,
            stroke: nextStroke,
            strokeWidth: nextWidth,
            opacity: nextOpacity,
          },
        };
      }),
    );
  }, [focus, highlight, setNodes, setEdges]);

  const onPaneClick = React.useCallback(() => setFocus(null), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      colorMode={colorMode}
      fitView
      fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls position="bottom-right" showInteractive={false} />
    </ReactFlow>
  );
}

export function DatabaseView() {
  const [schema, setSchema] = React.useState<SchemaResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/schema", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `HTTP ${res.status}`);
        setSchema(null);
        return;
      }
      setError(null);
      setSchema(json as SchemaResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div>
          <h2 className="text-xs font-medium tracking-tight">Схема БД</h2>
          <p className="text-[11px] text-muted-foreground">
            ERD из SQLAlchemy metadata. Таблицы можно перемещать, масштабировать, панорамировать. Клик по колонке —
            подсветка связей.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          Обновить
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {!schema && !error ? (
          <div className="grid h-full grid-cols-3 gap-4 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            Не удалось загрузить схему: {error}
            <div className="mt-2 text-[11px] opacity-70">
              Проверь что backend поднят и OBSERVABILITY_ENABLED=true.
            </div>
          </div>
        ) : (
          <ReactFlowProvider>
            <ErdCanvas schema={schema!} />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
