import { useState, useRef, useEffect } from "react";

const GOALS = { calories: 2600, protein: 190, carbs: 280, fat: 70 };
const USER = { name: "Jean", weight: 205, targetWeight: 202 };

// ⚠️ Replace with your real Anthropic API key from console.anthropic.com
const ANTHROPIC_API_KEY = "";

const SYSTEM_PROMPT = `You are an elite personal fitness coach and nutritionist for ${USER.name}, a 26-year-old who weighs ${USER.weight} lbs and wants to get lean at ${USER.targetWeight} lbs of muscle. 

Daily targets: ${GOALS.calories} calories, ${GOALS.protein}g protein, ${GOALS.carbs}g carbs, ${GOALS.fat}g fat.

Your style: Direct, knowledgeable, motivating but real. No fluff. Give specific, actionable advice. When asked about food, give exact portions and macros. When asked about training, give specific sets/reps/exercises. Keep responses concise and punchy unless a detailed breakdown is needed.

You know ${USER.name}'s meal plan includes eggs, chicken, Greek yogurt, whey protein, sweet potatoes, rice, ground beef, salmon, and cottage cheese. Their training goal is to cut 3 lbs while building/maintaining muscle with 4-5 days lifting + cardio.`;

const QUICK_FOODS = [
  { name: "Chicken Breast 8oz", cal: 370, protein: 70, carbs: 0, fat: 8 },
  { name: "Whey Shake", cal: 130, protein: 28, carbs: 5, fat: 2 },
  { name: "5 Eggs", cal: 350, protein: 30, carbs: 2, fat: 24 },
  { name: "Greek Yogurt 1 cup", cal: 130, protein: 22, carbs: 9, fat: 0 },
  { name: "Sweet Potato med", cal: 130, protein: 2, carbs: 30, fat: 0 },
  { name: "White Rice 1 cup", cal: 200, protein: 4, carbs: 44, fat: 0 },
  { name: "Salmon 6oz", cal: 350, protein: 40, carbs: 0, fat: 20 },
  { name: "Ground Beef 90/10 8oz", cal: 400, protein: 56, carbs: 0, fat: 18 },
  { name: "Cottage Cheese 1 cup", cal: 200, protein: 28, carbs: 8, fat: 4 },
  { name: "Banana", cal: 105, protein: 1, carbs: 27, fat: 0 },
];

const todayKey = () => new Date().toISOString().split("T")[0];

const getPastDays = (n) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  });

const sumMeals = (meals) =>
  meals.reduce((acc, m) => ({
    cal: acc.cal + (m.cal || 0),
    protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),
    fat: acc.fat + (m.fat || 0),
  }), { cal: 0, protein: 0, carbs: 0, fat: 0 });

const MacroBar = ({ label, current, goal, color }) => {
  const pct = Math.min((current / goal) * 100, 100);
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: current >= goal ? color : "#ccc" }}>
          {Math.round(current)}<span style={{ color: "#555" }}>/{goal}{label.includes("Cal") ? "" : "g"}</span>
        </span>
      </div>
      <div style={{ height: "5px", background: "#1a1a1a", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: "3px", transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `0 0 8px ${color}55`
        }} />
      </div>
    </div>
  );
};

const StatCard = ({ label, value, unit, sub, color = "#4ade80" }) => (
  <div style={{ background: "#0f0f0f", borderRadius: "12px", padding: "14px 16px", border: "1px solid #1e1e1e" }}>
    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>{label}</div>
    <div style={{ fontSize: "26px", fontFamily: "'Bebas Neue', sans-serif", color, lineHeight: 1 }}>
      {Math.round(value)}<span style={{ fontSize: "14px", marginLeft: "2px", color: "#555" }}>{unit}</span>
    </div>
    {sub && <div style={{ fontSize: "10px", color: "#444", marginTop: "4px", fontFamily: "'Space Mono', monospace" }}>{sub}</div>}
  </div>
);

