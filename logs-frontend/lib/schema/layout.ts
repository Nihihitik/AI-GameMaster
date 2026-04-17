import dagre from "dagre";
import type { SchemaRelationship, SchemaTable } from "@/lib/schema/types";

export interface PositionedTable {
  name: string;
  x: number;
  y: number;
}

const NODE_WIDTH = 260;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 28;
const PADDING = 8;

export function estimateNodeHeight(table: SchemaTable): number {
  return HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + PADDING;
}

export function layoutTables(
  tables: SchemaTable[],
  relationships: SchemaRelationship[],
): PositionedTable[] {
  const graph = new dagre.graphlib.Graph({ compound: false });
  graph.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const table of tables) {
    graph.setNode(table.name, { width: NODE_WIDTH, height: estimateNodeHeight(table) });
  }
  for (const rel of relationships) {
    // dagre ломается на self-loops — отсекаем
    if (rel.from.table === rel.to.table) continue;
    if (graph.hasNode(rel.from.table) && graph.hasNode(rel.to.table)) {
      graph.setEdge(rel.from.table, rel.to.table);
    }
  }

  dagre.layout(graph);

  const positioned: PositionedTable[] = tables.map((t) => {
    const n = graph.node(t.name);
    // dagre даёт координаты центра, React Flow ожидает top-left
    return {
      name: t.name,
      x: n ? n.x - NODE_WIDTH / 2 : 0,
      y: n ? n.y - estimateNodeHeight(t) / 2 : 0,
    };
  });

  return positioned;
}
