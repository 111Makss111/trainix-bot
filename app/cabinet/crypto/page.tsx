import { CabinetTopbar } from "@/components/cabinet";
import { CryptoWorkspace } from "@/components/crypto";

export default function CryptoPage() {
  return (
    <>
      <CabinetTopbar
        eyebrow="Markets / Crypto"
        title="Crypto Desk"
        description="Живий графік у стилі TradingView light: свічки, великі виконані угоди, сильні стінки в стакані, attention score і frozen weekly zones, які живуть увесь тиждень."
      />

      <CryptoWorkspace />
    </>
  );
}
