"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export function PerformanceChart({ trend }: { trend: { name: string; Score: number; Communication: number }[] }) {
  return <ResponsiveContainer width="100%" height={232}><AreaChart data={trend} margin={{ left: -19, right: 13, top: 8, bottom: 4 }}><defs><linearGradient id="score-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8276fa" stopOpacity={0.35}/><stop offset="100%" stopColor="#8276fa" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false}/><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: "10px" }}/><Area type="monotone" dataKey="Score" stroke="#8b7ffd" strokeWidth={3} fill="url(#score-fill)"/><Area type="monotone" dataKey="Communication" stroke="#3dd4b4" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer>;
}