export default function FitnessApp() {
  const [allMeals, setAllMeals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fitframe_meals") || "{}"); } catch { return {}; }
  });
  const [tab, setTab] = useState("dashboard");
  const [statsRange, setStatsRange] = useState("week");
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Let's get it, ${USER.name}. 💪 You're 3 lbs away from your goal. Ask me anything — meals, training, supplements, recovery. I'm here all day.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [customFood, setCustomFood] = useState({ name: "", cal: "", protein: "", carbs: "", fat: "" });
  const [showCustom, setShowCustom] = useState(false);
  const chatEndRef = useRef(null);

  const todayMeals = allMeals[todayKey()] || [];
  const totals = sumMeals(todayMeals);

  useEffect(() => {
    try { localStorage.setItem("fitframe_meals", JSON.stringify(allMeals)); } catch {}
  }, [allMeals]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Stats
  const days = statsRange === "week" ? 7 : 30;
  const pastKeys = getPastDays(days);
  const activeDays = pastKeys.filter(k => allMeals[k]?.length > 0);
  const periodMeals = pastKeys.flatMap(k => allMeals[k] || []);
  const periodTotals = sumMeals(periodMeals);
  const avgDays = activeDays.length || 1;
  const periodAvg = {
    cal: periodTotals.cal / avgDays,
    protein: periodTotals.protein / avgDays,
    carbs: periodTotals.carbs / avgDays,
    fat: periodTotals.fat / avgDays,
  };
  const pctColor = (val, goal) => val >= goal ? "#4ade80" : val >= goal * 0.75 ? "#f59e0b" : "#ef4444";

  const addFood = (food) => {
    const key = todayKey();
    const meal = { ...food, id: Date.now(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setAllMeals(prev => ({ ...prev, [key]: [...(prev[key] || []), meal] }));
  };

  const removeFood = (id) => {
    const key = todayKey();
    setAllMeals(prev => ({ ...prev, [key]: (prev[key] || []).filter(m => m.id !== id) }));
  };

  const addCustomFood = () => {
    if (!customFood.name || !customFood.cal) return;
    addFood({
      name: customFood.name,
      cal: parseInt(customFood.cal) || 0,
      protein: parseInt(customFood.protein) || 0,
      carbs: parseInt(customFood.carbs) || 0,
      fat: parseInt(customFood.fat) || 0,
    });
    setCustomFood({ name: "", cal: "", protein: "", carbs: "", fat: "" });
    setShowCustom(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    const mealContext = todayMeals.length > 0
      ? `\n\nToday's meals: ${todayMeals.map(m => m.name).join(", ")}. Totals: ${totals.cal} cal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat.`
      : "\n\nNo meals logged yet today.";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT + mealContext,
          messages: messages.filter(m => m.role !== "system")
            .concat({ role: "user", content: userMsg })
            .map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "Something went wrong.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection issue. Try again." }]);
    }
    setLoading(false);
  };

  const inputStyle = {
    background: "#111", border: "1px solid #2a2a2a", borderRadius: "8px",
    color: "#fff", padding: "8px 12px", fontSize: "13px",
    fontFamily: "'Space Mono', monospace", outline: "none", width: "100%", boxSizing: "border-box"
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#fff",
      fontFamily: "'DM Sans', sans-serif",
      backgroundImage: "radial-gradient(ellipse at 20% 0%, #0f1f0f 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #1a0f00 0%, transparent 60%)"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#111} ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
        *{box-sizing:border-box} textarea:focus,input:focus{border-color:#4ade80!important}
        .tab-btn,.range-btn{transition:all 0.2s}
        .food-chip{transition:all 0.15s;cursor:pointer}
        .food-chip:hover{background:#1f3a1f!important;border-color:#4ade80!important;transform:translateY(-1px)}
        .remove-btn:hover{color:#ff4444!important}
        .send-btn:hover{background:#22c55e!important} .send-btn:disabled{opacity:0.4;cursor:not-allowed}
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", maxWidth: "480px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#4ade80", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px" }}>Your Coach</div>
            <div style={{ fontSize: "38px", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", lineHeight: 1 }}>FITFRAME</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "#555", fontFamily: "'Space Mono', monospace" }}>GOAL</div>
            <div style={{ fontSize: "20px", fontWeight: "600", color: "#4ade80" }}>{USER.targetWeight} lbs</div>
            <div style={{ fontSize: "11px", color: "#555", fontFamily: "'Space Mono', monospace" }}>from {USER.weight}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#111", padding: "4px", borderRadius: "12px", marginBottom: "20px" }}>
          {[["dashboard", "📊 Today"], ["log", "🍽 Log"], ["stats", "📈 Stats"], ["coach", "🤖 Coach"]].map(([key, label]) => (
            <button key={key} className="tab-btn" onClick={() => setTab(key)} style={{
              flex: 1, padding: "10px 2px", border: "none", borderRadius: "9px", cursor: "pointer",
              fontSize: "11px", fontWeight: "600", fontFamily: "'DM Sans', sans-serif",
              background: tab === key ? "#4ade80" : "transparent",
              color: tab === key ? "#000" : "#555",
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "0 20px 100px" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            <div style={{ background: "#111", borderRadius: "16px", padding: "20px", marginBottom: "16px", border: "1px solid #1e1e1e" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Today's Calories</div>
                  <div style={{ fontSize: "48px", fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1, color: totals.cal >= GOALS.calories ? "#4ade80" : "#fff" }}>{totals.cal}</div>
                  <div style={{ fontSize: "13px", color: "#555" }}>of {GOALS.calories} · <span style={{ color: totals.cal >= GOALS.calories ? "#4ade80" : "#f59e0b" }}>{GOALS.calories - totals.cal > 0 ? `${GOALS.calories - totals.cal} remaining` : "Goal hit! ✓"}</span></div>
                </div>
                <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: `conic-gradient(#4ade80 ${Math.min(totals.cal / GOALS.calories * 360, 360)}deg, #1a1a1a 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px #4ade8022" }}>
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#4ade80" }}>{Math.round(totals.cal / GOALS.calories * 100)}%</div>
                </div>
              </div>
              <MacroBar label="Protein" current={totals.protein} goal={GOALS.protein} color="#4ade80" />
              <MacroBar label="Carbs" current={totals.carbs} goal={GOALS.carbs} color="#60a5fa" />
              <MacroBar label="Fat" current={totals.fat} goal={GOALS.fat} color="#f59e0b" />
            </div>
            <div style={{ background: "#111", borderRadius: "16px", padding: "20px", border: "1px solid #1e1e1e" }}>
              <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>Meals Today</div>
              {todayMeals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#333", fontSize: "13px" }}>No meals logged yet.<br /><span style={{ color: "#4ade80", cursor: "pointer" }} onClick={() => setTab("log")}>Log your first meal →</span></div>
              ) : (
                todayMeals.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600" }}>{m.name}</div>
                      <div style={{ fontSize: "11px", color: "#555", fontFamily: "'Space Mono', monospace" }}>{m.time} · {m.protein}g pro · {m.carbs}g carbs · {m.fat}g fat</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#4ade80", fontFamily: "'Space Mono', monospace" }}>{m.cal}</div>
                      <button className="remove-btn" onClick={() => removeFood(m.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "16px", padding: "0" }}>×</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* LOG */}
        {tab === "log" && (
          <div>
            <div style={{ background: "#111", borderRadius: "16px", padding: "20px", border: "1px solid #1e1e1e", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>Quick Add</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {QUICK_FOODS.map(food => (
                  <div key={food.name} className="food-chip" onClick={() => addFood(food)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: "10px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600" }}>{food.name}</div>
                      <div style={{ fontSize: "11px", color: "#555", fontFamily: "'Space Mono', monospace" }}>{food.protein}g pro · {food.carbs}g carbs · {food.fat}g fat</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#4ade80", fontFamily: "'Space Mono', monospace", fontWeight: "700" }}>{food.cal}</span>
                      <span style={{ fontSize: "18px", color: "#333" }}>+</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#111", borderRadius: "16px", padding: "20px", border: "1px solid #1e1e1e" }}>
              <button onClick={() => setShowCustom(!showCustom)} style={{ width: "100%", padding: "12px", background: "none", border: "1px dashed #2a2a2a", borderRadius: "10px", color: "#555", cursor: "pointer", fontSize: "13px", fontFamily: "'Space Mono', monospace" }}>{showCustom ? "− Cancel" : "+ Add Custom Food"}</button>
              {showCustom && (
                <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input placeholder="Food name" value={customFood.name} onChange={e => setCustomFood(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <input placeholder="Calories" type="number" value={customFood.cal} onChange={e => setCustomFood(p => ({ ...p, cal: e.target.value }))} style={inputStyle} />
                    <input placeholder="Protein (g)" type="number" value={customFood.protein} onChange={e => setCustomFood(p => ({ ...p, protein: e.target.value }))} style={inputStyle} />
                    <input placeholder="Carbs (g)" type="number" value={customFood.carbs} onChange={e => setCustomFood(p => ({ ...p, carbs: e.target.value }))} style={inputStyle} />
                    <input placeholder="Fat (g)" type="number" value={customFood.fat} onChange={e => setCustomFood(p => ({ ...p, fat: e.target.value }))} style={inputStyle} />
                  </div>
                  <button onClick={addCustomFood} style={{ padding: "12px", background: "#4ade80", border: "none", borderRadius: "10px", color: "#000", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}>Add Food</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATS */}
        {tab === "stats" && (
          <div>
            <div style={{ display: "flex", gap: "4px", background: "#111", padding: "4px", borderRadius: "12px", marginBottom: "16px" }}>
              {[["week", "Last 7 Days"], ["month", "Last 30 Days"]].map(([key, label]) => (
                <button key={key} className="range-btn" onClick={() => setStatsRange(key)} style={{
                  flex: 1, padding: "10px", border: "none", borderRadius: "9px", cursor: "pointer",
                  fontSize: "12px", fontWeight: "600", fontFamily: "'DM Sans', sans-serif",
                  background: statsRange === key ? "#4ade80" : "transparent",
                  color: statsRange === key ? "#000" : "#555",
                }}>{label}</button>
              ))}
            </div>

            {activeDays.length === 0 ? (
              <div style={{ background: "#111", borderRadius: "16px", padding: "40px 20px", border: "1px solid #1e1e1e", textAlign: "center", color: "#444", fontSize: "13px" }}>
                No data yet for this period.<br />Start logging meals to see your stats here.
              </div>
            ) : (
              <>
                {/* Totals */}
                <div style={{ background: "#111", borderRadius: "16px", padding: "20px", border: "1px solid #1e1e1e", marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>
                    {statsRange === "week" ? "7-Day" : "30-Day"} Totals · <span style={{ color: "#4ade80" }}>{activeDays.length} days logged</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <StatCard label="Total Calories" value={periodTotals.cal} unit=" kcal" color="#fff" />
                    <StatCard label="Total Protein" value={periodTotals.protein} unit="g" color="#4ade80" />
                    <StatCard label="Total Carbs" value={periodTotals.carbs} unit="g" color="#60a5fa" />
                    <StatCard label="Total Fat" value={periodTotals.fat} unit="g" color="#f59e0b" />
                  </div>
                </div>

                {/* Daily Averages */}
                <div style={{ background: "#111", borderRadius: "16px", padding: "20px", border: "1px solid #1e1e1e", marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>Daily Averages <span style={{ color: "#333" }}>(logged days only)</span></div>
                  <MacroBar label="Avg Calories" current={periodAvg.cal} goal={GOALS.calories} color={pctColor(periodAvg.cal, GOALS.calories)} />
                  <MacroBar label="Avg Protein" current={periodAvg.protein} goal={GOALS.protein} color={pctColor(periodAvg.protein, GOALS.protein)} />
                  <MacroBar label="Avg Carbs" current={periodAvg.carbs} goal={GOALS.carbs} color={pctColor(periodAvg.carbs, GOALS.carbs)} />
                  <MacroBar label="Avg Fat" current={periodAvg.fat} goal={GOALS.fat} color={pctColor(periodAvg.fat, GOALS.fat)} />
                  <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <StatCard label="Avg Cal / Day" value={periodAvg.cal} unit="" sub={`Goal: ${GOALS.calories}`} color={pctColor(periodAvg.cal, GOALS.calories)} />
                    <StatCard label="Avg Protein / Day" value={periodAvg.protein} unit="g" sub={`Goal: ${GOALS.protein}g`} color={pctColor(periodAvg.protein, GOALS.protein)} />
                    <StatCard label="Avg Carbs / Day" value={periodAvg.carbs} unit="g" sub={`Goal: ${GOALS.carbs}g`} color={pctColor(periodAvg.carbs, GOALS.carbs)} />
                    <StatCard label="Avg Fat / Day" value={periodAvg.fat} unit="g" sub={`Goal: ${GOALS.fat}g`} color={pctColor(periodAvg.fat, GOALS.fat)} />
                  </div>
                </div>

                {/* Day-by-day breakdown */}
                <div style={{ background: "#111", borderRadius: "16px", padding: "20px", border: "1px solid #1e1e1e" }}>
                  <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>Day by Day</div>
                  {getPastDays(days).filter(k => allMeals[k]?.length > 0).map(k => {
                    const dt = sumMeals(allMeals[k]);
                    const label = k === todayKey() ? "Today" : new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return (
                      <div key={k} style={{ padding: "12px 0", borderBottom: "1px solid #1a1a1a" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600" }}>{label}</span>
                          <span style={{ fontSize: "12px", fontFamily: "'Space Mono', monospace", color: pctColor(dt.cal, GOALS.calories) }}>{dt.cal} kcal</span>
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                          {[["P", dt.protein, "#4ade80"], ["C", dt.carbs, "#60a5fa"], ["F", dt.fat, "#f59e0b"]].map(([l, v, c]) => (
                            <span key={l} style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#555" }}>
                              <span style={{ color: c }}>{l}</span> {Math.round(v)}g
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* COACH */}
        {tab === "coach" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
            <div style={{ flex: 1, overflowY: "auto", background: "#111", borderRadius: "16px", padding: "16px", border: "1px solid #1e1e1e", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "assistant" && (
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", marginRight: "8px", flexShrink: 0, marginTop: "2px" }}>💪</div>
                  )}
                  <div style={{ maxWidth: "80%", padding: "12px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "#4ade80" : "#1a1a1a", color: m.role === "user" ? "#000" : "#ddd", fontSize: "13px", lineHeight: "1.55", fontWeight: m.role === "user" ? "600" : "400", whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>💪</div>
                  <div style={{ background: "#1a1a1a", padding: "12px 16px", borderRadius: "16px 16px 16px 4px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "bounce 1.2s infinite", animationDelay: `${i*0.2}s` }} />)}
                    </div>
                  </div>
                  <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "10px", paddingBottom: "2px" }}>
              {["What should I eat post-workout?", "Am I hitting my protein?", "Best exercises for cutting?", "How's my week looking?"].map(p => (
                <button key={p} onClick={() => setInput(p)} style={{ padding: "7px 12px", background: "#111", border: "1px solid #2a2a2a", borderRadius: "20px", color: "#888", cursor: "pointer", fontSize: "11px", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>{p}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Ask your coach anything..." rows={1} style={{ ...inputStyle, flex: 1, resize: "none", padding: "12px 14px", lineHeight: "1.4", borderRadius: "12px" }} />
              <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()} style={{ padding: "12px 18px", background: "#4ade80", border: "none", borderRadius: "12px", color: "#000", fontWeight: "700", cursor: "pointer", fontSize: "16px", transition: "all 0.2s" }}>→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
