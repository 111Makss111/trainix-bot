"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deleteRoutineShiftAction,
  saveRoutineShiftAction,
} from "@/app/cabinet/routine/actions";
import {
  buildRoutinePlan,
  getRoutinePreset,
  routineShiftKinds,
  routineShiftMeta,
  type RoutinePlanEventTone,
  type RoutineShift,
  type RoutineShiftDraft,
  type RoutineShiftKind,
} from "@/lib/routine-shared";

type RoutineWorkspaceProps = {
  initialShifts: RoutineShift[];
  todayKey: string;
};

const eventToneClass: Record<RoutinePlanEventTone, string> = {
  prepare: "border-sky-300/16 bg-sky-300/[0.08] text-sky-50",
  work: "border-white/10 bg-white/[0.04] text-white/72",
  training: "border-lime-300/18 bg-lime-300/[0.1] text-lime-50",
  food: "border-amber-300/16 bg-amber-300/[0.08] text-amber-50",
  focus: "border-violet-300/16 bg-violet-300/[0.08] text-violet-50",
  rest: "border-cyan-300/16 bg-cyan-300/[0.08] text-cyan-50",
};

function addDays(dateKey: string, offset: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + offset);

  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function formatFullDate(dateKey: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function draftFromShift(shift: RoutineShift): RoutineShiftDraft {
  return {
    shiftDate: shift.shiftDate,
    shiftKind: shift.shiftKind,
    workStart: shift.workStart,
    workEnd: shift.workEnd,
    leaveAt: shift.leaveAt,
    returnAt: shift.returnAt,
    notes: shift.notes ?? "",
  };
}

function draftForDate(
  dateKey: string,
  shifts: RoutineShift[],
  fallbackKind: RoutineShiftKind = "morning",
) {
  const shift = shifts.find((item) => item.shiftDate === dateKey);

  if (shift) {
    return draftFromShift(shift);
  }

  return {
    ...getRoutinePreset(fallbackKind),
    shiftDate: dateKey,
  };
}

function draftToPreviewShift(draft: RoutineShiftDraft): RoutineShift {
  return {
    id: "preview",
    ownerEmail: "",
    shiftDate: draft.shiftDate,
    shiftKind: draft.shiftKind,
    workStart: draft.workStart,
    workEnd: draft.workEnd,
    leaveAt: draft.leaveAt,
    returnAt: draft.returnAt,
    notes: draft.notes || null,
    createdAt: "",
    updatedAt: "",
  };
}

function upsertShift(shifts: RoutineShift[], nextShift: RoutineShift) {
  return [nextShift, ...shifts.filter((shift) => shift.id !== nextShift.id)]
    .sort((left, right) => left.shiftDate.localeCompare(right.shiftDate));
}

export function RoutineWorkspace({
  initialShifts,
  todayKey,
}: RoutineWorkspaceProps) {
  const [shifts, setShifts] = useState(initialShifts);
  const [draft, setDraft] = useState(() => draftForDate(todayKey, initialShifts));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.shiftDate === draft.shiftDate) ?? null,
    [draft.shiftDate, shifts],
  );
  const todayShift = useMemo(
    () => shifts.find((shift) => shift.shiftDate === todayKey) ?? null,
    [shifts, todayKey],
  );
  const upcomingShifts = useMemo(
    () =>
      shifts
        .filter((shift) => shift.shiftDate >= todayKey)
        .sort((left, right) => left.shiftDate.localeCompare(right.shiftDate))
        .slice(0, 14),
    [shifts, todayKey],
  );
  const nextShift = upcomingShifts.find((shift) => shift.shiftDate > todayKey) ?? null;
  const selectedPlan = useMemo(
    () => buildRoutinePlan(selectedShift ?? draftToPreviewShift(draft)),
    [draft, selectedShift],
  );
  const todayPlan = useMemo(() => buildRoutinePlan(todayShift), [todayShift]);
  const weekDates = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(todayKey, index)),
    [todayKey],
  );

  function selectDate(dateKey: string) {
    setFeedback(null);
    setDraft(draftForDate(dateKey, shifts, draft.shiftKind));
  }

  function applyShiftKind(kind: RoutineShiftKind) {
    const preset = getRoutinePreset(kind);

    setDraft((current) => ({
      ...current,
      shiftKind: kind,
      workStart: preset.workStart,
      workEnd: preset.workEnd,
      leaveAt: preset.leaveAt,
      returnAt: preset.returnAt,
    }));
  }

  function saveShift() {
    setFeedback(null);

    startSaving(async () => {
      const result = await saveRoutineShiftAction(draft);

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      if (!("shift" in result)) {
        setFeedback("Не вдалося отримати збережену зміну.");
        return;
      }

      setShifts((current) => upsertShift(current, result.shift));
      setDraft(draftFromShift(result.shift));
      setFeedback("Зміну збережено. План дня оновився.");
    });
  }

  function deleteSelectedShift() {
    if (!selectedShift) {
      return;
    }

    setFeedback(null);

    startDeleting(async () => {
      const result = await deleteRoutineShiftAction({ shiftId: selectedShift.id });

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      if (!("shiftId" in result)) {
        setFeedback("Не вдалося підтвердити видалення зміни.");
        return;
      }

      setShifts((current) =>
        current.filter((shift) => shift.id !== result.shiftId),
      );
      setDraft(draftForDate(draft.shiftDate, [], draft.shiftKind));
      setFeedback("Зміну видалено з графіка.");
    });
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/38">
                Today rhythm
              </p>
              <h2 className="mt-3 text-2xl font-medium text-white">
                {formatFullDate(todayKey)}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
                {todayShift
                  ? `${routineShiftMeta[todayShift.shiftKind].label}: робота ${todayShift.workStart ?? "-"}-${todayShift.workEnd ?? "-"}, вдома орієнтовно ${todayShift.returnAt ?? "-"}`
                  : "На сьогодні зміна ще не задана, тому показую м'який план вихідного дня."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => selectDate(todayKey)}
              className="rounded-full border border-lime-300/18 bg-lime-300/[0.1] px-4 py-2 text-sm font-medium text-lime-50 transition hover:bg-lime-300/[0.16]"
            >
              Налаштувати сьогодні
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {todayPlan.map((item) => (
              <div
                key={item.id}
                className={[
                  "rounded-[1.35rem] border p-4",
                  eventToneClass[item.tone],
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold">{item.time}</span>
                  <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.22em] text-white/52">
                    {item.tone}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-[#08111e]/78 p-5">
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/38">
            Next checkpoint
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">
            {nextShift ? routineShiftMeta[nextShift.shiftKind].label : "Поки немає"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/58">
            {nextShift
              ? `${formatFullDate(nextShift.shiftDate)}. Вихід з дому ${nextShift.leaveAt ?? "-"}, повернення ${nextShift.returnAt ?? "-"}.`
              : "Додай зміни на найближчі дні, і тут з'явиться наступна контрольна точка."}
          </p>

          <div className="mt-5 rounded-[1.4rem] border border-cyan-300/14 bg-cyan-300/[0.07] p-4">
            <p className="text-sm font-semibold text-cyan-50">
              Telegram-ready
            </p>
            <p className="mt-2 text-sm leading-6 text-white/56">
              План уже генерується структуровано. Наступним кроком можна буде
              підключити повідомлення: за 25 хв до виходу, після повернення і
              перед тренуванням.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/38">
                Shift planner
              </p>
              <h2 className="mt-3 text-2xl font-medium text-white">
                Зміна на {formatDateLabel(draft.shiftDate)}
              </h2>
            </div>
            {selectedShift ? (
              <span className="rounded-full border border-emerald-300/18 bg-emerald-300/[0.1] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-emerald-50">
                Saved
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-white/46">
                Draft
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {weekDates.map((dateKey) => {
              const shift = shifts.find((item) => item.shiftDate === dateKey);
              const active = draft.shiftDate === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => selectDate(dateKey)}
                  className={[
                    "rounded-[1.15rem] border px-3 py-3 text-left transition",
                    active
                      ? "border-lime-300/20 bg-lime-300/[0.12] text-white"
                      : "border-white/10 bg-[#091327] text-white/58 hover:border-white/16 hover:text-white/88",
                  ].join(" ")}
                >
                  <span className="block text-xs uppercase tracking-[0.18em] text-white/38">
                    {formatDateLabel(dateKey)}
                  </span>
                  <span className="mt-2 block text-sm font-medium">
                    {shift ? routineShiftMeta[shift.shiftKind].label : "Порожньо"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                Дата
              </span>
              <input
                type="date"
                value={draft.shiftDate}
                onChange={(event) => selectDate(event.target.value)}
                className="w-full rounded-[1.1rem] border border-white/10 bg-[#091327] px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                Тип зміни
              </span>
              <select
                value={draft.shiftKind}
                onChange={(event) =>
                  applyShiftKind(event.target.value as RoutineShiftKind)
                }
                className="w-full rounded-[1.1rem] border border-white/10 bg-[#091327] px-4 py-3 text-sm text-white outline-none"
              >
                {routineShiftKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {routineShiftMeta[kind].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/44">
            {routineShiftMeta[draft.shiftKind].description}
          </p>

          {draft.shiftKind !== "day_off" ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["workStart", "Початок роботи"],
                ["workEnd", "Кінець роботи"],
                ["leaveAt", "Вийти з дому"],
                ["returnAt", "Повернення додому"],
              ].map(([field, label]) => (
                <label key={field} className="space-y-2">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                    {label}
                  </span>
                  <input
                    type="time"
                    value={(draft[field as keyof RoutineShiftDraft] as string | null) ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [field]: event.target.value || null,
                      }))
                    }
                    className="w-full rounded-[1.1rem] border border-white/10 bg-[#091327] px-4 py-3 text-sm text-white outline-none"
                  />
                </label>
              ))}
            </div>
          ) : null}

          <label className="mt-5 block space-y-2">
            <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
              Нотатка до дня
            </span>
            <textarea
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={4}
              placeholder="Наприклад: після роботи не планувати важке тренування, бо зміна фізично складна."
              className="w-full resize-none rounded-[1.2rem] border border-white/10 bg-[#091327] px-4 py-4 text-sm leading-7 text-white outline-none"
            />
          </label>

          {feedback ? (
            <div className="mt-4 rounded-[1.1rem] border border-amber-300/14 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-50/90">
              {feedback}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={saveShift}
              className="rounded-full border border-lime-300/18 bg-lime-300/[0.12] px-5 py-3 text-sm font-medium text-lime-50 transition hover:bg-lime-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Зберігаю..." : "Зберегти зміну"}
            </button>
            {selectedShift ? (
              <button
                type="button"
                disabled={isDeleting}
                onClick={deleteSelectedShift}
                className="rounded-full border border-red-300/16 bg-red-300/[0.08] px-5 py-3 text-sm font-medium text-red-50 transition hover:bg-red-300/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Видаляю..." : "Видалити зміну"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#08111e]/78 p-5">
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/38">
            Generated plan
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">
            План на {formatDateLabel(draft.shiftDate)}
          </h2>

          <div className="mt-5 space-y-3">
            {selectedPlan.map((item) => (
              <div
                key={item.id}
                className={[
                  "rounded-[1.35rem] border p-4",
                  eventToneClass[item.tone],
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xl font-semibold">{item.time}</span>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {draft.notes ? (
            <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                Твоя нотатка
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/62">
                {draft.notes}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/38">
              Month map
            </p>
            <h2 className="mt-3 text-2xl font-medium text-white">
              Найближчі збережені зміни
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/46">
            {upcomingShifts.length} saved
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {upcomingShifts.length ? (
            upcomingShifts.map((shift) => (
              <button
                key={shift.id}
                type="button"
                onClick={() => selectDate(shift.shiftDate)}
                className="rounded-[1.35rem] border border-white/10 bg-[#091327] p-4 text-left transition hover:border-lime-300/20 hover:bg-lime-300/[0.08]"
              >
                <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                  {formatDateLabel(shift.shiftDate)}
                </span>
                <span className="mt-3 block text-lg font-medium text-white">
                  {routineShiftMeta[shift.shiftKind].label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-white/50">
                  {shift.shiftKind === "day_off"
                    ? "День без роботи"
                    : `${shift.workStart ?? "-"}-${shift.workEnd ?? "-"} / вдома ${shift.returnAt ?? "-"}`}
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-[#091327] px-5 py-10 text-sm leading-7 text-white/42 md:col-span-2 xl:col-span-4">
              Поки немає збережених змін. Додай хоча б сьогоднішній день, і ми
              почнемо будувати стабільний графік навколо твоєї роботи.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
