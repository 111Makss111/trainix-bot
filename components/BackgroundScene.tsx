export function BackgroundScene() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#02030b]"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 18%, rgba(93, 108, 222, 0.22), transparent 30%), radial-gradient(circle at 84% 14%, rgba(124, 162, 255, 0.15), transparent 24%), linear-gradient(180deg, #010208 0%, #02030b 30%, #050816 65%, #02030b 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(circle at 40% 68%, rgba(44, 56, 122, 0.22), transparent 24%), radial-gradient(circle at 68% 58%, rgba(51, 73, 154, 0.18), transparent 18%)",
        }}
      />

      <div className="absolute inset-0 opacity-55 mix-blend-screen bg-[radial-gradient(circle_at_20%_16%,rgba(116,131,255,0.12),transparent_0_34%),radial-gradient(circle_at_74%_12%,rgba(128,182,255,0.08),transparent_0_24%),radial-gradient(circle_at_52%_82%,rgba(80,104,220,0.12),transparent_0_18%)]" />
      <div className="absolute -left-[22vw] bottom-[-40vh] h-[78vh] w-[78vh] rounded-full bg-[radial-gradient(circle,rgba(95,117,255,0.22),rgba(7,9,18,0)_68%)] blur-3xl" />
      <div className="absolute right-[-18vw] top-[-26vh] h-[60vh] w-[60vh] rounded-full bg-[radial-gradient(circle,rgba(93,142,255,0.14),rgba(7,9,18,0)_70%)] blur-3xl" />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(2, 3, 11, 0) 50%, rgba(2, 3, 11, 0.72) 100%), radial-gradient(circle at 68% 72%, rgba(107, 132, 255, 0.12), transparent 20%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, transparent 45%, rgba(1, 2, 8, 0.82) 100%)",
        }}
      />
    </div>
  );
}
