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
import { useState } from "react";
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
  onTestGate: (gateId: string) => void;
  testingGateIds: ReadonlySet<string>;
  onForgetGate: (gate: GateView) => void;
};

type SortableGateRowProps = {
  gate: GateView;
  order: number;
  onToggleStartGate: (gate: GateView) => void;
  onToggleEnabled: (gate: GateView) => void;
  onTestGate: (gateId: string) => void;
  testing: boolean;
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

function useSeenPing(lastSeenAt: string | null, online: boolean) {
  const [trackedSeen, setTrackedSeen] = useState(lastSeenAt);
  const [pinging, setPinging] = useState(false);
  if (lastSeenAt !== trackedSeen) {
    setTrackedSeen(lastSeenAt);
    setPinging(Boolean(online && lastSeenAt));
  }
  return pinging;
}

function StatusDot({
  gateId,
  online,
  pinging,
  testId,
}: {
  gateId: string;
  online: boolean;
  pinging: boolean;
  testId?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm"
      data-testid={testId ? `gate-status-${gateId}` : undefined}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          online ? "bg-status-ok" : "bg-status-muted",
          online && pinging && "gate-status-ping",
        )}
        aria-hidden
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function SortableGateRow({
  gate,
  order,
  onToggleStartGate,
  onToggleEnabled,
  onTestGate,
  testing,
  onForgetGate,
}: SortableGateRowProps) {
  const pinging = useSeenPing(gate.lastSeenAt, gate.online);
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
        <StatusDot
          key={gate.lastSeenAt ?? "unseen"}
          gateId={gate.id}
          online={gate.online}
          pinging={pinging}
          testId
        />
      </TableCell>
      <TableCell
        className={cn("font-mono text-xs tabular-nums", rssiClass(gate.rssi))}
        data-testid={`gate-rssi-${gate.id}`}
      >
        {gate.rssi === null ? "—" : `${Math.round(gate.rssi)} dBm`}
      </TableCell>
      <TableCell
        className={cn(
          "font-mono text-xs tabular-nums",
          rssiClass(gate.rssiMin),
        )}
        data-testid={`gate-rssi-min-${gate.id}`}
        title={
          gate.lastOfflineAt
            ? `Last dropout ${formatLastSeen(gate.lastOfflineAt)}`
            : undefined
        }
      >
        {gate.rssiMin === null ? "—" : `${Math.round(gate.rssiMin)} dBm`}
      </TableCell>
      <TableCell
        className="font-mono text-xs tabular-nums"
        data-testid={`gate-disconnects-${gate.id}`}
      >
        {gate.disconnects === null ? "—" : String(gate.disconnects)}
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
        <Button
          size="sm"
          variant="outline"
          disabled={testing}
          onClick={() => onTestGate(gate.id)}
          data-testid={`gate-test-${gate.id}`}
        >
          {testing ? "Testing…" : "Test"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onForgetGate(gate)}>
          Forget
        </Button>
      </TableCell>
    </TableRow>
  );
}

function metric(value: number | null, suffix: string) {
  return value === null ? "—" : `${Math.round(value)}${suffix}`;
}

function SortableGateCard({
  gate,
  order,
  onToggleStartGate,
  onToggleEnabled,
  onTestGate,
  testing,
  onForgetGate,
}: SortableGateRowProps) {
  const pinging = useSeenPing(gate.lastSeenAt, gate.online);
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
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border bg-muted/20 p-3",
        isDragging && "bg-muted/60 shadow-sm",
        !gate.online && "text-muted-foreground",
      )}
      data-testid={`gate-mobile-${gate.id}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder ${gate.id}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold tabular-nums text-muted-foreground">
              {order}
            </span>
            <p className="font-mono font-medium text-foreground">{gate.id}</p>
            {gate.isStartGate ? <Badge variant="secondary">start</Badge> : null}
          </div>
          <p className="mt-1 truncate font-mono text-xs">{gate.host}</p>
        </div>
        <StatusDot
          key={gate.lastSeenAt ?? "unseen"}
          gateId={gate.id}
          online={gate.online}
          pinging={pinging}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">WiFi</dt>
          <dd className={cn("font-mono tabular-nums", rssiClass(gate.rssi))}>
            {metric(gate.rssi, " dBm")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Worst</dt>
          <dd className={cn("font-mono tabular-nums", rssiClass(gate.rssiMin))}>
            {metric(gate.rssiMin, " dBm")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Drops</dt>
          <dd className="font-mono tabular-nums">
            {gate.disconnects === null ? "—" : String(gate.disconnects)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Temp</dt>
          <dd className={cn("font-mono tabular-nums", tempClass(gate.tempC))}>
            {metric(gate.tempC, "°")}
          </dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 text-sm">
          Start
          <Switch
            checked={gate.isStartGate}
            onCheckedChange={() => onToggleStartGate(gate)}
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 text-sm">
          Enabled
          <Switch
            checked={gate.enabled}
            onCheckedChange={() => onToggleEnabled(gate)}
          />
        </label>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={testing}
          onClick={() => onTestGate(gate.id)}
          aria-label={`Test ${gate.id}`}
          data-testid={`gate-test-mobile-${gate.id}`}
        >
          {testing ? "Testing…" : "Test"}
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => onForgetGate(gate)}
          aria-label={`Forget ${gate.id}`}
          data-testid={`gate-forget-mobile-${gate.id}`}
        >
          Forget
        </Button>
      </div>
    </li>
  );
}

export function GatesSortableTable({
  gates,
  onReorder,
  onToggleStartGate,
  onToggleEnabled,
  onTestGate,
  testingGateIds,
  onForgetGate,
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

  const rows = gates.map((gate, index) => (
    <SortableGateRow
      key={gate.id}
      gate={gate}
      order={index + 1}
      onToggleStartGate={onToggleStartGate}
      onToggleEnabled={onToggleEnabled}
      onTestGate={onTestGate}
      testing={testingGateIds.has(gate.id)}
      onForgetGate={onForgetGate}
    />
  ));

  const cards = gates.map((gate, index) => (
    <SortableGateCard
      key={gate.id}
      gate={gate}
      order={index + 1}
      onToggleStartGate={onToggleStartGate}
      onToggleEnabled={onToggleEnabled}
      onTestGate={onTestGate}
      testing={testingGateIds.has(gate.id)}
      onForgetGate={onForgetGate}
    />
  ));

  return (
    <>
      <div className="lg:hidden" data-testid="gates-mobile-list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={gates.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-3">{cards}</ul>
          </SortableContext>
        </DndContext>
      </div>
      <div className="hidden lg:block">
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
              <TableHead>WiFi</TableHead>
              <TableHead>Worst</TableHead>
              <TableHead>Drops</TableHead>
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
              {rows}
            </SortableContext>
          </TableBody>
            </Table>
          </div>
        </DndContext>
      </div>
    </>
  );
}
