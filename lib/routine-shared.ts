export const routineShiftKinds = [
  "morning",
  "day",
  "evening",
  "night",
  "day_off",
  "custom",
] as const;

export type RoutineShiftKind = (typeof routineShiftKinds)[number];

export type RoutineShift = {
  id: string;
  ownerEmail: string;
  shiftDate: string;
  shiftKind: RoutineShiftKind;
  workStart: string | null;
  workEnd: string | null;
  leaveAt: string | null;
  returnAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoutineShiftDraft = {
  shiftDate: string;
  shiftKind: RoutineShiftKind;
  workStart: string | null;
  workEnd: string | null;
  leaveAt: string | null;
  returnAt: string | null;
  notes: string;
};

export type RoutinePlanEventTone =
  | "prepare"
  | "work"
  | "training"
  | "food"
  | "focus"
  | "rest";

export type RoutinePlanEvent = {
  id: string;
  time: string;
  title: string;
  description: string;
  tone: RoutinePlanEventTone;
};

export const routineShiftMeta: Record<
  RoutineShiftKind,
  {
    label: string;
    description: string;
    defaultWorkStart: string | null;
    defaultWorkEnd: string | null;
    defaultLeaveAt: string | null;
    defaultReturnAt: string | null;
  }
> = {
  morning: {
    label: "Ранкова",
    description: "Робота зранку, тренування краще ставити після повернення.",
    defaultWorkStart: "06:00",
    defaultWorkEnd: "14:00",
    defaultLeaveAt: "05:20",
    defaultReturnAt: "14:50",
  },
  day: {
    label: "Денна",
    description: "Класичний робочий день з вечірнім фокусом або легким спортом.",
    defaultWorkStart: "08:00",
    defaultWorkEnd: "16:00",
    defaultLeaveAt: "07:20",
    defaultReturnAt: "16:50",
  },
  evening: {
    label: "Друга зміна",
    description: "Головні справи краще робити до роботи, після зміни тільки відновлення.",
    defaultWorkStart: "14:00",
    defaultWorkEnd: "22:00",
    defaultLeaveAt: "13:20",
    defaultReturnAt: "22:50",
  },
  night: {
    label: "Нічна",
    description: "Після нічної пріоритет на сон, їжу і дуже легку активність.",
    defaultWorkStart: "22:00",
    defaultWorkEnd: "06:00",
    defaultLeaveAt: "21:20",
    defaultReturnAt: "06:50",
  },
  day_off: {
    label: "Вихідний",
    description: "День без зміни: можна поставити тренування, навчання і глибокий фокус.",
    defaultWorkStart: null,
    defaultWorkEnd: null,
    defaultLeaveAt: null,
    defaultReturnAt: null,
  },
  custom: {
    label: "Своя зміна",
    description: "Для нестандартного графіка, коли час краще задати вручну.",
    defaultWorkStart: "09:00",
    defaultWorkEnd: "17:00",
    defaultLeaveAt: "08:20",
    defaultReturnAt: "17:50",
  },
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function parseClock(clock: string | null) {
  if (!clock) {
    return null;
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const dayOffset = Math.floor(totalMinutes / 1440);
  const suffix =
    dayOffset > 0 ? " +1д" : dayOffset < 0 ? " -1д" : "";

  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}${suffix}`;
}

function addMinutes(clock: string | null, minutes: number) {
  const parsed = parseClock(clock);

  if (parsed === null) {
    return null;
  }

  return formatClock(parsed + minutes);
}

function event(
  id: string,
  time: string,
  title: string,
  description: string,
  tone: RoutinePlanEventTone,
): RoutinePlanEvent {
  return {
    id,
    time,
    title,
    description,
    tone,
  };
}

export function isRoutineShiftKind(value: string): value is RoutineShiftKind {
  return routineShiftKinds.includes(value as RoutineShiftKind);
}

export function getRoutineTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getRoutineDateKeyWithOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  return getRoutineTodayKey(date);
}

export function getRoutinePreset(kind: RoutineShiftKind): RoutineShiftDraft {
  const meta = routineShiftMeta[kind];

  return {
    shiftDate: getRoutineTodayKey(),
    shiftKind: kind,
    workStart: meta.defaultWorkStart,
    workEnd: meta.defaultWorkEnd,
    leaveAt: meta.defaultLeaveAt,
    returnAt: meta.defaultReturnAt,
    notes: "",
  };
}

export function buildRoutinePlan(shift: RoutineShift | null): RoutinePlanEvent[] {
  if (!shift || shift.shiftKind === "day_off") {
    return [
      event(
        "slow-start",
        "09:30",
        "Спокійний старт дня",
        "Без ривка: вода, легка їжа, коротко подивитись план і вибрати 1 головну справу.",
        "prepare",
      ),
      event(
        "training",
        "11:00",
        "Тренування 35-45 хв",
        "Вихідний добре підходить для повноціннішого тренування без поспіху.",
        "training",
      ),
      event(
        "food",
        "12:30",
        "Їжа та відновлення",
        "Нормальний прийом їжі після тренування, без важкого переїдання.",
        "food",
      ),
      event(
        "focus",
        "15:00",
        "Фокус-блок 60-90 хв",
        "Розробка, навчання або важлива задача, яку краще не тягнути ввечері.",
        "focus",
      ),
      event(
        "rest",
        "22:30",
        "Підготовка до сну",
        "Закрити екрани, підготувати речі на завтра і не ламати режим.",
        "rest",
      ),
    ];
  }

  const plan: RoutinePlanEvent[] = [];
  const beforeLeave = addMinutes(shift.leaveAt, -25);
  const afterReturnTraining = addMinutes(shift.returnAt, 30);
  const afterReturnFood = addMinutes(shift.returnAt, 85);
  const afterReturnFocus = addMinutes(shift.returnAt, 140);

  if (beforeLeave && shift.leaveAt) {
    plan.push(
      event(
        "prepare",
        beforeLeave,
        "Підготовка до зміни",
        `Через 25 хв вихід з дому о ${shift.leaveAt}. Перевір їжу, воду, ключі та заряд.`,
        "prepare",
      ),
    );
  }

  if (shift.workStart) {
    plan.push(
      event(
        "work-start",
        shift.workStart,
        "Старт зміни",
        "Фокус на роботі. Головна задача зараз - пройти зміну без зайвого виснаження.",
        "work",
      ),
    );
  }

  if (shift.returnAt) {
    plan.push(
      event(
        "return-home",
        shift.returnAt,
        "Повернення додому",
        "Не розсипаємось одразу в хаос. 10 хв перепочити, вода, душ або легкий перекус.",
        "rest",
      ),
    );
  }

  if (afterReturnTraining) {
    plan.push(
      event(
        "training",
        afterReturnTraining,
        "Тренування 30 хв",
        "Коротке тренування без героїзму. Ціль - стабільність, а не рекорд після роботи.",
        "training",
      ),
    );
  }

  if (afterReturnFood) {
    plan.push(
      event(
        "food",
        afterReturnFood,
        "Їжа після тренування",
        "Легка білкова їжа або нормальна вечеря. Без важкого переїдання перед сном.",
        "food",
      ),
    );
  }

  if (shift.shiftKind !== "night" && afterReturnFocus) {
    plan.push(
      event(
        "focus",
        afterReturnFocus,
        "Фокус-блок 35-45 хв",
        "Один невеликий крок по розробці, Jobs або навчанню. Без нескінченного скролу.",
        "focus",
      ),
    );
  }

  if (shift.shiftKind === "night") {
    plan.push(
      event(
        "sleep",
        addMinutes(shift.returnAt, 60) ?? "08:00",
        "Сон після нічної",
        "Після нічної тренування не тиснемо. Пріоритет - сон і відновлення.",
        "rest",
      ),
    );
  } else {
    plan.push(
      event(
        "sleep",
        "22:30",
        "Підготовка до сну",
        "Закрити день, підготувати речі на завтра і не ламати завтрашній старт.",
        "rest",
      ),
    );
  }

  return plan;
}
