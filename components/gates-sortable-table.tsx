"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Gate } from "@/lib/config/schema";
import { cn } from "@/lib/utils";

type GatesSortableTableProps = {
  gates: Gate[];
  onReorder: (orderedIds: string[]) => void;
  onToggleStartGate: (gate: Gate) => void;
  onToggleEnabled: (gate: Gate) => void;
  onPingGate: (gateId: string) => void;
};

type SortableGateRowProps = {
  gate: Gate;
  order: number;
  onToggleStartGate: (gate: Gate) => void;
  onToggleEnabled: (gate: Gate) => void;
  onPingGate: (gateId: string) => void;
};

function SortableGateRow({
  gate,
  order,
  onToggleStartGate,
  onToggleEnabled,
  onPingGate,
}: SortableGateRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: gate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "bg-muted/60 shadow-sm")}
      data-testid={`gate-row-${gate.id}`}
    >
      <TableCell className="w-10 px-2">
        <button
          type="button"
          className="flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder ${gate.id}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </TableCell>
      <TableCell className="w-12 px-2 text-center">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold tabular-nums text-muted-foreground">
          {order}
        </span>
      </TableCell>
      <TableCell className="font-mono font-medium">{gate.id}</TableCell>
      <TableCell className="font-mono text-xs">{gate.host}</TableCell>
      <TableCell>
        <Switch
          checked={gate.isStartGate}
          onCheckedChange={() => onToggleStartGate(gate)}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={gate.enabled}
          onCheckedChange={() => onToggleEnabled(gate)}
        />
      </TableCell>
      <TableCell className="space-x-2 text-right">
        {gate.isStartGate && <Badge variant="secondary">start</Badge>}
        <Button size="sm" variant="outline" onClick={() => onPingGate(gate.id)}>
          Ping
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function GatesSortableTable({
  gates,
  onReorder,
  onToggleStartGate,
  onToggleEnabled,
  onPingGate,
}: GatesSortableTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gates.findIndex((g) => g.id === active.id);
    const newIndex = gates.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(gates, oldIndex, newIndex);
    onReorder(reordered.map((g) => g.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" aria-label="Reorder" />
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext
            items={gates.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            {gates.map((gate, index) => (
              <SortableGateRow
                key={gate.id}
                gate={gate}
                order={index + 1}
                onToggleStartGate={onToggleStartGate}
                onToggleEnabled={onToggleEnabled}
                onPingGate={onPingGate}
              />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
    </DndContext>
  );
}
