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
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SequenceStep } from "@/lib/types";
import { cn } from "@/lib/utils";

type RoutineStepsSortableTableProps = {
  eventType: string;
  steps: SequenceStep[];
  onReorder: (orderedIds: string[]) => void;
  onDelete: (stepId: string) => void;
  renderStepCell: (step: SequenceStep) => ReactNode;
};

type SortableStepRowProps = {
  eventType: string;
  step: SequenceStep;
  order: number;
  onDelete: (stepId: string) => void;
  renderStepCell: (step: SequenceStep) => ReactNode;
};

function SortableStepRow({
  eventType,
  step,
  order,
  onDelete,
  renderStepCell,
}: SortableStepRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "bg-muted/60 shadow-sm")}
      data-testid={`routine-step-${eventType}-${step.id}`}
    >
      <TableCell className="w-10 px-2">
        <button
          type="button"
          className="flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder step ${order}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </TableCell>
      <TableCell className="w-12 px-2 text-center font-mono tabular-nums text-muted-foreground">
        {order}
      </TableCell>
      <TableCell>{renderStepCell(step)}</TableCell>
      <TableCell className="space-x-2 text-right">
        {step.kind === "delay" && <Badge variant="secondary">wait</Badge>}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete(step.id)}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function RoutineStepsSortableTable({
  eventType,
  steps,
  onReorder,
  onDelete,
  renderStepCell,
}: RoutineStepsSortableTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(steps, oldIndex, newIndex);
    onReorder(reordered.map((s) => s.id));
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
            <TableHead>Step</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {steps.map((step, index) => (
              <SortableStepRow
                key={step.id}
                eventType={eventType}
                step={step}
                order={index + 1}
                onDelete={onDelete}
                renderStepCell={renderStepCell}
              />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
    </DndContext>
  );
}
