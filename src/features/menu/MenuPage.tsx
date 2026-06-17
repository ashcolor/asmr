import { useNavigate } from "react-router-dom";
import { sceneDefs } from "../../constants/sceneDefs";

// シーン選択メニュー（旧 #menu）。カードをクリックすると該当シーンの URL へ遷移する。
export default function MenuPage() {
  const navigate = useNavigate();

  return (
    <nav
      id="menu"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-base-100 text-base-content transition-opacity duration-500"
    >
      <h1 className="text-[clamp(2rem,8vw,3.5rem)] font-light tracking-[0.15em]">ASMR Toys</h1>
      <p className="mb-6 text-sm tracking-[0.1em] text-base-content/80">触って、聴いて、ほぐれる</p>
      <ul
        id="scene-list"
        className="grid w-[min(90%,560px)] list-none grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3"
      >
        {sceneDefs.map((d) => (
          <li
            key={d.name}
            className={
              "card cursor-pointer select-none rounded-box border border-base-300 bg-base-200 px-4 py-5 text-center text-base-content shadow-sm transition hover:-translate-y-1 hover:border-primary hover:bg-primary hover:text-primary-content" +
              (d.enabled ? "" : " pointer-events-none bg-base-300 text-base-content/50")
            }
            onClick={d.enabled ? () => navigate(`/${d.name}`) : undefined}
          >
            <span className="mb-1 block text-3xl">{d.emoji}</span>
            <span className="text-sm tracking-[0.05em]">{d.label}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
