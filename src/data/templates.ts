import type { PlaygroundMode } from "../types";

const vanillaStarter = {
  "/index.html": {
    code: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
<main class="hero">
  <span class="eyebrow">HTML · CSS · JavaScript</span>
  <h1>Build something<br><em>worth sharing.</em></h1>
  <p>Edit the files, press Run, and watch your idea come alive.</p>
  <button id="spark">Make some magic</button>
  <div id="message" aria-live="polite"></div>
</main>
<script src="/index.js"></script>
</body>
</html>`,
  },
  "/styles.css": {
    code: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=DM+Serif+Display:ital@0;1&display=swap');

* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: #f8f7f3;
  background: #151513;
  font-family: 'DM Sans', sans-serif;
}
.hero { width: min(760px, 88vw); padding: 72px 0; }
.eyebrow { color: #b9ff66; font-size: 12px; font-weight: 700; letter-spacing: .18em; }
h1 { margin: 20px 0; font: 400 clamp(52px, 10vw, 96px)/.92 'DM Serif Display', serif; letter-spacing: -.05em; }
h1 em { color: #b9ff66; }
p { max-width: 520px; color: #a6a69f; font-size: 18px; line-height: 1.6; }
button { margin-top: 20px; padding: 14px 20px; border: 0; border-radius: 999px; color: #151513; background: #b9ff66; font: 700 14px 'DM Sans'; cursor: pointer; }
#message { min-height: 28px; margin-top: 22px; color: #b9ff66; }
`,
  },
  "/index.js": {
    code: `const button = document.querySelector('#spark');
const message = document.querySelector('#message');

button.addEventListener('click', () => {
  const ideas = ['A bold landing page.', 'A delightful interaction.', 'Your next portfolio piece.'];
  message.textContent = ideas[Math.floor(Math.random() * ideas.length)];
  console.log('Idea generated:', message.textContent);
});`,
  },
};

