import { CabinetTopbar } from "@/components/cabinet";
import { RoutineWorkspace } from "@/components/routine";
import { requireOwnerEmail } from "@/lib/auth-guards";
import { listRoutineShiftsForOwner } from "@/lib/routine";
import {
  getRoutineDateKeyWithOffset,
  getRoutineTodayKey,
} from "@/lib/routine-shared";

export default async function RoutinePage() {
  const ownerEmail = await requireOwnerEmail();
  const todayKey = getRoutineTodayKey();
  const shifts = await listRoutineShiftsForOwner({
    ownerEmail,
    fromDate: getRoutineDateKeyWithOffset(-7),
    toDate: getRoutineDateKeyWithOffset(45),
  });

  return (
    <>
      <CabinetTopbar
        eyebrow="Routine"
        title="Ритм і рутина"
        description="Адаптивний графік під твої зміни: зберігаємо робочі дні, автоматично збираємо план дня і готуємо основу для Telegram-нагадувань."
      />

      <RoutineWorkspace initialShifts={shifts} todayKey={todayKey} />
    </>
  );
}
