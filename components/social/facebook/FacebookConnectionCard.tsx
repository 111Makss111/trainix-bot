import { CabinetCard } from "@/components/cabinet";

export function FacebookConnectionCard() {
  return (
    <CabinetCard
      eyebrow="Facebook"
      title="Connection Zone"
      description="Тут наступним кроком підключимо Meta/Facebook доступ, page binding, статус токенів і перевірку прав саме для Facebook Page. Це залишиться окремим шаром і не буде змішуватись із логікою Instagram."
    />
  );
}
