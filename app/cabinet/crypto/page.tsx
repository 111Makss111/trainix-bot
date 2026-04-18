import { CabinetTopbar } from "@/components/cabinet";
import { CryptoWorkspace } from "@/components/crypto";

export default function CryptoPage() {
  return (
    <>
      <CabinetTopbar
        eyebrow="Markets / Crypto"
        title="Crypto Desk"
        description="Живий графік у стилі TradingView light: свічки, великі виконані угоди, сильні стінки в стакані й швидкий індикатор того, чи актив зараз реально зацікавив ринок."
      />

      <CryptoWorkspace />
    </>
  );
}
