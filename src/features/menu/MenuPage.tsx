import { useNavigate } from "react-router-dom";
import { sceneDefs } from "../../constants/sceneDefs";

// シーン選択メニュー（旧 #menu）。カードをクリックすると該当シーンの URL へ遷移する。
export default function MenuPage() {
  const navigate = useNavigate();

  return (
    <nav id="menu">
      <h1 className="menu-title">ASMR Toys</h1>
      <p className="menu-sub">触って、聴いて、ほぐれる</p>
      <ul id="scene-list">
        {sceneDefs.map((d) => (
          <li
            key={d.name}
            className={"scene-card" + (d.enabled ? "" : " disabled")}
            onClick={d.enabled ? () => navigate(`/${d.name}`) : undefined}
          >
            <span className="emoji">{d.emoji}</span>
            <span className="label">{d.label}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
