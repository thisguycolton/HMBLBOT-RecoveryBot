import React, { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Clock3, Users, Trophy } from "lucide-react";

function BurgerIcon() {
  return (
    <svg
      viewBox="0 0 44 62"
      className="h-14 w-14 md:h-16 md:w-16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="2" transform="scale(2)">
        <path d="m21 16.9286v-6.9286c0-3.77124 0-5.65685-1.1716-6.82843-1.1715-1.17157-3.0572-1.17157-6.8284-1.17157h-1c-3.77124 0-5.65685 0-6.82843 1.17157-1.17157 1.17158-1.17157 3.05719-1.17157 6.82843v9.5" />
        <path d="m21 17h-14.5c-1.38071 0-2.5 1.1193-2.5 2.5s1.11929 2.5 2.5 2.5h14.5" />
        <path d="m21 22c-1.3807 0-2.5-1.1193-2.5-2.5s1.1193-2.5 2.5-2.5" />
        <path
          d="m14.3877 6.84933c.318-.21509.7006-.34055 1.1123-.34055 1.1046 0 2 .90328 2 2.01755 0 1.09638-.9043 2.01367-2 2.01367v.96c0 .9428 0 1.4142-.2929 1.7071s-.7643.2929-1.7071.2929h-2c-.9428 0-1.4142 0-1.70711-.2929-.29289-.2929-.29289-.7643-.29289-1.7071v-.835c-1.16783 0-2-.86985-2-2.13867 0-1.11427.89543-2.01755 2-2.01755.41166 0 .7943.12546 1.1123.34055.2734-.78586 1.0153-1.34933 1.8877-1.34933s1.6143.56347 1.8877 1.34933zm0 0c.0727.20913.1123.43402.1123.66822"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

function ServiceField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}

function MilestoneItem({ milestone, onChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60  ${
        isDragging ? "opacity-70 shadow-xl" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing pt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Drag milestone"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="grid flex-1 gap-3 md:grid-cols-[1fr_auto_180px]">
          <input
            type="text"
            placeholder="Screen Name"
            value={milestone.screenName}
            onChange={(e) => onChange(milestone.id, "screenName", e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <div className="hidden items-center justify-center text-slate-500 md:flex">
            <Clock3 className="h-5 w-5" />
          </div>

          <input
            type="text"
            placeholder="Time"
            value={milestone.time}
            onChange={(e) => onChange(milestone.id, "time", e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
    </div>
  );
}

export default function HostBurgerHelper() {
  const [servicePeople, setServicePeople] = useState({
    cohost: "",
    howitworks: "",
    thetraditions: "",
    timer: "",
    closingreading: "",
  });

  const [milestones, setMilestones] = useState([
    { id: crypto.randomUUID(), screenName: "", time: "" },
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function updateServiceField(field, value) {
    setServicePeople((prev) => ({ ...prev, [field]: value }));
  }

  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      { id: crypto.randomUUID(), screenName: "", time: "" },
    ]);
  }

  function updateMilestone(id, field, value) {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setMilestones((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  const milestoneCount = useMemo(() => milestones.length, [milestones]);

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-w-screen">
      <section className="relative border-b-8 border-amber-200 bg-amber-100 shadow-sm dark:border-amber-700 dark:bg-amber-950/40">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:gap-6 md:text-left pt-5">
            <div className="text-slate-900 dark:text-amber-100">
              <BurgerIcon />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                Host-burger Helper
              </h1>
              <p className="mt-2 text-base text-slate-600 dark:text-slate-300 md:text-lg">
                Quick meeting helper for service roles and milestones.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">People Doing Service</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Fill in tonight’s service commitments.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <ServiceField
                label="Cohost"
                value={servicePeople.cohost}
                onChange={(e) => updateServiceField("cohost", e.target.value)}
              />
              <ServiceField
                label="How It Works"
                value={servicePeople.howitworks}
                onChange={(e) => updateServiceField("howitworks", e.target.value)}
              />
              <ServiceField
                label="The 12 Traditions"
                value={servicePeople.thetraditions}
                onChange={(e) => updateServiceField("thetraditions", e.target.value)}
              />
              <ServiceField
                label="Timer"
                value={servicePeople.timer}
                onChange={(e) => updateServiceField("timer", e.target.value)}
              />
              <ServiceField
                label="Closing Reading"
                value={servicePeople.closingreading}
                onChange={(e) => updateServiceField("closingreading", e.target.value)}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">People Celebrating Milestones</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {milestoneCount} milestone{milestoneCount === 1 ? "" : "s"} listed
                </p>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={milestones.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {milestones.map((milestone) => (
                    <MilestoneItem
                      key={milestone.id}
                      milestone={milestone}
                      onChange={updateMilestone}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={addMilestone}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500"
            >
              <Plus className="h-5 w-5" />
              Add Milestone
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}