const vanillaDashboard = {
  "/index.html": {
    code: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
<main>
  <header><div><span>Overview</span><h1>Good morning, Kanish.</h1></div><button>Export report</button></header>
  <section class="metrics">
    <article><span>Revenue</span><strong>₹84.2K</strong><small class="up">↗ 12.4%</small></article>
    <article><span>Orders</span><strong>1,284</strong><small class="up">↗ 8.1%</small></article>
    <article><span>Conversion</span><strong>4.82%</strong><small>↘ 0.3%</small></article>
  </section>
  <section class="chart-card"><div><span>Performance</span><strong>Weekly revenue</strong></div><div id="chart"></div></section>
</main>
<script src="/index.js"></script>
</body>
</html>`,
  },
  "/styles.css": {
    code: `*{box-sizing:border-box}body{margin:0;background:#f3f2ed;color:#191917;font-family:Inter,system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:48px 28px}header{display:flex;align-items:end;justify-content:space-between}span{color:#77776e;font-size:13px}h1{margin:7px 0 0;font-size:32px;letter-spacing:-.04em}button{border:0;border-radius:10px;padding:12px 16px;background:#191917;color:#fff;font-weight:600}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:34px 0}.metrics article,.chart-card{background:white;border:1px solid #deddd5;border-radius:16px;padding:22px}.metrics strong{display:block;font-size:30px;margin:18px 0 8px}.metrics small{color:#e05b52}.metrics .up{color:#3c8c61}.chart-card strong{display:block;margin-top:6px}.chart-card>div:first-child{margin-bottom:28px}#chart{height:260px;display:flex;align-items:end;gap:10px}@media(max-width:650px){.metrics{grid-template-columns:1fr}header{align-items:start;gap:20px}h1{font-size:26px}}`,
  },
  "/index.js": {
    code: `const data = [38, 52, 46, 72, 64, 86, 78, 96, 68, 82, 92, 100];
const chart = document.querySelector('#chart');
data.forEach((value, index) => {
  const bar = document.createElement('button');
  bar.title = 'Week ' + (index + 1) + ': ' + value;
  bar.style.cssText = 'height:' + value + '%;flex:1;padding:0;border-radius:6px 6px 2px 2px;background:' + (index === data.length - 1 ? '#7557ff' : '#ded9ff');
  chart.appendChild(bar);
});`,
  },
};

const reactStarter = {
  "/App.js": {
    code: `import { useState } from "react";
import "./styles.css";

const moods = ["Focused", "Curious", "Confident"];

export default function App() {
  const [mood, setMood] = useState(0);
  return (
    <main>
      <div className="orb" aria-hidden="true" />
      <span className="label">REACT PLAYGROUND</span>
      <h1>Make the interface<br />feel <em>{moods[mood]}.</em></h1>
      <p>State, components, and instant feedback—all running safely in your browser.</p>
      <button onClick={() => setMood((mood + 1) % moods.length)}>Change the mood <span>→</span></button>
    </main>
  );
}`,
  },
  "/styles.css": {
    code: `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;overflow:hidden;background:#e8e6ff;color:#15151d;font-family:Manrope,sans-serif}main{position:relative;width:min(760px,88vw);z-index:1}.orb{position:fixed;width:520px;height:520px;right:-100px;top:-140px;border-radius:50%;background:#ff6d4d;filter:blur(1px);z-index:-1}.label{font-size:12px;font-weight:700;letter-spacing:.2em}h1{font-size:clamp(52px,9vw,94px);line-height:.92;letter-spacing:-.065em;margin:22px 0}h1 em{font-style:normal;color:#6750e8}p{max-width:540px;font-size:18px;line-height:1.6;color:#5e5d6d}button{margin-top:20px;border:1px solid #15151d;border-radius:999px;padding:14px 18px;background:transparent;font:600 14px Manrope;cursor:pointer}button span{margin-left:22px}`,
  },
};

const reactCards = {
  "/App.js": {
    code: `import { useMemo, useState } from "react";
import "./styles.css";

const projects = [
  { name: "Pulse Analytics", type: "Dashboard", color: "violet" },
  { name: "Northstar", type: "Landing page", color: "lime" },
  { name: "Atlas Notes", type: "Productivity", color: "orange" },
];

export default function App() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => projects.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [query]);
  return <main><header><div><span>PROJECT LIBRARY</span><h1>Recent experiments</h1></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" /></header><section>{results.map((item) => <article key={item.name}><div className={'cover ' + item.color}><span>↗</span></div><small>{item.type}</small><h2>{item.name}</h2></article>)}</section></main>;
}`,
  },
  "/styles.css": {
    code: `*{box-sizing:border-box}body{margin:0;background:#101012;color:#f7f6f2;font-family:Inter,system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:56px 28px}header{display:flex;justify-content:space-between;align-items:end;margin-bottom:38px}header span,small{font-size:11px;letter-spacing:.15em;color:#8c8b92}h1{font-size:42px;margin:10px 0 0;letter-spacing:-.05em}input{width:230px;border:1px solid #343438;border-radius:10px;padding:12px 14px;background:#1b1b1e;color:white}section{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{padding:10px;border:1px solid #2d2d31;border-radius:18px;background:#18181b}.cover{height:220px;border-radius:12px;margin-bottom:18px;padding:16px;text-align:right;color:#111}.cover span{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#fff}.violet{background:#9f8cff}.lime{background:#b9f36b}.orange{background:#ff8f61}article small{padding:0 8px}h2{font-size:18px;padding:0 8px;margin:8px 0 12px}@media(max-width:700px){header{display:block}input{margin-top:20px;width:100%}section{grid-template-columns:1fr}}`,
  },
};

const angularStarter = {
  "/src/app/app.component.ts": {
    code: `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  count = 0;
  increment() { this.count += 1; }
  decrement() { this.count = Math.max(0, this.count - 1); }
}`,
  },
  "/src/app/app.component.html": {
    code: `<main>
  <span class="eyebrow">ANGULAR PLAYGROUND</span>
  <h1>A tiny state machine,<br>beautifully <em>bound.</em></h1>
  <p>Use Angular templates, events, and component state with instant feedback.</p>
  <section class="counter">
    <button (click)="decrement()" aria-label="Decrease count">−</button>
    <strong>{{ count }}</strong>
    <button (click)="increment()" aria-label="Increase count">+</button>
  </section>
</main>`,
  },
  "/src/app/app.component.css": {
    code: `:host{display:grid;min-height:100vh;place-items:center;background:#fff4e6;color:#241a13;font-family:Arial,sans-serif}main{width:min(720px,86vw)}.eyebrow{color:#ee5a24;font-size:12px;font-weight:700;letter-spacing:.18em}h1{margin:18px 0;font-size:clamp(48px,9vw,86px);line-height:.94;letter-spacing:-.065em}h1 em{color:#ee5a24}p{max-width:520px;color:#725f53;font-size:18px;line-height:1.6}.counter{display:inline-flex;align-items:center;gap:24px;margin-top:24px;padding:10px;border:1px solid #e1cbb8;border-radius:999px;background:white}.counter button{width:44px;height:44px;border:0;border-radius:50%;background:#241a13;color:white;font-size:24px;cursor:pointer}.counter strong{min-width:52px;text-align:center;font-size:28px}`,
  },
};

const angularTasks = {
  "/src/app/app.module.ts": {
    code: `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, FormsModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}`,
  },
  "/src/app/app.component.ts": {
    code: `import { Component } from '@angular/core';

interface Task { id: number; label: string; done: boolean; }

@Component({ selector: 'app-root', templateUrl: './app.component.html', styleUrls: ['./app.component.css'] })
export class AppComponent {
  nextId = 4;
  newTask = '';
  tasks: Task[] = [
    { id: 1, label: 'Sketch the interaction', done: true },
    { id: 2, label: 'Build the component', done: false },
    { id: 3, label: 'Polish every detail', done: false }
  ];
  addTask() { const label = this.newTask.trim(); if (!label) return; this.tasks.push({ id: this.nextId++, label, done: false }); this.newTask = ''; }
  remaining() { return this.tasks.filter(task => !task.done).length; }
}`,
  },
  "/src/app/app.component.html": {
    code: `<main><header><div><span>YOUR DAY</span><h1>Small steps,<br>real momentum.</h1></div><strong>{{ remaining() }} left</strong></header><form (ngSubmit)="addTask()"><input [(ngModel)]="newTask" name="task" placeholder="Add a task"><button>Add</button></form><section><label *ngFor="let task of tasks" [class.done]="task.done"><input type="checkbox" [(ngModel)]="task.done"><span>{{ task.label }}</span></label></section></main>`,
  },
  "/src/app/app.component.css": {
    code: `:host{display:block;min-height:100vh;background:#dfe8ff;color:#171b26;font-family:Arial,sans-serif}main{max-width:720px;margin:auto;padding:64px 24px}header{display:flex;justify-content:space-between;align-items:end}header span{font-size:11px;letter-spacing:.18em;color:#526793}h1{font-size:52px;line-height:.98;letter-spacing:-.06em;margin:12px 0}header strong{padding:10px 14px;border-radius:999px;background:#171b26;color:white}form{display:flex;gap:10px;margin:38px 0 18px}form input{flex:1;border:1px solid #9cadcf;border-radius:12px;padding:14px;background:#f6f8ff;font-size:15px}button{border:0;border-radius:12px;padding:0 20px;background:#5c6ee8;color:white;font-weight:700}section{border:1px solid #aebddd;border-radius:16px;overflow:hidden;background:#f6f8ff}label{display:flex;align-items:center;gap:14px;padding:18px;border-bottom:1px solid #d6def0}label:last-child{border:0}label.done span{text-decoration:line-through;color:#7d879e}label input{width:18px;height:18px;accent-color:#5c6ee8}`,
  },
};

export const PLAYGROUND_MODES: PlaygroundMode[] = [
  {
    id: "vanilla",
    label: "HTML, CSS & JS",
    shortLabel: "Web",
    description: "The browser fundamentals, with zero setup.",
    accent: "#b9ff66",
    sandpackTemplate: "static",
    templates: [
      { id: "vanilla-starter", name: "Creative starter", description: "A bold interactive landing page", files: vanillaStarter },
      { id: "vanilla-dashboard", name: "Metrics dashboard", description: "Responsive cards and a tiny chart", files: vanillaDashboard },
    ],
  },
  {
    id: "react",
    label: "React",
    shortLabel: "React",
    description: "Components, hooks, and JSX in an isolated runtime.",
    accent: "#8e7dff",
    sandpackTemplate: "react",
    templates: [
      { id: "react-starter", name: "Stateful hero", description: "A focused React state example", files: reactStarter },
      { id: "react-cards", name: "Project library", description: "Filtering, cards, and responsive UI", files: reactCards },
    ],
  },
  {
    id: "angular",
    label: "Angular",
    shortLabel: "Angular",
    description: "Templates, binding, and TypeScript components.",
    accent: "#ff7657",
    sandpackTemplate: "angular",
    templates: [
      { id: "angular-starter", name: "Bound counter", description: "Events, state, and interpolation", files: angularStarter },
      { id: "angular-tasks", name: "Task list", description: "Forms, loops, and two-way binding", files: angularTasks },
    ],
  },
];

export const getMode = (modeId: PlaygroundMode["id"]) =>
  PLAYGROUND_MODES.find((mode) => mode.id === modeId) ?? PLAYGROUND_MODES[0];
