# 🖨️ PrintCC (PrintFlow)
> **A Premium, Modular 3D Print Shop Manager & Telemetry Hub**

PrintCC (also known as PrintFlow) is a state-of-the-art, desktop-first management application built on **Tauri v2**, **React**, **Vite**, **TypeScript**, and **Tailwind CSS**. It is designed to streamline operations for 3D printing service providers by connecting directly to 3D printers, automating quoting, managing client ledgers, tracking filament spools with logging, and providing real-time financial analytics.

---

## 🚀 Key Features

* **📦 Dual-Mode Persistence Layer**
  * Runs natively inside **Tauri v2** with a local **SQLite** database.
  * Transparently falls back to **`localStorage`** when run in standard web browsers, ensuring full data persistence across sessions and reloads without loss of configurations or active printers.
* **⚡ Live Telemetry Hub & WebSocket Sync**
  * Features a custom Node.js Express server acting as a bridge to 3D printers (e.g., Bambu Lab) via **MQTT**.
  * Real-time telemetry (nozzle temperature, bed temperature, active print percentage, remaining time, printer state) streamed to the frontend via **WebSockets** with exponential backoff reconnection logic.
* **📊 Auto-State Transition & Spool Deduction**
  * Seamlessly matches active print filenames against the Kanban job list.
  * Automatically transitions job statuses to **"Printing"** when a print starts, updates progress/time in real time, and promotes the job to **"Ready for Pickup"** upon completion.
  * Auto-deducts the precise gram weight of filament from the active spool inventory and posts an audit log.
* **📋 Interactive Kanban Job Board**
  * Drag-and-drop workflow tracking: **Pending Quote** ➔ **Awaiting Approval** ➔ **Queue** ➔ **Printing** ➔ **Ready for Pickup** ➔ **Completed**.
  * Handles multi-plate `.3mf` files with automated parsing of filenames, layer heights, and plate-by-plate metadata.
* **💰 Advanced Quoting & Pricing Engine**
  * Formulates pricing using print weight, printing time, flat markup rates, service fees, and custom density factors.
  * Supports interactive variable sliders to see immediate profit margin projections.
* **🧵 Detailed Filament Inventory Ledger**
  * Spool-by-spool tracking showing color hexes, material types, remaining weights, and cost.
  * Generates transaction logs for spool deductions, waste calculations, and refills.
* **👥 Client & Customer Directory**
  * Standardized CRM ledger displaying clients, contact info, total orders, and lifetime value (LTV).
* **📈 Rich Financial & Performance Analytics**
  * Tracks monthly profit and revenue generation.
  * Logs failed prints with material waste percentages to pinpoint failure causes and spool utilization rates.

---

## 📐 System Architecture

PrintCC splits operations into a desktop frontend client and a high-performance local network broker.

```
       ┌────────────────────────────────────────────────────────┐
       │                 PrintCC Tauri App (UI)                 │
       │  React + Vite + TypeScript + Tailwind + Zustand Stores  │
       └───────┬────────────────────────────────────────┬───────┘
               │                                        │
               │ (WebSockets)                           │ (Tauri SQL Plugin)
               ▼                                        ▼
   ┌───────────────────────┐                ┌───────────────────────┐
   │    Local Express      │                │        SQLite         │
   │    Server Bridge      │                │   Local DB Storage    │
   └───────────┬───────────┘                └───────────▲───────────┘
               │                                        │ (Fallback)
               │ (MQTT Telemetry)                       │
               ▼                                        ▼
   ┌───────────────────────┐                ┌───────────────────────┐
   │    3D Printer(s)      │                │     localStorage      │
   │  (Bambu Lab / Mock)   │                │   Browser Fallback    │
   └───────────────────────┘                └───────────────────────┘
```

---

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript, Zustand (State Management), Tailwind CSS, Framer Motion (Animations), Lucide React (Icons).
* **Desktop Shell:** Tauri v2 (Rust backend, system capability controls).
* **Local Backend Bridge:** Node.js, Express, `ws` (WebSockets), `mqtt` (MQTT client broker).
* **Database:** SQLite (embedded via `@tauri-apps/plugin-sql`), raw JSON local storage fallbacks.

---

## 💻 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [Rust & Cargo](https://www.rust-lang.org/tools/install) (only if compiling the Tauri desktop app)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/marmalade1124/CCPrint.git
   cd CCPrint
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Running the Application

PrintCC can be run in dual-server development mode, running both the Node backend bridge and the frontend concurrently:

```bash
npm run dev
```

* **Frontend Server:** `http://localhost:5173`
* **Node Backend Server:** `http://localhost:3001`
* **WebSocket Server:** `ws://localhost:3001/ws`

To run the desktop application inside the **Tauri wrapper**:

```bash
npm run tauri dev
```

### Production Build

To compile the production assets (Vite frontend bundle + bundled server backend file):

```bash
npm run build
```

To build the final standalone installer for your platform (**Tauri desktop executable**):

```bash
npm run tauri build
```
Installers will be generated under `src-tauri/target/release/bundle/`.

---

## 📂 Project Structure

```
├── dist-server/           # Compiled Express backend server assets
├── src/                   # React Frontend Code
│   ├── components/        # Reusable UI Components (Kanban, Inventory, Charts, etc.)
│   ├── hooks/             # Custom React hooks (useWebSocket, useTelemetrySync)
│   ├── lib/               # Database connectors & migration setups
│   ├── pages/             # Layout pages mapped to navigation tabs
│   ├── stores/            # Zustand global state management slices
│   ├── types/             # Shared TypeScript models and schema definitions
│   ├── utils/             # Helpmate parsing scripts and api configs
│   ├── App.tsx            # App controller & Tab navigations
│   └── main.tsx           # React bootstrap entry point
├── src-tauri/             # Tauri Desktop Settings
│   ├── src/               # Rust source entry
│   ├── capabilities/      # Tauri API plugin permissions & settings
│   └── tauri.conf.json    # Tauri configuration (window size, plugins, bundle settings)
├── server.js              # Node.js backend printer bridge
├── package.json           # Scripts and dependencies
└── tailwind.config.js     # Tailwind design styling variables
```

---

## 📄 License

This project is licensed under the MIT License.
