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
import { useEffect, useState } from "react";
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
import { formatLastSeen, type GateView } from "@/lib/gate-health";
import { cn } from "@/lib/utils";

type GatesSortableTableProps = {
  gates: GateView[];
  onReorder: (orderedIds: string[]) => void;
  onToggleStartGate: (gate: GateView) => void;
  onToggleEnabled: (gate: GateView) => void;
  onPingGate: (gateId: string) => void;
  onForgetGate: (gate: GateView) => void;
};

type SortableGateRowProps = {
  gate: GateView;
  order: number;
  now: number;
  onToggleStartGate: (gate: GateView) => void;
  onToggleEnabled: (gate: GateView) => void;
  onPingGate: (gateId: string) => void;
  onForgetGate: (gate: GateView) => void;
};

function rssiClass(rssi: number | null): string {
  if (rssi === null) return "text-muted-foreground";
  if (rssi >= -65) return "text-status-ok";
  if (rssi >= -80) return "text-status-warn";
  return "text-status-error";
}

function tempClass(tempC: number | null): string {
  if (tempC === null) return "text-muted-foreground";
  if (tempC >= 80) return "text-status-error";
  if (tempC >= 70) return "text-status-warn";
  return "text-foreground";
}

function SortableGateRow({
  gate,
  order,
  now,
  onToggleStartGate,
  onToggleEnabled,
  onPingGate,
  onForgetGate,
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
      className={cn(
        isDragging && "bg-muted/60 shadow-sm",
        !gate.online && "text-muted-foreground",
      )}
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
      <TableCell className="font-mono font-medium text-foreground">
        {gate.id}
      </TableCell>
      <TableCell className="font-mono text-xs">{gate.host}</TableCell>
      <TableCell>
        <span
          className="inline-flex items-center gap-1.5 text-sm"
          data-testid={`gate-status-${gate.id}`}
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              gate.online ? "bg-status-ok" : "bg-status-muted",
            )}
            aria-hidden
          />
          {gate.online ? "Online" : "Offline"}
        </span>
      </TableCell>
      <TableCell
        className="font-mono text-xs tabular-nums"
        data-testid={`gate-last-seen-${gate.id}`}
      >
        {formatLastSeen(gate.lastSeenAt, now)}
      </TableCell>
      <TableCell
        className={cn("font-mono text-xs tabular-nums", rssiClass(gate.rssi))}
        data-testid={`gate-rssi-${gate.id}`}
      >
        {gate.rssi === null ? "—" : `${Math.round(gate.rssi)} dBm`}
      </TableCell>
      <TableCell
        className={cn("font-mono text-xs tabular-nums", tempClass(gate.tempC))}
        data-testid={`gate-temp-${gate.id}`}
      >
        {gate.tempC === null ? "—" : `${Math.round(gate.tempC)}°`}
      </TableCell>
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
        <Button size="sm" variant="outline" onClick={() => onForgetGate(gate)}>
          Forget
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
  onForgetGate,
}: GatesSortableTableProps) {
  const [now, setNow] = useState(() => Date.now());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" aria-label="Reorder" />
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>WiFi</TableHead>
              <TableHead>Temp</TableHead>
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
                  now={now}
                  onToggleStartGate={onToggleStartGate}
                  onToggleEnabled={onToggleEnabled}
                  onPingGate={onPingGate}
                  onForgetGate={onForgetGate}
                />
              ))}
            </SortableContext>
          </TableBody>
        </Table>
      </div>
    </DndContext>
  );
}
