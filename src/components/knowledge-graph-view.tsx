"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const nodeColors: Record<string, string> = {
  objective: "#18181b",
  plan: "#3b82f6",
  agentRun: "#8b5cf6",
  evaluation: "#f59e0b",
  decision: "#10b981",
  commit: "#6b7280",
};

function layoutNodes(
  apiNodes: Array<{ id: string; type: string; label: string }>
): Node[] {
  const layers: Record<string, number> = {
    objective: 0,
    plan: 1,
    agentRun: 2,
    evaluation: 3,
    decision: 4,
    commit: 5,
  };

  const counts: Record<number, number> = {};

  return apiNodes.map((node) => {
    const layer = layers[node.type] ?? 0;
    const index = counts[layer] ?? 0;
    counts[layer] = index + 1;

    return {
      id: node.id,
      data: {
        label: (
          <div className="text-xs">
            <p className="font-medium">{node.type}</p>
            <p>{node.label}</p>
          </div>
        ),
      },
      position: { x: layer * 220, y: index * 100 },
      style: {
        background: nodeColors[node.type] ?? "#71717a",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: 8,
        width: 180,
      },
    };
  });
}

export function KnowledgeGraphView({ objectiveId }: { objectiveId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    const res = await fetch(`/api/objectives/${objectiveId}/graph`);
    if (!res.ok) return;

    const data = await res.json();
    setNodes(layoutNodes(data.nodes));
    setEdges(
      data.edges.map((edge: { id: string; source: string; target: string }) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: true,
      }))
    );
    setLoading(false);
  }, [objectiveId, setNodes, setEdges]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading knowledge graph...</p>;
  }

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No graph data yet. Add plans, runs, evaluations, and a decision to build the graph.
      </p>
    );
  }

  return (
    <div className="h-[600px] rounded-xl border border-zinc-200 dark:border-zinc-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <p className="mt-2 text-xs text-zinc-500">
        Navigate to the{" "}
        <Link href={`/objectives/${objectiveId}`} className="underline">
          objective page
        </Link>{" "}
        to add more entities.
      </p>
    </div>
  );
}
