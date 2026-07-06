import React, { useState, useEffect } from "react";
import { Copy, Download, DollarSign, Radar, Wrench, Search, Factory, Flame, Grid3X3, ClipboardCheck, AlertTriangle, RefreshCw, ShieldCheck, Handshake, Plane, LayoutDashboard, Target, Building2, Users, CheckSquare, Plus, X, Pencil, Trash2, Filter, RotateCcw, UserPlus, TrendingUp, BarChart3, ArrowRight, Phone, Mail, CalendarDays, MessageSquare, Settings, LogOut, Lock, Eye, Package, FileText, Check, ChevronDown, ChevronUp, Send } from "lucide-react";

/* ------------------------------------------------------------------ */
/* BAI Africa CRM v15 — workflow governance: scoped lead gen, catalog */
/* ops role, meeting-notes, owner-based commission + AD override,      */
/* cross-territory agreements, mandatory RFQ date, approval e-mail     */
/* intents, collection aging, repeat-order reference, Finance payouts  */
/* Product catalog · Quote builder · Discount approval workflow        */
/* Chain: Area Director → COO → CEO → President (by discount %)        */
/* Persistent via window.storage (key: bai_crm_v4, migrates v3/v2/v1)  */
/* ------------------------------------------------------------------ */

/* Storage shim: uses the browser's localStorage when deployed standalone (outside Claude). */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      if (v === null) throw new Error("Key not found");
      return { key, value: v };
    },
    async set(key, value) { localStorage.setItem(key, value); return { key, value }; },
    async delete(key) { localStorage.removeItem(key); return { key, deleted: true }; },
  };
}

const KEY_V15 = "bai_crm_v15";
const KEY_V14 = "bai_crm_v14";
const KEY_V13 = "bai_crm_v13";
const KEY_V12 = "bai_crm_v12";
const KEY_V11 = "bai_crm_v11";
const KEY_V10 = "bai_crm_v10";
const KEY_V9 = "bai_crm_v9";
const KEY_V8 = "bai_crm_v8";
const KEY_V7 = "bai_crm_v7";
const KEY_V6 = "bai_crm_v6";
const KEY_V5 = "bai_crm_v5";
const KEY_V4 = "bai_crm_v4";
const KEY_V3 = "bai_crm_v3";
const KEY_V2 = "bai_crm_v2";
const KEY_V1 = "bai_crm_v1";

const PRODUCTS = {
  "Oshino Lamps": { rate: 0.03, short: "Oshino" },
  "Repair Management": { rate: 0.03, short: "Repair Mgmt" },
  "Vogt PMA Parts": { rate: 0.05, short: "Vogt PMA" },
  "Anjou Seat Belts": { rate: 0.05, short: "Anjou" },
  "Novega ULBs": { rate: 0.05, short: "Novega" }, // rate TBC — not in June 2026 memo
  "Tooling & Calibration": { rate: 0.03, short: "Tooling" }, // rate TBC — line from banner.aero, not in June 2026 memo
};

const STAGES = ["Prospect", "Contacted", "Meeting Held", "Quote / RFQ", "Negotiation", "Won", "Lost"];
const STAGE_PROB = { Prospect: 10, Contacted: 20, "Meeting Held": 40, "Quote / RFQ": 60, Negotiation: 75, Won: 100, Lost: 0 };
const STAGE_FCAT = { Prospect: "Pipeline", Contacted: "Pipeline", "Meeting Held": "Pipeline", "Quote / RFQ": "Upside", Negotiation: "Forecast", Won: "Closed", Lost: "Omitted" };
const FORECAST_CATS = ["Omitted", "Pipeline", "Upside", "Forecast", "Closed"]; // Oracle forecast categories
const LEAD_STATUSES = ["Unqualified", "Qualified", "Converted", "Retired"]; // Oracle lead progression
const LEAD_RANKS = ["Hot", "Warm", "Cool"];
const LEAD_SOURCES = ["Referral", "Event / Conference", "LinkedIn", "Cold Outreach", "Inbound", "Existing Relationship"];
const INTERACTION_TYPES = ["Call", "Email", "Meeting", "WhatsApp", "Note"];
const REGIONS = ["East Africa", "West Africa", "Southern Africa", "Central Africa", "North Africa", "Middle East"];
const TIERS = ["Tier 1", "Tier 2", "Tier 3"];

/* ------------------------- roles & approvals ----------------------- */

const ROLES = {
  "Area Director": { scope: "all", edit: true, admin: true, catalog: true, finance: true, blurb: "Full access — all territories, team, quota, catalog & approvals." },
  "Territory Manager (BD)": { scope: "region", edit: true, admin: false, catalog: false, finance: false, blurb: "Works own territory — full edit within assigned region." },
  "COO": { scope: "all", edit: false, admin: false, catalog: false, finance: false, blurb: "View all territories · approves discounts at COO level." },
  "CEO": { scope: "all", edit: false, admin: false, catalog: false, finance: false, blurb: "View all territories · approves discounts at CEO level." },
  "President": { scope: "all", edit: false, admin: false, catalog: false, finance: false, blurb: "View all territories · approves discounts at President level." },
  "Analyst": { scope: "all", edit: false, admin: false, catalog: true, finance: false, blurb: "Analytics access — view all data; can update catalog & pricing." },
  "Operations": { scope: "all", edit: false, admin: false, catalog: true, finance: false, blurb: "Tracks orders and quotes across the territory; maintains product list & pricing." },
  "Finance": { scope: "all", edit: false, admin: false, catalog: false, finance: true, blurb: "Tracks collections; processes commission payouts to staff." },
};
const ROLE_NAMES = Object.keys(ROLES);
const OWNER_ROLES = ["Area Director", "Territory Manager (BD)"];
const roleColorMap = { "Area Director": "#B8720F", "Territory Manager (BD)": "#0E6E6E", COO: "#14538C", CEO: "#14538C", President: "#0C3557", Analyst: "#6E88A0", Operations: "#256E4E", Finance: "#A63A3A" };

const DEFAULT_THRESHOLDS = { ad: 5, coo: 10, ceo: 15, president: 20 };
const APPROVAL_LEVELS = [
  { key: "ad", role: "Area Director" },
  { key: "coo", role: "COO" },
  { key: "ceo", role: "CEO" },
  { key: "president", role: "President" },
];
/* Discount % above a threshold pulls that level into the chain (sequential). */
const requiredChain = (pct, th) => APPROVAL_LEVELS.filter((l) => pct > (Number(th[l.key]) || 0)).map((l) => l.role);

/* Payment terms carry their own approval matrix: credit exposure escalates sign-off. */
const PAYMENT_TERMS = ["Cash on Order", "Cash on Delivery", "Net 20 days", "Net 45 days", "Net 60 days"];
const TERMS_LEVEL_OPTIONS = ["None (auto)", "Area Director", "COO", "CEO", "President"];
const DEFAULT_TERMS_MATRIX = {
  "Cash on Order": "None (auto)",
  "Cash on Delivery": "Area Director",
  "Net 20 days": "Area Director",
  "Net 45 days": "COO",
  "Net 60 days": "CEO",
};
const discountDepth = (pct, th) => APPROVAL_LEVELS.filter((l) => pct > (Number(th[l.key]) || 0)).length;
const termsDepth = (term, matrix) => {
  const lvl = (matrix || DEFAULT_TERMS_MATRIX)[term] || "None (auto)";
  const i = APPROVAL_LEVELS.findIndex((l) => l.role === lvl);
  return i === -1 ? 0 : i + 1;
};
/* Combined chain = deepest requirement wins; approvals run sequentially AD -> COO -> CEO -> President. */
const chainForQuote = (pct, term, th, matrix) =>
  APPROVAL_LEVELS.slice(0, Math.max(discountDepth(pct, th), termsDepth(term, matrix))).map((l) => l.role);

const QUOTE_STATUSES = ["Draft", "Pending Approval", "Approved", "Rejected", "Sent", "Accepted", "Declined"];
const quoteStatusColor = { Draft: "#8CA0AE", "Pending Approval": "#B8720F", Approved: "#256E4E", Rejected: "#A63A3A", Sent: "#14538C", Accepted: "#256E4E", Declined: "#A63A3A" };

/* Guided selling — requirements & rules per product line (from Banner product docs) */
const GUIDANCE = {
  "Anjou Seat Belts": "Collect Aircraft Type, LOPA and seat CMM. SB route: 2\u20134 wks first time; STC route (A330/A350/B777/B787/737NG without existing STC): 3\u20136 months. Production 2\u20133 wks, delivery \u22641 wk, 36-month warranty. Anchor: Anjou \u2248\u20AC95/belt vs AmSafe \u2248$300.",
  "Novega ULBs": "Confirm recorder models \u2014 L3Harris FA2100/FA5000 and Universal Avionics CVFDR/CVR/FDR service letters support alternate ULB installation. GREEN90 is lithium-free: standard shipping, no hazmat handling.",
  "Vogt PMA Parts": "Confirm NHA and OEM PN cross-reference (e.g. lav systems 24E507009G03 / 24E507040G04). FAA-PMA approved; check lessor consent position early.",
  "Oshino Lamps": "Provide aircraft type and current lamp PNs for OL-prefix cross-reference. LED direct replacements are FAA-PMA/STC and EASA approved.",
  "Repair Management": "Scope per event: component PN, condition, required TAT. 400+ FAA/EASA certified shop network; AOG 24/7/365.",
  "Tooling & Calibration": "Banner partners with 100+ tooling/GSE brands: hand tools, instruments (borescopes, analyzers), GSE (engine stands, lifts), custom manufacturing (3D printing, machining), hardware and maintenance materials. EASA/FAA-approved machine shops; stock and custom solutions per RFQ.",
};

const COND_CODES = ["NE", "NS", "OH", "SV", "AR", "RP", "SVC"]; // New, New Surplus, Overhauled, Serviceable, As Removed, Repaired, Service
const COND_LEGEND = "Condition codes: NE New | NS New Surplus | OH Overhauled | SV Serviceable | AR As Removed | RP Repaired | SVC Service";
const INCOTERMS = ["EXW Hollywood, FL", "FCA Miami, FL", "FOB Miami, FL", "CIP Destination", "CPT Destination", "DAP Destination", "DDP Destination"];

/* -------------------- Aircraft 360 reference data ------------------- */

const ATA_CHAPTERS = [
  { ch: 21, name: "Air Conditioning" }, { ch: 23, name: "Communications" }, { ch: 24, name: "Electrical Power" },
  { ch: 25, name: "Equipment & Furnishings", banner: ["Anjou Seat Belts"] }, { ch: 26, name: "Fire Protection" },
  { ch: 27, name: "Flight Controls" }, { ch: 28, name: "Fuel" }, { ch: 29, name: "Hydraulic Power" },
  { ch: 30, name: "Ice & Rain Protection" }, { ch: 31, name: "Indicating / Recording", banner: ["Novega ULBs"] },
  { ch: 32, name: "Landing Gear" }, { ch: 33, name: "Lights", banner: ["Oshino Lamps"] },
  { ch: 34, name: "Navigation" }, { ch: 35, name: "Oxygen" }, { ch: 36, name: "Pneumatic" },
  { ch: 38, name: "Water / Waste", banner: ["Vogt PMA Parts"] }, { ch: 49, name: "APU" },
  { ch: 52, name: "Doors" }, { ch: 57, name: "Wings" },
];

/* Aircraft family -> recommended Banner lines (opportunity engine) */
const fleetSuggest = (type) => {
  const base = ["Oshino Lamps", "Anjou Seat Belts", "Novega ULBs", "Repair Management"];
  const t = (type || "").toUpperCase();
  if (/737|777|787|767/.test(t)) return [...base, "Vogt PMA Parts"]; // Boeing lav-system PMA fit
  return base;
};

/* Indicative fleet compositions (public sources, 2025) — VERIFY before customer use */
const FLEET_SEED = {
  /* Verified mid-2026 where sourced (ET factsheet 04/2026: 170+ a/c avg age 7y; KQ ch-aviation/AeroTime 01/2026: ~34 a/c). Others indicative — verify. */
  a1: [{ type: "B787", count: 30, engine: "GEnx" }, { type: "A350", count: 28, engine: "Trent XWB" }, { type: "B777 (pax+F)", count: 28, engine: "GE90" }, { type: "B737NG/MAX", count: 46, engine: "CFM56/LEAP-1B" }, { type: "DHC-8 Q400", count: 30, engine: "PW150A" }, { type: "B767", count: 4, engine: "CF6" }],
  a3: [{ type: "B787-8", count: 9, engine: "GEnx" }, { type: "B737-800", count: 11, engine: "CFM56-7B" }, { type: "B737F (300SF/800SF)", count: 4, engine: "CFM56" }, { type: "E190", count: 9, engine: "CF34-10E" }],
  a4: [{ type: "DHC-8 Q400", count: 10, engine: "PW150A" }],
  a5: [{ type: "B737-800", count: 29, engine: "CFM56-7B" }, { type: "A320neo fam", count: 15, engine: "LEAP-1A" }, { type: "A330", count: 7, engine: "Trent 700" }, { type: "B777-300ER", count: 6, engine: "GE90" }, { type: "B787-9", count: 6, engine: "GEnx" }, { type: "A220", count: 12, engine: "PW1500G" }],
  a6: [{ type: "B737-800/MAX", count: 35, engine: "CFM56/LEAP-1B" }, { type: "B787", count: 9, engine: "GEnx" }, { type: "E190", count: 4, engine: "CF34-10E" }, { type: "ATR 72", count: 6, engine: "PW127" }],
  a7: [{ type: "B737 (Classic/NG)", count: 14, engine: "CFM56" }, { type: "E195-E2", count: 13, engine: "PW1900G" }, { type: "B777", count: 4, engine: "GE90" }, { type: "E145", count: 3, engine: "AE3007" }],
  a8: [{ type: "B737-800", count: 32, engine: "CFM56-7B" }],
  a9: [{ type: "A330", count: 2, engine: "Trent 700" }, { type: "B737-800", count: 4, engine: "CFM56-7B" }, { type: "CRJ900", count: 2, engine: "CF34-8C5" }],
  a10: [{ type: "B737-700/800", count: 7, engine: "CFM56-7B" }, { type: "DHC-8 Q400", count: 2, engine: "PW150A" }],
  a11: [{ type: "A330-800neo", count: 2, engine: "Trent 7000" }, { type: "CRJ900", count: 4, engine: "CF34-8C5" }],
  a12: [{ type: "B787-8", count: 2, engine: "GEnx" }, { type: "A220", count: 4, engine: "PW1500G" }, { type: "DHC-8 Q400", count: 5, engine: "PW150A" }, { type: "B767F", count: 1, engine: "CF6" }],
  a13: [{ type: "Embraer E-Jets (E170/190/195)", count: 45, engine: "CF34-8E/10E" }],
  a21: [{ type: "A320/neo fam", count: 12, engine: "CFM56-5B/LEAP-1A" }],
  a22: [{ type: "A320/A321", count: 5, engine: "V2500/CFM56" }],
  a23: [{ type: "A320", count: 3, engine: "V2500" }],
  a25: [{ type: "A320/neo fam", count: 50, engine: "CFM56/LEAP-1A" }, { type: "A330", count: 4, engine: "Trent 700" }],
  a26: [{ type: "B787-9", count: 10, engine: "GEnx" }, { type: "A320/321neo", count: 23, engine: "LEAP-1A" }],
  a35: [{ type: "ATR 72-600", count: 4, engine: "PW127M" }],
  a36: [{ type: "CRJ900", count: 5, engine: "CF34-8C5" }],
  a40: [{ type: "A320", count: 10, engine: "CFM56/V2500" }, { type: "A330", count: 3, engine: "Trent 700" }],
  a42: [{ type: "B737-400/800 (ACMI)", count: 10, engine: "CFM56" }],
  a45: [{ type: "A350", count: 4, engine: "Trent XWB" }, { type: "A330neo", count: 2, engine: "Trent 7000" }, { type: "ATR 72", count: 3, engine: "PW127" }],
  a48: [{ type: "A330", count: 8, engine: "Trent 700" }, { type: "B737-800", count: 25, engine: "CFM56-7B" }, { type: "ATR 72", count: 12, engine: "PW127" }],
  a49: [{ type: "B737-800", count: 4, engine: "CFM56-7B" }, { type: "DHC-8 Q400/Q200", count: 6, engine: "PW150A/PW123" }],
  a51: [{ type: "Cessna 208 Caravan", count: 9, engine: "PT6A" }, { type: "DHC-8-100/300", count: 3, engine: "PW120" }],
  a53: [{ type: "A320", count: 9, engine: "CFM56-5B" }],
};

/* Model 360 — aircraft family definitions & facts */
const FAMILY_DEFS = [
  { id: "737NG", label: "B737NG / Classic", re: "737(?!.*MAX)", oem: "Boeing", engines: "CFM56-7B (NG) / CFM56-3 (Classic)", vogt: true },
  { id: "737MAX", label: "B737 MAX", re: "MAX", oem: "Boeing", engines: "LEAP-1B", vogt: true },
  { id: "787", label: "B787 Dreamliner", re: "787", oem: "Boeing", engines: "GEnx-1B / Trent 1000", vogt: true },
  { id: "777", label: "B777", re: "777", oem: "Boeing", engines: "GE90-115B / GE90-94B", vogt: true },
  { id: "767", label: "B767", re: "767", oem: "Boeing", engines: "CF6-80 / PW4000", vogt: true },
  { id: "A320", label: "A320 family", re: "A?32[01]|A320", oem: "Airbus", engines: "CFM56-5B / V2500 / LEAP-1A / PW1100G", vogt: false },
  { id: "A330", label: "A330 / neo", re: "330", oem: "Airbus", engines: "Trent 700 / CF6-80E / Trent 7000 (neo)", vogt: false },
  { id: "A350", label: "A350", re: "350", oem: "Airbus", engines: "Trent XWB", vogt: false },
  { id: "A220", label: "A220", re: "220", oem: "Airbus (ex-CSeries)", engines: "PW1500G", vogt: false },
  { id: "EJET", label: "Embraer E-Jets / E2", re: "E1[4-9]|E19|E2\\b|Embraer", oem: "Embraer", engines: "CF34-8E/10E · E2: PW1900G", vogt: false },
  { id: "CRJ", label: "CRJ900", re: "CRJ", oem: "Bombardier/MHI", engines: "CF34-8C5", vogt: false },
  { id: "Q400", label: "DHC-8 / Q400", re: "Q400|Q200|DHC", oem: "De Havilland Canada", engines: "PW150A / PW120-series", vogt: false },
  { id: "ATR", label: "ATR 72", re: "ATR", oem: "ATR", engines: "PW127", vogt: false },
  { id: "C208", label: "Cessna 208 Caravan", re: "Caravan|208", oem: "Textron", engines: "PT6A-114A", vogt: false },
];

/* OEMs Banner represents (per Banner corporate deck) */
const OEM_DIRECTORY = [
  { name: "Oshino Lamps", role: "Authorised distributor", scope: "Nose-to-tail aircraft lighting (OL-prefix); FAA-PMA/STC & EASA LED replacements" },
  { name: "Vogt Aero / Vogt MRO", role: "Distributor — Africa, Asia/Pacific, LATAM", scope: "130+ FAA-PMA, STC & OOP parts; Part 145 component repair (Airmark heritage)" },
  { name: "Anjou Aeronautique", role: "Partner — full cabin support", scope: "Seat belts (TSO C22g / C114), restraints, textiles, composites; EASA 21J/21G/145" },
  { name: "Novega", role: "ULB programme", scope: "SID88 / BLUE90 / GREEN90 underwater locator beacons (L3Harris & UA service letters)" },
  { name: "Thales", role: "Represented manufacturer", scope: "Avionics" },
  { name: "Safran", role: "Represented manufacturer", scope: "Aerospace systems" },
  { name: "Parker", role: "Represented manufacturer", scope: "Hydraulics & fluid systems" },
  { name: "Lufthansa Technik", role: "Partner", scope: "Components & services" },
  { name: "Dayton-Granger", role: "Represented manufacturer", scope: "Antennas, static dischargers" },
  { name: "Bucher", role: "Represented manufacturer", scope: "Cabin interiors" },
  { name: "HRD Aero Systems", role: "Partner", scope: "Safety equipment" },
  { name: "PSE", role: "Partner", scope: "Components" },
  { name: "Kanemats", role: "Represented manufacturer", scope: "Components" },
];

/* African / territory MRO directory (linked to accounts where applicable) */
const MRO_DIRECTORY = [
  { name: "Ethiopian MRO", base: "Addis Ababa (ADD)", accountId: "a2", note: "Largest African MRO; airframe, engine, component" },
  { name: "SAA Technical", base: "Johannesburg (JNB)", accountId: "a39", note: "Wide/narrowbody heavy checks, components" },
  { name: "EgyptAir Maintenance & Engineering", base: "Cairo (CAI)", accountId: "a5", note: "Full MRO arm of EgyptAir" },
  { name: "Kenya Airways Technical", base: "Nairobi (NBO)", accountId: "a3", note: "B787/B737/E190 line & base" },
  { name: "Aerotechnic Industries", base: "Casablanca (CMN)", accountId: "a47", note: "RAM / AFI KLM E&M JV — narrowbody checks" },
  { name: "JORAMCO", base: "Amman (AMM)", accountId: "a30", note: "Independent MRO — A320/B737/B787/E-Jets" },
  { name: "Air Algérie Technics", base: "Algiers (ALG)", accountId: "a48", note: "Flag-carrier MRO" },
  { name: "Tunisair Technics", base: "Tunis (TUN)", accountId: "a52", note: "Tunisair MRO arm — on banner.aero customer map" },
];

/* Key supplier contacts (from official Banner / Vogt materials) */
const SUPPLIER_CONTACTS = [
  { company: "Vogt Aero", name: "Glen Edwardsen", title: "Business Development Director", email: "Glen.Edwardsen@vogtaero.com", phone: "+1 360 721 6055" },
  { company: "Vogt Aero", name: "Erik Vogt", title: "CEO | DER | Accountable Manager", email: "Erik.Vogt@vogtaero.com", phone: "+1 602 721 8567" },
  { company: "Vogt MRO", name: "Wesley Sperry", title: "General Manager", email: "Wesley.Sperry@vogtmro.com", phone: "+1 520 461 4505" },
  { company: "Banner Aircraft International", name: "Sales / AOG Desk", title: "24/7/365 · Customer portal: store.banner.aero", email: "sales@banner.aero", phone: "+1 (855) 822-6637 · +1 (213) 320-7877" },
  { company: "Anjou Aeronautique", name: "Marketing / Commercial", title: "Paris & Toulouse offices", email: "marketing@anjouaero.com", phone: "" },
];

const V12_CAT_ATA = { n1: { ata: 31 }, n2: { ata: 31 }, n3: { ata: 31 }, v1: { ata: 38, pma: true }, v2: { ata: 38, pma: true }, v3: { ata: 38, pma: true }, v4: { ata: 38, pma: true }, v5: { ata: 38, pma: true }, v6: { ata: 38, pma: true }, v7: { ata: 38, pma: true }, o1: { ata: 33 }, o2: { ata: 33 }, o3: { ata: 33 }, o4: { ata: 33 }, o5: { ata: 33 }, o6: { ata: 33, pma: true }, j1: { ata: 25 }, j2: { ata: 25 }, j3: { ata: 25 }, j4: { ata: 25 }, j5: { ata: 25 }, j6: { ata: 25 }, r1: { ata: 0 }, r2: { ata: 0 } };

const AOG_STATUSES = ["Open", "Quoted", "Shipped", "Closed"];
const aogColor = { Open: "#A63A3A", Quoted: "#B8720F", Shipped: "#14538C", Closed: "#256E4E" };

const REG_STATUSES = ["Not started", "Docs submitted", "Under evaluation", "Audit / site visit", "PVL awarded", "Expired"];
const LOSS_REASONS = ["Price", "Lead time", "OEM lock-in", "Lessor consent", "No budget", "Lost to competitor", "No decision", "Other"];
const STALE_DAYS = 14;
const REORDER_LINES = ["Oshino Lamps", "Anjou Seat Belts", "Novega ULBs"];
const REORDER_DAYS = 180;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmt2 = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dealValue = (d) => (d.lines || []).reduce((s, l) => s + (Number(l.value) || 0), 0);
/* Owner-based flat commission (replaces per-product-line rates):
   Territory Manager (BD) = 3% of gross deal value on their own deals.
   Area Director = 2% direct on deals they personally register, PLUS a 1%
   override on every deal in the whole territory (including their own). */
const BDM_RATE = 0.03;
const AD_DIRECT_RATE = 0.02;
const AD_OVERRIDE_RATE = 0.01;
const dealDirectCommission = (d, ownerRole) => dealValue(d) * (ownerRole === "Area Director" ? AD_DIRECT_RATE : BDM_RATE);
const dealOverrideCommission = (d) => dealValue(d) * AD_OVERRIDE_RATE;
/* Cross-territory agreement: splits the OWNER's direct commission between owner and an assisting BD. */
const commissionShare = (d, userId, roleOf) => {
  const direct = dealDirectCommission(d, roleOf(d.ownerId));
  const agr = d.agreement;
  if (agr && agr.assistBDId) {
    const assistShare = direct * ((Number(agr.splitPct) || 0) / 100);
    if (d.ownerId === userId) return direct - assistShare;
    if (agr.assistBDId === userId) return assistShare;
    return 0;
  }
  return d.ownerId === userId ? direct : 0;
};
/* Legacy alias used where only a flat total (not owner-split) is needed, e.g. quick previews. */
const dealCommission = (d, ownerRole) => dealDirectCommission(d, ownerRole);
const dealWeighted = (d) => dealValue(d) * ((d.prob ?? STAGE_PROB[d.stage] ?? 0) / 100);
const quarterOf = (dateStr) => {
  if (!dateStr) return "No date";
  const [y, m] = dateStr.split("-").map(Number);
  return `Q${Math.ceil(m / 3)} ${y}`;
};

/* quote maths */
const quoteSubtotal = (q) => (q.lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
const quoteNet = (q) => quoteSubtotal(q) * (1 - (Number(q.discountPct) || 0) / 100);
const TERMS_DAYS = { "Cash on Order": 0, "Cash on Delivery": 0, "Net 20 days": 20, "Net 45 days": 45, "Net 60 days": 60 };
/* Expected collection date follows the accepted quote's payment terms from the deal's close date. */
const expectedCollectionDate = (d, linkedQuote) => {
  if (!d.closedAt) return null;
  const days = linkedQuote ? (TERMS_DAYS[linkedQuote.paymentTerms] ?? 30) : 30;
  const dt = new Date(d.closedAt);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
};
const quoteCommission = (q, itemById) => (q.lines || []).reduce((s, l) => {
  const item = itemById(l.itemId);
  const rate = PRODUCTS[item?.productLine]?.rate || 0;
  return s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(q.discountPct) || 0) / 100) * rate;
}, 0);

/* ------------------------------ seed ------------------------------ */

const SEED_CATALOG = [
  // Novega ULBs — Banner pricing per ULB presentation (bulk tier at qty 10+)
  { id: "n1", productLine: "Novega ULBs", pn: "21435-00", name: "SID88 Low-Frequency ULB 8.8kHz (alt. for Dukane DK180)", unit: "EA", listPrice: 4300, bulkQty: 10, bulkPrice: 4000, lead: "Stock" },
  { id: "n2", productLine: "Novega ULBs", pn: "22960-00", name: "BLUE90 ULB 37.5kHz (alt. for DK120/90)", unit: "EA", listPrice: 1000, bulkQty: 10, bulkPrice: 950, lead: "Stock" },
  { id: "n3", productLine: "Novega ULBs", pn: "18717-00", name: "GREEN90 Lithium-Free ULB 37.5kHz (alt. for DK120/90)", unit: "EA", listPrice: 1000, bulkQty: 10, bulkPrice: 950, lead: "Stock" },
  // Vogt Aero PMA parts — priced per quote (POA)
  { id: "v1", productLine: "Vogt PMA Parts", pn: "VA-2540-T01", name: "Hot Water Tank Assy (OEM 8921110G5)", unit: "EA", listPrice: 0, lead: "2-3 wks" },
  { id: "v2", productLine: "Vogt PMA Parts", pn: "VA-2540-T02", name: "Hot Water Tank Assy (OEM 8921385G1)", unit: "EA", listPrice: 0, lead: "2-3 wks" },
  { id: "v3", productLine: "Vogt PMA Parts", pn: "VA-2540-H01", name: "Cartridge Heater Assy (OEM 24D507239P01)", unit: "EA", listPrice: 0, lead: "2-3 wks" },
  { id: "v4", productLine: "Vogt PMA Parts", pn: "VA-2540-H02", name: "Cartridge Heater Assy (OEM 24D507239P02)", unit: "EA", listPrice: 0, lead: "2-3 wks" },
  { id: "v5", productLine: "Vogt PMA Parts", pn: "3E2534-VA", name: "Water Level Sensor Assy (OEM 3E2534)", unit: "EA", listPrice: 0, lead: "2-3 wks" },
  { id: "v6", productLine: "Vogt PMA Parts", pn: "532T1-1M-140-VA", name: "Pressure Relief Valve (OEM 532T1-1M-140)", unit: "EA", listPrice: 0, lead: "2-3 wks" },
  { id: "v7", productLine: "Vogt PMA Parts", pn: "24B508385P1-VA", name: "Temperature Sensor Probe (OEM 24B508385P1)", unit: "EA", listPrice: 0, lead: "2-3 wks" },
  // Oshino aftermarket lighting — OL-prefix range
  { id: "o1", productLine: "Oshino Lamps", pn: "OL-series", name: "Filament / Halogen Lamps", unit: "EA", listPrice: 0, lead: "Stock-4 wks" },
  { id: "o2", productLine: "Oshino Lamps", pn: "OL-series", name: "Sealed Beam Landing Lights", unit: "EA", listPrice: 0, lead: "Stock-4 wks" },
  { id: "o3", productLine: "Oshino Lamps", pn: "OL-series", name: "Fluorescent Cabin Tubes", unit: "EA", listPrice: 0, lead: "Stock-4 wks" },
  { id: "o4", productLine: "Oshino Lamps", pn: "OL-series", name: "Miniature / Neon / Flash Tube Lamps", unit: "EA", listPrice: 0, lead: "Stock-4 wks" },
  { id: "o5", productLine: "Oshino Lamps", pn: "OL-series", name: "NVIS Filters", unit: "EA", listPrice: 0, lead: "4-6 wks" },
  { id: "o6", productLine: "Oshino Lamps", pn: "OL-LED", name: "LED Direct Replacements (FAA-PMA/STC, EASA)", unit: "EA", listPrice: 0, lead: "4-6 wks" },
  // Anjou Aeronautique — cabin & safety
  { id: "j1", productLine: "Anjou Seat Belts", pn: "349-series", name: "Steel-Buckle Lap Belt (TSO C22g, 16g seats)", unit: "EA", listPrice: 0, lead: "4-7 wks" },
  { id: "j2", productLine: "Anjou Seat Belts", pn: "353-series", name: "Light Aluminium-Buckle Belt (220g)", unit: "EA", listPrice: 0, lead: "4-7 wks" },
  { id: "j3", productLine: "Anjou Seat Belts", pn: "358-series", name: "Rotary-Buckle Restraint System 4/5-pt (TSO C114)", unit: "EA", listPrice: 0, lead: "4-7 wks" },
  { id: "j4", productLine: "Anjou Seat Belts", pn: "Various", name: "Belt Extensions (adult / baby)", unit: "EA", listPrice: 0, lead: "4-7 wks" },
  { id: "j5", productLine: "Anjou Seat Belts", pn: "Custom", name: "Cabin Textiles (covers, cushions, curtains, carpet kits)", unit: "KIT", listPrice: 0, lead: "4-8 wks" },
  { id: "j6", productLine: "Anjou Seat Belts", pn: "Custom", name: "Composite Products (dividers, stowage, literature pockets)", unit: "EA", listPrice: 0, lead: "6-10 wks" },
  // Repair Management — service, quoted per event
  { id: "r1", productLine: "Repair Management", pn: "N/A", name: "Component Repair — per event (400+ FAA/EASA shop network)", unit: "EVT", listPrice: 0, lead: "Per T/A" },
  { id: "r2", productLine: "Repair Management", pn: "N/A", name: "AOG Expedite Support — 24/7/365", unit: "EVT", listPrice: 0, lead: "AOG" },
  // Tooling & Calibration — per banner.aero service page (100+ partner brands); quoted per RFQ
  { id: "t1", productLine: "Tooling & Calibration", pn: "Various", name: "Electronic & Hand Tools, Fixtures", unit: "EA", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t2", productLine: "Tooling & Calibration", pn: "Various", name: "Machinery, Tools & Supplies (abrasives, actuators, bearings, alignment)", unit: "EA", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t3", productLine: "Tooling & Calibration", pn: "Custom", name: "Custom Manufacturing (3D printing, bonding, brazing, assembly)", unit: "LOT", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t4", productLine: "Tooling & Calibration", pn: "Various", name: "Instruments & Controls (borescopes, analyzers, accelerometers)", unit: "EA", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t5", productLine: "Tooling & Calibration", pn: "Various", name: "GSE & Material Handling (engine stands, lifts, pallet jacks)", unit: "EA", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t6", productLine: "Tooling & Calibration", pn: "N/A", name: "Machine Shop Services (EASA/FAA-approved)", unit: "EVT", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t7", productLine: "Tooling & Calibration", pn: "Various", name: "Hardware (fasteners, gaskets, hinges, washers)", unit: "LOT", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t8", productLine: "Tooling & Calibration", pn: "Various", name: "Maintenance Materials (chemicals, adhesives, sealants, metals & alloys)", unit: "LOT", listPrice: 0, lead: "Per RFQ", ata: 0 },
  { id: "t9", productLine: "Tooling & Calibration", pn: "N/A", name: "Calibration Services — per event", unit: "EVT", listPrice: 0, lead: "Per T/A", ata: 0 },
];

/* Official Area Director Africa Region account list (Feb 07 2026 export),
   deduplicated, plus Zelealem's active pipeline targets (ET, ET MRO, Jambojet, ASKY). */
const SEED_ACCOUNTS = [
  { id: "a1", name: "Ethiopian Airlines", tier: "Tier 1", region: "East Africa", country: "Ethiopia", ownerId: "r0", notes: "Pipeline target — flag carrier, largest fleet in Africa. Entry via MRO relationship.", reg: { status: "Docs submitted", submitted: "2026-07-01", expected: "2027-03-31", expiry: "", notes: "6–12 month cycle. Vendor pre-qualification pack sent." } },
  { id: "a2", name: "Ethiopian MRO", tier: "Tier 1", region: "East Africa", country: "Ethiopia", ownerId: "r0", notes: "Pipeline target — third-party MRO arm. Vogt PMA and Repair Mgmt fit. Contact: Daniel Demeke." },
  { id: "a3", name: "Kenya Airways", tier: "Tier 1", region: "East Africa", country: "Kenya", ownerId: "b8", notes: "Home-base account." },
  { id: "a4", name: "Jambojet", tier: "Tier 1", region: "East Africa", country: "Kenya", ownerId: "r0", notes: "Pipeline target — LCC, Q400 fleet, 10M passengers. Contact: Kidus Melkamu (CTO)." },
  { id: "a5", name: "EgyptAir", tier: "Tier 1", region: "North Africa", country: "Egypt", ownerId: "b1", notes: "Large fleet + MRO.", reg: { status: "Under evaluation", submitted: "2026-06-01", expected: "2026-11-30", expiry: "", notes: "4–6 month cycle." } },
  { id: "a6", name: "Royal Air Maroc", tier: "Tier 1", region: "North Africa", country: "Morocco", ownerId: "b6", notes: "Expanding fleet under national aviation strategy.", reg: { status: "Docs submitted", submitted: "2026-07-01", expected: "2026-10-31", expiry: "", notes: "Fastest cycle (3–5 mo). Register Vogt PMA and Oshino separately — separate procurement committees." } },
  { id: "a7", name: "Air Peace Limited", tier: "Tier 1", region: "West Africa", country: "Nigeria", ownerId: "r0", notes: "Listed N/A on the region sheet — Zelealem interim coverage." },
  { id: "a8", name: "FlySafair", tier: "Tier 1", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "737 operator, strong ops discipline." },
  { id: "a9", name: "RwandAir Limited", tier: "Tier 2", region: "East Africa", country: "Rwanda", ownerId: "b8", notes: "Qatar-backed growth." },
  { id: "a10", name: "ASKY Airlines", tier: "Tier 2", region: "West Africa", country: "Togo", ownerId: "r0", notes: "Pipeline target — ET-affiliated. Contact: Ahadu Simachew (CEO)." },
  { id: "a11", name: "Uganda Airlines", tier: "Tier 2", region: "East Africa", country: "Uganda", ownerId: "b8", notes: "Young fleet (A330neo, CRJ900)." },
  { id: "a12", name: "Air Tanzania Company Limited", tier: "Tier 2", region: "East Africa", country: "Tanzania", ownerId: "b8", notes: "Government-backed; 787/A220 fleet." },
  { id: "a13", name: "Airlink", tier: "Tier 2", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "Largest Southern Africa regional network." },
  { id: "a21", name: "Air Cairo", tier: "Tier 2", region: "North Africa", country: "Egypt", ownerId: "b1", notes: "" },
  { id: "a22", name: "Nile Air", tier: "Tier 2", region: "North Africa", country: "Egypt", ownerId: "b1", notes: "" },
  { id: "a23", name: "Nesma Airlines", tier: "Tier 3", region: "North Africa", country: "Egypt", ownerId: "b1", notes: "" },
  { id: "a24", name: "JAC", tier: "Tier 3", region: "Middle East", country: "", ownerId: "b2", notes: "Confirm entity details with Ahmed Youssry." },
  { id: "a25", name: "Flynas", tier: "Tier 1", region: "Middle East", country: "Saudi Arabia", ownerId: "b3", notes: "" },
  { id: "a26", name: "Gulf Air", tier: "Tier 1", region: "Middle East", country: "Bahrain", ownerId: "b3", notes: "" },
  { id: "a27", name: "Almasria", tier: "Tier 3", region: "North Africa", country: "Egypt", ownerId: "b3", notes: "" },
  { id: "a28", name: "Red Sea Airlines", tier: "Tier 3", region: "North Africa", country: "Egypt", ownerId: "b3", notes: "" },
  { id: "a29", name: "Petroleum Air Services", tier: "Tier 3", region: "North Africa", country: "Egypt", ownerId: "b3", notes: "" },
  { id: "a30", name: "JORAMCO (Jordan A/C Maint.)", tier: "Tier 2", region: "Middle East", country: "Jordan", ownerId: "b3", notes: "MRO account — Repair Mgmt / Vogt PMA fit." },
  { id: "a31", name: "Gulf Helicopters Company", tier: "Tier 3", region: "Middle East", country: "Qatar", ownerId: "b3", notes: "" },
  { id: "a32", name: "Air Master", tier: "Tier 3", region: "North Africa", country: "Egypt", ownerId: "b3", notes: "" },
  { id: "a33", name: "Aeroparts Egypt", tier: "Tier 3", region: "North Africa", country: "Egypt", ownerId: "b3", notes: "Parts trader." },
  { id: "a34", name: "Pyramids Airlines", tier: "Tier 3", region: "North Africa", country: "Egypt", ownerId: "b3", notes: "" },
  { id: "a35", name: "Green Africa", tier: "Tier 2", region: "West Africa", country: "Nigeria", ownerId: "b4", notes: "" },
  { id: "a36", name: "ValueJet", tier: "Tier 2", region: "West Africa", country: "Nigeria", ownerId: "b4", notes: "" },
  { id: "a37", name: "Pioneer Airlines", tier: "Tier 3", region: "West Africa", country: "Nigeria", ownerId: "b4", notes: "" },
  { id: "a38", name: "ExecuJet Aviation Nigeria", tier: "Tier 3", region: "West Africa", country: "Nigeria", ownerId: "b4", notes: "Business aviation." },
  { id: "a39", name: "South African Airways Technical", tier: "Tier 1", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "SAAT — MRO account." },
  { id: "a40", name: "South African Airways", tier: "Tier 2", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "" },
  { id: "a41", name: "Valerex Aviation", tier: "Tier 3", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "" },
  { id: "a42", name: "SAFAIR", tier: "Tier 2", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "ACMI / ops arm." },
  { id: "a43", name: "Roesch Aviation", tier: "Tier 3", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "" },
  { id: "a44", name: "Century Avionics (Pty) Ltd", tier: "Tier 3", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "" },
  { id: "a45", name: "Air Mauritius", tier: "Tier 2", region: "Southern Africa", country: "Mauritius", ownerId: "b5", notes: "Indian Ocean." },
  { id: "a46", name: "Africa Charter Airline", tier: "Tier 3", region: "Southern Africa", country: "South Africa", ownerId: "b5", notes: "" },
  { id: "a47", name: "Aerotechnic Industries", tier: "Tier 2", region: "North Africa", country: "Morocco", ownerId: "b6", notes: "RAM/AFI KLM JV — MRO." },
  { id: "a48", name: "Air Algérie", tier: "Tier 1", region: "North Africa", country: "Algeria", ownerId: "b7", notes: "" },
  { id: "a49", name: "Tassili Airlines", tier: "Tier 2", region: "North Africa", country: "Algeria", ownerId: "b7", notes: "" },
  { id: "a50", name: "Tassili Travail Aérien", tier: "Tier 3", region: "North Africa", country: "Algeria", ownerId: "b7", notes: "" },
  { id: "a51", name: "Safarilink Aviation Limited", tier: "Tier 3", region: "East Africa", country: "Kenya", ownerId: "b8", notes: "" },
  { id: "a52", name: "Tunisair Technics", tier: "Tier 2", region: "North Africa", country: "Tunisia", ownerId: "r0", notes: "Listed on banner.aero customer map — Tunisia not on region sheet; confirm rep assignment with Darya." },
  { id: "a53", name: "Nouvelair", tier: "Tier 2", region: "North Africa", country: "Tunisia", ownerId: "r0", notes: "Listed on banner.aero customer map (A320 operator) — confirm rep assignment." },
];

/* BD team from the official region sheet */
const SEED_USERS = [
  { id: "r0", name: "Zelealem M.J.", role: "Area Director", region: "" },
  { id: "b1", name: "Ahmed Elshahawy", role: "Territory Manager (BD)", region: "North Africa" },
  { id: "b2", name: "Ahmed Youssry", role: "Territory Manager (BD)", region: "Middle East" },
  { id: "b3", name: "Hazem Abdelhamid", role: "Territory Manager (BD)", region: "North Africa / Gulf" },
  { id: "b4", name: "Isaac Omotayo", role: "Territory Manager (BD)", region: "West Africa" },
  { id: "b5", name: "Jacques Brittz", role: "Territory Manager (BD)", region: "Southern Africa" },
  { id: "b6", name: "Mahdi Sadiq", role: "Territory Manager (BD)", region: "North Africa" },
  { id: "b7", name: "Mohamed Hemissi", role: "Territory Manager (BD)", region: "North Africa" },
  { id: "b8", name: "Wambui Mureithi", role: "Territory Manager (BD)", region: "East Africa" },
  { id: "u2", name: "COO", role: "COO", region: "" },
  { id: "u3", name: "CEO", role: "CEO", region: "" },
  { id: "u4", name: "President", role: "President", region: "" },
  { id: "u5", name: "Analyst", role: "Analyst", region: "" },
  { id: "u6", name: "Operations", role: "Operations", region: "" },
  { id: "u7", name: "Finance", role: "Finance", region: "" },
];

const SEED = {
  users: SEED_USERS,
  settings: { monthlyQuota: 300000, currentUserId: "", thresholds: DEFAULT_THRESHOLDS, termsMatrix: DEFAULT_TERMS_MATRIX },
  catalog: SEED_CATALOG,
  quotes: [
    {
      id: "q1", number: "Q-2026-001", accountId: "a4", oppId: "d1", ownerId: "r0",
      lines: [{ itemId: "n3", qty: 12, unitPrice: 950, cond: "NE", leadTime: "Stock" }],
      discountPct: 12, paymentTerms: "Net 45 days", incoterm: "EXW Hollywood, FL", attention: "Kidus Melkamu", customerRef: "JM-RFQ-2026-114", status: "Pending Approval",
      chain: ["Area Director", "COO"], approvals: [{ role: "Area Director", decision: "Approved", byName: "Zelealem M.J.", date: today(), comment: "Fleet-wide GREEN90 retrofit; bulk tier applied." }],
      createdAt: today(), rfqDate: today(), sentAt: "", notes: "Sample: 12× GREEN90 lithium-free ULBs at bulk price, 12% discount — awaiting COO.",
    },
  ],
  leads: [
    { id: "l1", accountId: "a37", contactId: "", contactName: "", title: "", source: "Event / Conference", product: "Oshino Lamps", est: 25000, status: "Unqualified", rank: "Hot", ownerId: "b4", notes: "Met at industry event — Pioneer Airlines, Embraer operator.", createdAt: today() },
  ],
  accounts: SEED_ACCOUNTS,
  contacts: [
    { id: "c1", name: "Daniel Demeke", title: "MD, Ethiopian MRO", accountId: "a2", email: "", phone: "", notes: "Key door for Vogt PMA + Repair Mgmt." },
    { id: "c2", name: "Kidus Melkamu", title: "CTO", accountId: "a4", email: "", phone: "", notes: "Technical decision-maker at Jambojet." },
    { id: "c3", name: "Fitsum Abadi", title: "Director of Cargo", accountId: "a3", email: "", phone: "", notes: "Kenya Airways relationship." },
    { id: "c4", name: "Ahadu Simachew", title: "CEO", accountId: "a10", email: "", phone: "", notes: "ASKY executive sponsor." },
  ],
  deals: [
    { id: "d1", name: "Q400 fleet ULB + lamp programme", accountId: "a4", ownerId: "r0", lines: [{ product: "Novega ULBs", value: 11400 }, { product: "Oshino Lamps", value: 34000 }], stage: "Quote / RFQ", prob: 60, forecastCat: "Upside", closeDate: "2026-09-30", notes: "GREEN90 retrofit + lamp consumables. Quote Q-2026-001 issued.", createdAt: "2026-07-01", lastTouch: today(), closedAt: "", meetingNotes: [], agreement: null },
    { id: "d2", name: "PMA parts evaluation", accountId: "a2", ownerId: "r0", lines: [{ product: "Vogt PMA Parts", value: 250000 }, { product: "Repair Management", value: 40000 }], stage: "Meeting Held", prob: 40, forecastCat: "Pipeline", closeDate: "2026-11-30", notes: "Lav system PMAs (VA-2540 family) + repair pilot. AFRAA follow-up.", createdAt: "2026-07-01", lastTouch: today(), closedAt: "", meetingNotes: [], agreement: null },
    { id: "d3", name: "Component repair pilot", accountId: "a3", ownerId: "b8", lines: [{ product: "Repair Management", value: 120000 }], stage: "Prospect", prob: 10, forecastCat: "Pipeline", closeDate: "2026-10-31", notes: "Position ahead of Aviation Africa Summit (Sep, Nairobi).", createdAt: "2026-07-01", lastTouch: today(), closedAt: "", meetingNotes: [], agreement: null },
    { id: "d4", name: "Anjou cabin belt refresh", accountId: "a8", ownerId: "b5", lines: [{ product: "Anjou Seat Belts", value: 60000 }], stage: "Prospect", prob: 10, forecastCat: "Pipeline", closeDate: "2026-12-15", notes: "349/353 belts — SB route, ~2-4 wk lead. Tie to cabin refurb cycle.", createdAt: "2026-07-01", lastTouch: today(), closedAt: "", meetingNotes: [], agreement: null },
    { id: "d5", name: "Oshino lamp starter order", accountId: "a7", ownerId: "r0", lines: [{ product: "Oshino Lamps", value: 35000 }], stage: "Contacted", prob: 20, forecastCat: "Pipeline", closeDate: "2026-10-15", notes: "Air Peace — interim coverage account.", createdAt: "2026-07-01", lastTouch: today(), closedAt: "", meetingNotes: [], agreement: null },
  ],
  activities: [
    { id: "t1", text: "Confirm meetings for Aviation Africa Summit (Nairobi, Sep 2026)", accountId: "", due: "2026-08-01", done: false },
    { id: "t2", text: "Send Vogt PMA technical pack (VA-2540 family) to Ethiopian MRO", accountId: "a2", due: "2026-07-10", done: false },
    { id: "t3", text: "Book AFRAA 58th AGA travel (Libreville, Nov 2026)", accountId: "", due: "2026-09-15", done: false },
    { id: "t4", text: "Confirm Novega ULB commission rate with BAI (not in June memo)", accountId: "", due: "2026-07-15", done: false },
  ],
  interactions: [],
  payouts: [],
  aircraft: [
    { id: "ac1", accountId: "a4", type: "DHC-8 Q400", reg: "5Y-JXA", msn: "", deliveryYear: "", engine: "PW150A", status: "Active", notes: "Sample record — verify against Jambojet fleet list" },
  ],
  aogCases: [],
};
/* Accounts named on banner.aero's public customer map (Africa section) */
const WEB_CUSTOMERS = ["a1", "a3", "a4", "a5", "a6", "a7", "a13", "a21", "a27", "a28", "a29", "a36", "a37", "a39", "a47", "a49", "a50", "a52", "a53"];
/* fold indicative fleets + website-customer flags into seed accounts */
SEED.accounts = SEED.accounts.map((a) => ({ fleet: FLEET_SEED[a.id] || [], webCustomer: WEB_CUSTOMERS.includes(a.id), ...a }));
SEED.catalog = SEED.catalog.map((p) => (V12_CAT_ATA[p.id] ? { ...p, ...V12_CAT_ATA[p.id] } : p));

/* --------------------------- migrations ---------------------------- */

const FCAT_MAP = { "Best Case": "Upside", "Committed": "Forecast" };

/* v10 -> v11: collection tracking — commission matures upon collection */
/* v14 -> v15: governance fields — meetingNotes/agreement on deals, payouts, roles, lead->account linking */
function migrateV14(v14) {
  const rolesNeeded = ["Operations", "Finance"];
  const haveRoles = new Set((v14.users || []).map((u) => u.role));
  const newUsers = rolesNeeded.filter((r) => !haveRoles.has(r)).map((r, i) => ({ id: `u${6 + i}`, name: r, role: r, region: "" }));
  return {
    ...v14,
    users: [...(v14.users || []), ...newUsers],
    payouts: v14.payouts || [],
    deals: (v14.deals || []).map((d) => ({ meetingNotes: [], agreement: null, ...d })),
    leads: (v14.leads || []).map((l) => ({ accountId: l.accountId || "", contactId: l.contactId || "", ...l })),
    settings: { ...v14.settings, currentUserId: "" },
  };
}

/* v13 -> v14: Tooling & Calibration line + banner.aero customer flags + Tunisia accounts */
const V14_TOOLING_IDS = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"];
function migrateV13(v13) {
  const have = new Set((v13.catalog || []).map((p) => p.id));
  const toolingItems = SEED_CATALOG.filter((p) => V14_TOOLING_IDS.includes(p.id) && !have.has(p.id));
  const haveNames = new Set((v13.accounts || []).map((a) => (a.name || "").toLowerCase()));
  const newAccounts = SEED.accounts.filter((a) => ["a52", "a53"].includes(a.id) && !haveNames.has(a.name.toLowerCase()));
  return {
    ...v13,
    catalog: [...(v13.catalog || []), ...toolingItems],
    accounts: [...(v13.accounts || []).map((a) => ({ ...a, webCustomer: WEB_CUSTOMERS.includes(a.id) || a.webCustomer || false })), ...newAccounts],
    activities: [...(v13.activities || []), { id: uid(), text: "Confirm Tooling & Calibration commission rate with BAI (line found on banner.aero, not in June memo); request portal data feed (store.banner.aero) for live stock/pricing", accountId: "", due: today(), done: false }],
    settings: { ...v13.settings, currentUserId: "" },
  };
}

/* v12 -> v13: refresh fleets with verified mid-2026 data + fleets for previously missing accounts */
function migrateV12(v12) {
  return {
    ...v12,
    accounts: (v12.accounts || []).map((a) => (FLEET_SEED[a.id] ? { ...a, fleet: FLEET_SEED[a.id] } : { fleet: [], ...a })),
    settings: { ...v12.settings, currentUserId: "" },
  };
}

/* v11 -> v12: Aircraft 360 — fleets on accounts, registry, AOG cases, ATA/PMA on catalog */
function migrateV11(v11) {
  return {
    ...v11,
    accounts: (v11.accounts || []).map((a) => ({ fleet: FLEET_SEED[a.id] || [], ...a })),
    catalog: (v11.catalog || []).map((p) => (V12_CAT_ATA[p.id] ? { ...p, ...V12_CAT_ATA[p.id] } : p)),
    aircraft: v11.aircraft || [],
    aogCases: v11.aogCases || [],
    settings: { ...v11.settings, currentUserId: "" },
  };
}

function migrateV10(v10) {
  return {
    ...v10,
    deals: (v10.deals || []).map((d) => ({ collectedAt: "", ...d })),
    settings: { ...v10.settings, currentUserId: "" },
  };
}

/* v9 -> v10: aviation quote format — PNs on catalog, condition/lead on lines, incoterms */
const V10_CAT_PATCH = {
  n1: { pn: "21435-00", name: "SID88 Low-Frequency ULB 8.8kHz (alt. for Dukane DK180)", unit: "EA", lead: "Stock" },
  n2: { pn: "22960-00", name: "BLUE90 ULB 37.5kHz (alt. for DK120/90)", unit: "EA", lead: "Stock" },
  n3: { pn: "18717-00", name: "GREEN90 Lithium-Free ULB 37.5kHz (alt. for DK120/90)", unit: "EA", lead: "Stock" },
  v1: { pn: "VA-2540-T01", name: "Hot Water Tank Assy (OEM 8921110G5)", unit: "EA", lead: "2-3 wks" },
  v2: { pn: "VA-2540-T02", name: "Hot Water Tank Assy (OEM 8921385G1)", unit: "EA", lead: "2-3 wks" },
  v3: { pn: "VA-2540-H01", name: "Cartridge Heater Assy (OEM 24D507239P01)", unit: "EA", lead: "2-3 wks" },
  v4: { pn: "VA-2540-H02", name: "Cartridge Heater Assy (OEM 24D507239P02)", unit: "EA", lead: "2-3 wks" },
  v5: { pn: "3E2534-VA", name: "Water Level Sensor Assy (OEM 3E2534)", unit: "EA", lead: "2-3 wks" },
  v6: { pn: "532T1-1M-140-VA", name: "Pressure Relief Valve (OEM 532T1-1M-140)", unit: "EA", lead: "2-3 wks" },
  v7: { pn: "24B508385P1-VA", name: "Temperature Sensor Probe (OEM 24B508385P1)", unit: "EA", lead: "2-3 wks" },
  o1: { pn: "OL-series", unit: "EA", lead: "Stock-4 wks" }, o2: { pn: "OL-series", unit: "EA", lead: "Stock-4 wks" }, o3: { pn: "OL-series", unit: "EA", lead: "Stock-4 wks" },
  o4: { pn: "OL-series", unit: "EA", lead: "Stock-4 wks" }, o5: { pn: "OL-series", unit: "EA", lead: "4-6 wks" }, o6: { pn: "OL-LED", unit: "EA", lead: "4-6 wks" },
  j1: { pn: "349-series", unit: "EA", lead: "4-7 wks" }, j2: { pn: "353-series", unit: "EA", lead: "4-7 wks" }, j3: { pn: "358-series", unit: "EA", lead: "4-7 wks" },
  j4: { pn: "Various", unit: "EA", lead: "4-7 wks" }, j5: { pn: "Custom", unit: "KIT", lead: "4-8 wks" }, j6: { pn: "Custom", unit: "EA", lead: "6-10 wks" },
  r1: { pn: "N/A", unit: "EVT", lead: "Per T/A" }, r2: { pn: "N/A", unit: "EVT", lead: "AOG" },
};
function migrateV9(v9) {
  return {
    ...v9,
    catalog: (v9.catalog || []).map((p) => (V10_CAT_PATCH[p.id] ? { ...p, ...V10_CAT_PATCH[p.id] } : { pn: p.pn || "TBD", ...p })),
    quotes: (v9.quotes || []).map((q) => ({
      incoterm: "EXW Hollywood, FL", attention: "", customerRef: "",
      ...q,
      lines: (q.lines || []).map((l) => ({ cond: "NE", leadTime: "", ...l })),
    })),
    settings: { ...v9.settings, currentUserId: "" },
  };
}

/* v8 -> v9: registrations, RFQ dates, stale tracking, loss reasons */
function migrateV8(v8) {
  return {
    ...v8,
    accounts: (v8.accounts || []).map((a) => ({ reg: { status: "Not started", submitted: "", expected: "", expiry: "", notes: "" }, ...a })),
    deals: (v8.deals || []).map((d) => ({ lastTouch: d.createdAt || today(), lossReason: "", lossNote: "", ...d })),
    quotes: (v8.quotes || []).map((q) => ({ rfqDate: "", sentAt: "", ...q })),
    settings: { ...v8.settings, currentUserId: "" },
  };
}

/* v7 -> v8: add payment terms to quotes and the terms approval matrix to settings */
function migrateV7(v7) {
  return {
    ...v7,
    quotes: (v7.quotes || []).map((q) => ({ paymentTerms: "Cash on Order", ...q })),
    settings: { ...v7.settings, termsMatrix: v7.settings?.termsMatrix || DEFAULT_TERMS_MATRIX, currentUserId: "" },
  };
}

/* v6 -> v7: add volume tiers to Novega catalog items */
const BULK_TIERS = { n1: { bulkQty: 10, bulkPrice: 4000 }, n2: { bulkQty: 10, bulkPrice: 950 }, n3: { bulkQty: 10, bulkPrice: 950 } };
function migrateV6(v6) {
  return {
    ...v6,
    catalog: (v6.catalog || []).map((p) => (BULK_TIERS[p.id] ? { ...p, ...BULK_TIERS[p.id] } : p)),
    settings: { ...v6.settings, currentUserId: "" },
  };
}

/* v5 -> v6: merge official account list & BD team into user data, swap in real catalog */
const normName = (s) => (s || "").toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter((w) => !["limited", "ltd", "company", "pty", "plc"].includes(w)).join(" ").trim();
function migrateV5(v5) {
  const oldSeedCatalogIds = new Set(["p1","p2","p3","p4","p5","p6","p7","p8","p9","p10","p11","p12"]);
  const userCatalogItems = (v5.catalog || []).filter((p) => !oldSeedCatalogIds.has(p.id));
  const catalog = [...SEED_CATALOG, ...userCatalogItems];
  const catIds = new Set(catalog.map((p) => p.id));

  const existing = [...(v5.accounts || [])];
  const byNorm = {};
  existing.forEach((a) => { byNorm[normName(a.name)] = a; });
  const accounts = [...existing];
  SEED_ACCOUNTS.forEach((na) => {
    const hit = byNorm[normName(na.name)];
    if (hit) { hit.ownerId = na.ownerId; hit.region = na.region; hit.country = hit.country || na.country; }
    else accounts.push(na);
  });

  const oldUsers = v5.users || [];
  const users = [...oldUsers.filter((u) => u.role !== "Territory Manager (BD)" || !SEED_USERS.some((su) => normName(su.name) === normName(u.name)))];
  SEED_USERS.forEach((su) => { if (!users.some((u) => u.id === su.id || normName(u.name) === normName(su.name))) users.push(su); });

  const quotes = (v5.quotes || []).map((q) => ({ ...q, lines: (q.lines || []).filter((l) => catIds.has(l.itemId)) })).filter((q) => q.lines.length > 0);

  return {
    ...v5,
    users, accounts, catalog, quotes,
    leads: (v5.leads || []).map((l) => ({ ownerId: "r0", ...l })),
    settings: { ...v5.settings, currentUserId: "" },
  };
}
const LEAD_STATUS_MAP = { New: "Unqualified", Working: "Unqualified", Disqualified: "Retired" };
function migrateV4(v4) {
  return {
    ...v4,
    settings: { ...v4.settings, currentUserId: "" },
    deals: (v4.deals || []).map((d) => ({ ...d, forecastCat: FCAT_MAP[d.forecastCat] || d.forecastCat })),
    leads: (v4.leads || []).map((l) => ({ rank: "Warm", ...l, status: LEAD_STATUS_MAP[l.status] || l.status })),
  };
}

function migrateV3(v3) {
  return {
    ...v3,
    catalog: SEED_CATALOG,
    quotes: SEED.quotes,
    settings: { ...v3.settings, thresholds: DEFAULT_THRESHOLDS, currentUserId: "" },
  };
}
function migrateV2(v2) {
  const users = (v2.reps || []).map((r, i) => ({
    id: r.id, name: r.name, region: r.region || "",
    role: r.id === "r0" || i === 0 ? "Area Director" : "Territory Manager (BD)",
  }));
  SEED_USERS.forEach((su) => { if (!users.some((u) => u.role === su.role && su.role !== "Territory Manager (BD)")) users.push({ ...su, id: users.some((u) => u.id === su.id) ? uid() : su.id }); });
  return migrateV3({
    users,
    settings: { monthlyQuota: v2.settings?.monthlyQuota ?? 300000, currentUserId: "" },
    leads: v2.leads || SEED.leads,
    accounts: v2.accounts || SEED.accounts,
    contacts: v2.contacts || SEED.contacts,
    deals: v2.deals || SEED.deals,
    activities: v2.activities || SEED.activities,
    interactions: v2.interactions || [],
  });
}
function migrateV1(v1) {
  return {
    reps: [{ id: "r0", name: "Zelealem M.J.", region: "" }],
    settings: { monthlyQuota: 300000 },
    leads: SEED.leads,
    accounts: (v1.accounts || SEED.accounts).map((a) => ({ ownerId: "r0", ...a })),
    contacts: v1.contacts || SEED.contacts,
    activities: v1.activities || SEED.activities,
    interactions: [],
    deals: (v1.deals || []).map((d) => ({
      id: d.id, name: d.name, accountId: d.accountId, ownerId: "r0",
      lines: [{ product: d.product, value: d.value }],
      stage: d.stage, prob: STAGE_PROB[d.stage] ?? 10, forecastCat: STAGE_FCAT[d.stage] || "Pipeline",
      closeDate: d.closeDate || "", notes: d.notes || "", createdAt: today(), closedAt: d.stage === "Won" || d.stage === "Lost" ? today() : "",
    })),
  };
}

/* ------------------------------ theme ----------------------------- */

const C = {
  bg: "#F4F6F8", surface: "#FFFFFF", line: "#DDE3E9",
  ink: "#15242F", sub: "#5A6B78", faint: "#8CA0AE",
  blue: "#14538C", blueDeep: "#0C3557", teal: "#0E6E6E",
  amber: "#B8720F", amberBg: "#FBF3E4",
  green: "#256E4E", greenBg: "#E7F3ED",
  red: "#A63A3A", redBg: "#F9ECEC",
};
const tierColor = { "Tier 1": C.amber, "Tier 2": C.teal, "Tier 3": C.faint };
const stageColor = { Prospect: C.faint, Contacted: "#6E88A0", "Meeting Held": C.teal, "Quote / RFQ": C.blue, Negotiation: C.amber, Won: C.green, Lost: C.red };
const fcatColor = { Omitted: C.faint, Pipeline: "#6E88A0", Upside: C.blue, Forecast: C.amber, Closed: C.green };
const leadColor = { Unqualified: "#6E88A0", Qualified: C.teal, Converted: C.green, Retired: C.faint };
const rankColor = { Hot: C.red, Warm: C.amber, Cool: C.faint };
const regColor = { "Not started": C.faint, "Docs submitted": "#6E88A0", "Under evaluation": C.blue, "Audit / site visit": C.amber, "PVL awarded": C.green, Expired: C.red };

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 14, color: C.ink, background: "#fff", fontFamily: "inherit" };

const Tag = ({ color, children }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: "#fff", background: color, whiteSpace: "nowrap" }}>{children}</span>
);

const Field = ({ label, children, flex }) => (
  <label style={{ display: "block", marginBottom: 12, flex: flex ? 1 : undefined }}>
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 4 }}>{label}</div>
    {children}
  </label>
);

const Btn = ({ onClick, kind = "primary", children, small }) => {
  const base = { border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: small ? 12 : 13, padding: small ? "5px 10px" : "9px 14px", display: "inline-flex", alignItems: "center", gap: 6 };
  const kinds = {
    primary: { background: C.blue, color: "#fff" },
    green: { background: C.green, color: "#fff" },
    amber: { background: C.amber, color: "#fff" },
    ghost: { background: "transparent", color: C.blue, border: `1px solid ${C.line}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.line}` },
  };
  return <button onClick={onClick} style={{ ...base, ...kinds[kind] }}>{children}</button>;
};

const IconBtn = ({ onClick, color = C.sub, title, children }) => (
  <button onClick={onClick} title={title} style={{ background: "none", border: "none", cursor: "pointer", color, padding: 4 }}>{children}</button>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(12,25,35,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
    <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: wide ? 680 : 480, maxHeight: "90vh", overflowY: "auto", padding: 20 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: C.ink }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub }}><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Card = ({ children, style }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, ...style }}>{children}</div>
);

const SectionTitle = ({ children, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.blueDeep }}>{children}</div>
    {right}
  </div>
);

/* ------------------------------- App ------------------------------ */

export default function BAICrmV15() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [regionFilter, setRegionFilter] = useState("All");
  const [saveState, setSaveState] = useState("");

  useEffect(() => {
    (async () => {
      for (const [key, mig] of [[KEY_V15, (x) => x], [KEY_V14, migrateV14], [KEY_V13, (x) => migrateV14(migrateV13(x))], [KEY_V12, (x) => migrateV14(migrateV13(migrateV12(x)))], [KEY_V11, (x) => migrateV14(migrateV13(migrateV12(migrateV11(x))))], [KEY_V10, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(x)))))], [KEY_V9, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(x))))))], [KEY_V8, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(x)))))))], [KEY_V7, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(x))))))))], [KEY_V6, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(x)))))))))], [KEY_V5, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(x))))))))))], [KEY_V4, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(x)))))))))))], [KEY_V3, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(x))))))))))))], [KEY_V2, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV2(x))))))))))))], [KEY_V1, (x) => migrateV14(migrateV13(migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV2(migrateV1(x)))))))))))))]]) {
        try {
          const res = await window.storage.get(key);
          if (res && res.value) {
            const d = mig(JSON.parse(res.value));
            setData(d);
            if (key !== KEY_V15) { try { await window.storage.set(KEY_V15, JSON.stringify(d)); } catch (e) {} }
            return;
          }
        } catch (e) { /* try next */ }
      }
      setData(SEED);
      try { await window.storage.set(KEY_V15, JSON.stringify(SEED)); } catch (e) { console.error(e); }
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    setSaveState("Saving…");
    try {
      await window.storage.set(KEY_V15, JSON.stringify(next));
      setSaveState("Saved");
      setTimeout(() => setSaveState(""), 1500);
    } catch (e) { setSaveState("Save failed — data kept in session"); }
  };

  if (!data) return <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 40, color: C.sub }}>Loading your pipeline…</div>;

  const { accounts, contacts, deals, activities, leads, users, interactions, settings, catalog, quotes, aircraft = [], aogCases = [], payouts = [] } = data;
  const thresholds = settings.thresholds || DEFAULT_THRESHOLDS;
  const termsMatrix = settings.termsMatrix || DEFAULT_TERMS_MATRIX;
  const me = users.find((u) => u.id === settings.currentUserId);

  /* ---------- sign-in ---------- */
  if (!me) {
    return (
      <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: C.blueDeep, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ textAlign: "center", color: "#fff", marginBottom: 24 }}>
            <Plane size={30} style={{ transform: "rotate(-45deg)" }} />
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>BAI Africa CRM</div>
            <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>Select your profile · Banner Aircraft International — founded 1994 · 150+ clients · 100+ airlines · 30+ countries</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, padding: 12 }}>
            {users.map((u) => (
              <button key={u.id} onClick={() => persist({ ...data, settings: { ...settings, currentUserId: u.id } })}
                style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, background: "none", border: "none", borderBottom: `1px solid ${C.bg}`, padding: "12px 10px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{ROLES[u.role]?.blurb}{u.region ? ` · ${u.region}` : ""}</div>
                </div>
                <Tag color={roleColorMap[u.role] || C.faint}>{u.role}</Tag>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
            Profiles simulate role-based access in this single-user app.<br />Real authentication requires a backend (e.g. Supabase Auth).
          </div>
        </div>
      </div>
    );
  }

  const perm = ROLES[me.role] || ROLES["Analyst"];
  const canEdit = perm.edit;
  const isAdmin = perm.admin;
  const canEditCatalog = isAdmin || !!perm.catalog; // Area Director, Analyst, Operations
  const canProcessPayouts = isAdmin || !!perm.finance; // Area Director, Finance
  const isApproverRole = APPROVAL_LEVELS.some((l) => l.role === me.role);
  const isBD = perm.scope === "region"; // BDs are scoped to the accounts they own (per region sheet)
  const roleOf = (uid_) => users.find((u) => u.id === uid_)?.role;
  /* No backend mail server here — this composes a mailto: draft to the approver's inferred
     banner.aero address (first.last@banner.aero) as an escalation NOTIFICATION INTENT.
     True automated send requires the Supabase backend discussed earlier. */
  const approverEmailOf = (role) => {
    const u = users.find((x) => x.role === role);
    if (!u) return null;
    return u.name.trim().toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).join(".") + "@banner.aero";
  };
  const notifyApprover = (role, q) => {
    const email = approverEmailOf(role);
    const acctName = acct(q.accountId)?.name || "";
    const subject = encodeURIComponent(`Approval needed — Quote ${q.number} (${acctName})`);
    const body = encodeURIComponent(
      `Quote ${q.number} for ${acctName} requires your approval as ${role}.\n\n` +
      `Discount: ${q.discountPct}%\nPayment terms: ${q.paymentTerms || "Cash on Order"}\nNet value: ${fmt(quoteNet(q))}\n\n` +
      `Please review and approve/reject in the Quotes tab of the CRM.\n— Sent from BAI Africa CRM approval workflow`
    );
    if (email) window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
    persist({ ...data, activities: [...data.activities, { id: uid(), text: `Approval escalation e-mailed to ${role}${email ? " (" + email + ")" : ""} — Quote ${q.number}`, accountId: q.accountId, due: today(), done: true }] });
  };

  const acct = (id) => accounts.find((a) => a.id === id);
  const userById = (id) => users.find((u) => u.id === id);
  const itemById = (id) => catalog.find((p) => p.id === id);
  const owners = users.filter((u) => OWNER_ROLES.includes(u.role));

  /* ---------- scoping: BDs see their own book of accounts; others filter by region ---------- */
  const acctOK = (a) => {
    if (isBD) return a ? a.ownerId === me.id : false;
    if (!a) return true;
    return regionFilter === "All" || a.region === regionFilter;
  };
  const vAccounts = accounts.filter(acctOK);
  const vDeals = deals.filter((d) => acctOK(acct(d.accountId)));
  const vLeads = isBD ? leads.filter((l) => l.ownerId === me.id) : leads.filter((l) => regionFilter === "All" || l.region === regionFilter);
  const vContacts = contacts.filter((c) => acctOK(acct(c.accountId)));
  const vActivities = activities.filter((t) => !t.accountId ? !isBD : acctOK(acct(t.accountId)));
  const vQuotes = quotes.filter((q) => acctOK(acct(q.accountId)));
  const vAircraft = aircraft.filter((x) => acctOK(acct(x.accountId)));
  const vAog = aogCases.filter((x) => acctOK(acct(x.accountId)));

  const pendingRoleOf = (q) => q.status === "Pending Approval" ? q.chain[q.approvals.filter((a) => a.decision === "Approved").length] : null;
  const myApprovalQueue = quotes.filter((q) => pendingRoleOf(q) === me.role);

  /* ---------- mutations ---------- */
  const guard = (fn) => (...args) => { if (!canEdit) return; fn(...args); };

  const upsert = (key, item) => {
    if (key === "deals") {
      item = { ...item, lastTouch: today() };
      const prev = data.deals.find((x) => x.id === item.id);
      const list = data.deals;
      const exists = list.some((x) => x.id === item.id);
      persist({ ...data, deals: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] });
      if (item.stage === "Meeting Held" && (!prev || prev.stage !== "Meeting Held")) setModal({ type: "meetingNote", dealId: item.id });
      else setModal(null);
      return;
    }
    const list = data[key];
    const exists = list.some((x) => x.id === item.id);
    persist({ ...data, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] });
    setModal(null);
  };
  const remove = guard((key, id) => {
    if (!window.confirm("Delete this record?")) return;
    let next = { ...data, [key]: data[key].filter((x) => x.id !== id) };
    if (key === "accounts") next = { ...next, deals: next.deals.filter((d) => d.accountId !== id), contacts: next.contacts.filter((c) => c.accountId !== id), interactions: next.interactions.filter((i) => i.accountId !== id), quotes: next.quotes.filter((q) => q.accountId !== id) };
    persist(next);
  });
  const setStage = guard((dealId, stage) => {
    const prev = deals.find((d) => d.id === dealId);
    persist({
      ...data,
      deals: deals.map((d) => d.id === dealId ? {
        ...d, stage,
        prob: STAGE_PROB[stage] ?? d.prob,
        forecastCat: STAGE_FCAT[stage] || d.forecastCat,
        closedAt: (stage === "Won" || stage === "Lost") ? (d.closedAt || today()) : "",
        lastTouch: today(),
      } : d),
    });
    if (stage === "Lost") setModal({ type: "lostReason", dealId });
    else if (stage === "Meeting Held" && prev && prev.stage !== "Meeting Held") setModal({ type: "meetingNote", dealId });
  });
  const toggleTask = guard((id) => persist({ ...data, activities: activities.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  /* Collection is a finance event — only the Area Director confirms it. Commission matures here. */
  const toggleCollected = (dealId) => {
    if (!isAdmin && !canProcessPayouts) return;
    persist({ ...data, deals: deals.map((d) => (d.id === dealId ? { ...d, collectedAt: d.collectedAt ? "" : today() } : d)) });
  };
  /* Cross-territory agreement — arranged by the Area Director between two BDs on one deal */
  const setAgreement = (dealId, agreement) => {
    if (!isAdmin) return;
    persist({ ...data, deals: deals.map((d) => (d.id === dealId ? { ...d, agreement } : d)) });
  };
  const recordPayout = (payout) => {
    if (!canProcessPayouts) return;
    persist({ ...data, payouts: [...payouts, { id: uid(), ...payout }] });
  };
  const setLeadStatus = guard((id, status) => persist({ ...data, leads: leads.map((l) => (l.id === id ? { ...l, status } : l)) }));
  const setLeadRank = guard((id, rank) => persist({ ...data, leads: leads.map((l) => (l.id === id ? { ...l, rank } : l)) }));

  const convertLead = guard((lead) => {
    const account = accounts.find((a) => a.id === lead.accountId);
    if (!account) return;
    let newContacts = contacts;
    if (!lead.contactId && lead.contactName) {
      newContacts = [...contacts, { id: uid(), name: lead.contactName, title: lead.title || "", accountId: account.id, email: "", phone: "", notes: `From lead conversion.` }];
    }
    const opp = {
      id: uid(), name: `${PRODUCTS[lead.product]?.short || lead.product} — ${account.name}`, accountId: account.id, ownerId: lead.ownerId || me.id,
      lines: [{ product: lead.product, value: Number(lead.est) || 0 }],
      stage: "Contacted", prob: 20, forecastCat: "Pipeline", closeDate: "", notes: lead.notes || "", createdAt: today(), closedAt: "", lastTouch: today(), meetingNotes: [], agreement: null,
    };
    persist({
      ...data, contacts: newContacts, deals: [...deals, opp],
      leads: leads.map((l) => (l.id === lead.id ? { ...l, status: "Converted" } : l)),
    });
    setTab("pipeline");
  });

  /* ---------- quote workflow ---------- */
  const updateQuote = (id, patch) => persist({ ...data, quotes: quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  const submitQuote = guard((q) => {
    if (!q.rfqDate) { alert("RFQ received date is mandatory before a quote can be submitted."); return; }
    const term = q.paymentTerms || "Cash on Order";
    const chain = chainForQuote(Number(q.discountPct) || 0, term, thresholds, termsMatrix);
    if (chain.length === 0) {
      updateQuote(q.id, { status: "Approved", chain: [], approvals: [{ role: "Auto", decision: "Approved", byName: "System", date: today(), comment: `Discount ${q.discountPct}% within standard discretion (≤${thresholds.ad}%) and terms "${term}" require no approval.` }] });
    } else {
      updateQuote(q.id, { status: "Pending Approval", chain, approvals: [] });
      notifyApprover(chain[0], q);
    }
  });

  const decideQuote = (q, decision) => {
    if (pendingRoleOf(q) !== me.role) return;
    let comment = "";
    if (decision === "Rejected") comment = window.prompt("Reason for rejection (shared with the owner):", "") || "";
    const approvals = [...q.approvals, { role: me.role, decision, byName: me.name, date: today(), comment }];
    if (decision === "Rejected") {
      updateQuote(q.id, { approvals, status: "Rejected" });
    } else {
      const approvedCount = approvals.filter((a) => a.decision === "Approved").length;
      const stillPending = approvedCount < q.chain.length;
      updateQuote(q.id, { approvals, status: stillPending ? "Pending Approval" : "Approved" });
      if (stillPending) notifyApprover(q.chain[approvedCount], { ...q, approvals });
    }
  };

  /* Oracle-style CRM<->CPQ sync: quote status drives the linked opportunity and order hand-off */
  const setQuoteStatus = (qid, status) => {
    if (!canEdit) return;
    const q = quotes.find((x) => x.id === qid);
    if (!q) return;
    let next = { ...data, quotes: quotes.map((x) => (x.id === qid ? { ...x, status, sentAt: status === "Sent" ? today() : x.sentAt } : x)) };
    if (q.oppId) {
      next = {
        ...next,
        deals: next.deals.map((d) => {
          if (d.id !== q.oppId) return d;
          if (status === "Sent" && STAGES.indexOf(d.stage) < STAGES.indexOf("Quote / RFQ")) {
            return { ...d, stage: "Quote / RFQ", prob: STAGE_PROB["Quote / RFQ"], forecastCat: STAGE_FCAT["Quote / RFQ"] };
          }
          if (status === "Accepted") {
            const byLine = {};
            (q.lines || []).forEach((l) => {
              const item = catalog.find((p) => p.id === l.itemId);
              const pl = item?.productLine || "Oshino Lamps";
              byLine[pl] = (byLine[pl] || 0) + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(q.discountPct) || 0) / 100);
            });
            return { ...d, stage: "Won", prob: 100, forecastCat: "Closed", closedAt: today(), lines: Object.entries(byLine).map(([product, value]) => ({ product, value: Math.round(value) })) };
          }
          return d;
        }),
      };
    }
    if (status === "Accepted") {
      next = { ...next, activities: [...next.activities, { id: uid(), text: `Raise sales order for ${q.number} — ${acct(q.accountId)?.name || ""} (order-to-cash hand-off)`, accountId: q.accountId, due: today(), done: false }] };
    }
    persist(next);
  };

  const signOut = () => persist({ ...data, settings: { ...settings, currentUserId: "" } });
  const resetAll = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Reset the CRM to the starter dataset? All changes will be lost.")) return;
    await persist(SEED);
  };

  const tabs = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["leads", "Leads", UserPlus],
    ["pipeline", "Opportunities", Target],
    ["quotes", `Quotes${myApprovalQueue.length ? ` (${myApprovalQueue.length})` : ""}`, FileText],
    ["products", "Products", Package],
    ["accounts", "Accounts", Building2],
    ["contacts", "Contacts", Users],
    ["actions", "Actions", CheckSquare],
    ["forecast", "Forecast", TrendingUp],
    ["insights", "Insights", BarChart3],
    ["commissions", "Commissions", DollarSign],
    ["a360", "Aircraft 360", Radar],
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: C.bg, minHeight: "100vh", color: C.ink }}>
      <style>{`
        select:focus, input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 1px; }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: ${C.sub}; padding: 8px 10px; border-bottom: 1px solid ${C.line}; }
        td { padding: 10px; border-bottom: 1px solid ${C.line}; font-size: 14px; vertical-align: top; }
        select:disabled { opacity: 0.7; cursor: not-allowed; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <header style={{ background: C.blueDeep, color: "#fff", padding: "14px 20px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Plane size={22} style={{ transform: "rotate(-45deg)" }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.02em" }}>BAI Africa CRM</div>
              <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase" }}>Banner Aircraft International · Africa Area</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ opacity: 0.8 }}>{saveState}</span>
            {myApprovalQueue.length > 0 && (
              <button onClick={() => setTab("quotes")} style={{ background: C.amber, border: "none", color: "#fff", borderRadius: 4, padding: "6px 9px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                {myApprovalQueue.length} awaiting your approval
              </button>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "5px 9px" }}>
              {canEdit ? null : <Eye size={12} />}
              <strong>{me.name}</strong>
              <Tag color={roleColorMap[me.role] || C.faint}>{me.role}</Tag>
            </span>
            {isBD ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid rgba(255,255,255,0.35)", borderRadius: 4, padding: "5px 9px" }}>
                <Lock size={12} /> My accounts{me.region ? ` · ${me.region}` : ""}
              </span>
            ) : (
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 12 }}>
                <option>All</option>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            )}
            {isAdmin && (
              <button onClick={() => setModal({ type: "team" })} title="Users & roles" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 4, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <Settings size={13} /> Users
              </button>
            )}
            {isAdmin && (
              <button onClick={resetAll} title="Reset to starter data" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 4, padding: "6px 8px", cursor: "pointer", fontSize: 12 }}>
                <RotateCcw size={13} />
              </button>
            )}
            <button onClick={signOut} title="Switch user" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 4, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <LogOut size={13} /> Switch
            </button>
          </div>
        </div>
      </header>

      {!canEdit && (
        <div style={{ background: C.amberBg, borderBottom: `1px solid ${C.line}`, padding: "8px 20px", fontSize: 12, color: C.amber, textAlign: "center", fontWeight: 600 }}>
          <Eye size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          View-only access — {me.role} can review all data{isApproverRole ? " and approve or reject quotes pending at their level" : ""}.
        </div>
      )}

      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", overflowX: "auto" }}>
          {tabs.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", cursor: "pointer", padding: "12px 13px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", color: tab === key ? C.blue : C.sub, borderBottom: tab === key ? `2px solid ${C.blue}` : "2px solid transparent", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 60px" }}>
        {tab === "dashboard" && <Dashboard deals={vDeals} leads={vLeads} activities={vActivities} quotes={vQuotes} accounts={vAccounts} acct={acct} userById={userById} setTab={setTab} />}
        {tab === "leads" && <Leads leads={vLeads} acct={acct} canEdit={canEdit} setStatus={setLeadStatus} setRank={setLeadRank} convert={convertLead} onAdd={() => setModal({ type: "lead" })} onEdit={(l) => setModal({ type: "lead", item: l })} onDelete={(id) => remove("leads", id)} />}
        {tab === "pipeline" && <Pipeline deals={vDeals} quotes={quotes} acct={acct} userById={userById} canEdit={canEdit} isAdmin={isAdmin} canProcessPayouts={canProcessPayouts} toggleCollected={toggleCollected} onAgreement={(d) => setModal({ type: "agreement", dealId: d.id })} setStage={setStage} onAdd={() => setModal({ type: "deal" })} onEdit={(d) => setModal({ type: "deal", item: d })} onDelete={(id) => remove("deals", id)} onQuote={(d) => setModal({ type: "quote", preset: { accountId: d.accountId, oppId: d.id } })} />}
        {tab === "quotes" && <Quotes quotes={vQuotes} me={me} canEdit={canEdit} thresholds={thresholds} isAdmin={isAdmin} acct={acct} userById={userById} itemById={itemById} pendingRoleOf={pendingRoleOf} decideQuote={decideQuote} submitQuote={submitQuote} setQuoteStatus={setQuoteStatus} termsMatrix={termsMatrix} onTermsMatrix={(m) => isAdmin && persist({ ...data, settings: { ...settings, termsMatrix: m } })} onAdd={() => setModal({ type: "quote" })} onEdit={(q) => setModal({ type: "quote", item: q })} onDelete={(id) => remove("quotes", id)} updateQuote={updateQuote} onThresholds={(th) => isAdmin && persist({ ...data, settings: { ...settings, thresholds: th } })} />}
        {tab === "products" && <Products catalog={catalog} isAdmin={canEditCatalog} onAdd={() => setModal({ type: "product" })} onEdit={(p) => setModal({ type: "product", item: p })} onDelete={(id) => remove("catalog", id)} />}
        {tab === "accounts" && <Accounts accounts={vAccounts} deals={deals} interactions={interactions} userById={userById} canEdit={canEdit} isAdmin={isAdmin} onAdd={() => setModal({ type: "account" })} onEdit={(a) => setModal({ type: "account", item: a })} onDelete={(id) => remove("accounts", id)} onLog={(a) => setModal({ type: "interaction", account: a })} onReg={(a) => setModal({ type: "reg", account: a })} />}
        {tab === "contacts" && <Contacts contacts={vContacts} acct={acct} canEdit={canEdit} onAdd={() => setModal({ type: "contact" })} onEdit={(c) => setModal({ type: "contact", item: c })} onDelete={(id) => remove("contacts", id)} />}
        {tab === "actions" && <Actions activities={vActivities} acct={acct} canEdit={canEdit} toggle={toggleTask} onAdd={() => setModal({ type: "activity" })} onDelete={(id) => remove("activities", id)} />}
        {tab === "forecast" && <Forecast deals={vDeals} settings={settings} isAdmin={isAdmin} userById={userById} users={users} isBD={isBD} me={me} onQuota={(q) => isAdmin && persist({ ...data, settings: { ...settings, monthlyQuota: q } })} />}
        {tab === "insights" && <Insights deals={vDeals} accounts={vAccounts} quotes={vQuotes} acct={acct} userById={userById} />}
        {tab === "commissions" && <Commissions deals={deals} users={users} me={me} isBD={isBD} isAdmin={isAdmin} canProcessPayouts={canProcessPayouts} payouts={payouts} roleOf={roleOf} onRecordPayout={(owner, defaultAmount) => setModal({ type: "payout", owner, defaultAmount })} />}
        {tab === "a360" && <Aircraft360 accounts={vAccounts} allAccounts={accounts} aircraft={vAircraft} aogCases={vAog} catalog={catalog} deals={vDeals} acct={acct} userById={userById} canEdit={canEdit} onAddAircraft={(preset) => setModal({ type: "aircraft", preset })} onEditAircraft={(x) => setModal({ type: "aircraft", item: x })} onDeleteAircraft={(id) => remove("aircraft", id)} onAddAog={() => setModal({ type: "aog" })} onEditAog={(x) => setModal({ type: "aog", item: x })} onDeleteAog={(id) => remove("aogCases", id)} setAogStatus={(id, status) => canEdit && persist({ ...data, aogCases: aogCases.map((c) => (c.id === id ? { ...c, status, closedAt: status === "Closed" ? today() : "" } : c)) })} />}
      </main>

      {canEdit && modal?.type === "deal" && <DealForm item={modal.item} accounts={isBD ? accounts.filter((a) => a.ownerId === me.id) : accounts} owners={owners} me={me} lockOwner={isBD} roleOf={roleOf} onSave={(d) => upsert("deals", d)} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "quote" && <QuoteForm item={modal.item} preset={modal.preset} accounts={isBD ? accounts.filter((a) => a.ownerId === me.id) : accounts} deals={deals} contacts={contacts} quotes={quotes} catalog={catalog} me={me} thresholds={thresholds} termsMatrix={termsMatrix} quoteCount={quotes.length} onSave={(q) => upsert("quotes", q)} onClose={() => setModal(null)} />}
      {canEditCatalog && modal?.type === "product" && <ProductForm item={modal.item} onSave={(p) => upsert("catalog", p)} onClose={() => setModal(null)} />}
      {(isAdmin || (canEdit && modal?.item)) && modal?.type === "account" && <AccountForm item={modal.item} owners={owners} me={me} lockOwner={isBD} onSave={(a) => upsert("accounts", a)} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "contact" && <ContactForm item={modal.item} accounts={isBD ? accounts.filter((a) => a.ownerId === me.id) : accounts} onSave={(c) => upsert("contacts", c)} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "activity" && <ActivityForm accounts={isBD ? accounts.filter((a) => a.ownerId === me.id) : accounts} onSave={(t) => upsert("activities", t)} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "lead" && <LeadForm item={modal.item} accounts={isBD ? accounts.filter((a) => a.ownerId === me.id) : accounts} contacts={contacts} onSave={(l) => upsert("leads", { ...l, ownerId: l.ownerId || me.id })} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "interaction" && <InteractionForm account={modal.account} onSave={(i) => upsert("interactions", i)} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "aircraft" && <AircraftForm item={modal.item} preset={modal.preset} accounts={isBD ? accounts.filter((a) => a.ownerId === me.id) : accounts} onSave={(x) => upsert("aircraft", x)} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "aog" && <AogForm item={modal.item} accounts={isBD ? accounts.filter((a) => a.ownerId === me.id) : accounts} me={me} onSave={(x) => upsert("aogCases", x)} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "meetingNote" && <MeetingNoteForm onSave={(note) => { persist({ ...data, deals: deals.map((d) => (d.id === modal.dealId ? { ...d, meetingNotes: [...(d.meetingNotes || []), note] } : d)) }); setModal(null); }} onClose={() => setModal(null)} />}
      {isAdmin && modal?.type === "agreement" && <AgreementForm deal={deals.find((d) => d.id === modal.dealId)} bds={users.filter((u) => u.role === "Territory Manager (BD)")} onSave={(agr) => { setAgreement(modal.dealId, agr); setModal(null); }} onClose={() => setModal(null)} />}
      {canProcessPayouts && modal?.type === "payout" && <PayoutForm owner={modal.owner} defaultAmount={modal.defaultAmount} onSave={(p) => { recordPayout(p); setModal(null); }} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "lostReason" && <LostReasonForm onSave={(reason, note) => { persist({ ...data, deals: deals.map((d) => (d.id === modal.dealId ? { ...d, lossReason: reason, lossNote: note } : d)) }); setModal(null); }} onClose={() => setModal(null)} />}
      {canEdit && modal?.type === "reg" && <RegForm account={modal.account} onSave={(reg) => upsert("accounts", { ...modal.account, reg })} onClose={() => setModal(null)} />}
      {isAdmin && modal?.type === "team" && <UsersForm users={users} onSave={(newUsers) => { persist({ ...data, users: newUsers }); setModal(null); }} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ---------------------------- Dashboard ---------------------------- */

function Dashboard({ deals, leads, activities, quotes, accounts, acct, userById, setTab }) {
  const open = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
  const won = deals.filter((d) => d.stage === "Won");
  const totals = {
    open: open.reduce((s, d) => s + dealValue(d), 0),
    weighted: open.reduce((s, d) => s + dealWeighted(d), 0),
    forecastCat: open.filter((d) => d.forecastCat === "Forecast").reduce((s, d) => s + dealValue(d), 0),
    commMatured: won.filter((d) => d.collectedAt).reduce((s, d) => s + dealCommission(d, userById ? userById(d.ownerId)?.role : undefined), 0),
    commPending: won.filter((d) => !d.collectedAt).reduce((s, d) => s + dealCommission(d, userById ? userById(d.ownerId)?.role : undefined), 0),
  };
  const pendingQuotes = quotes.filter((q) => q.status === "Pending Approval");
  const openLeads = leads.filter((l) => l.status !== "Converted" && l.status !== "Retired");
  const overdue = activities.filter((t) => !t.done && t.due && t.due < today());
  const nextActions = activities.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 5);

  const stageAgg = STAGES.filter((s) => s !== "Lost").map((s) => {
    const list = deals.filter((d) => d.stage === s);
    return { stage: s, count: list.length, value: list.reduce((sum, d) => sum + dealValue(d), 0) };
  });
  const maxVal = Math.max(...stageAgg.map((s) => s.value), 1);

  const kpi = (label, value, note, color, onClick) => (
    <Card style={{ padding: "14px 16px", flex: "1 1 180px", cursor: onClick ? "pointer" : "default" }}>
      <div onClick={onClick}>
        <div style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 23, fontWeight: 700, color: color || C.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        {note && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{note}</div>}
      </div>
    </Card>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {kpi("Open pipeline", fmt(totals.open), `${open.length} opportunities · ${openLeads.length} open leads`)}
        {kpi("Weighted pipeline", fmt(totals.weighted), "By win probability")}
        {kpi("Quotes in approval", pendingQuotes.length, pendingQuotes.length ? fmt(pendingQuotes.reduce((s, q) => s + quoteNet(q), 0)) + " net value" : "None pending", C.amber, () => setTab("quotes"))}
        {kpi("Matured commission", fmt(totals.commMatured), totals.commPending > 0 ? `${fmt(totals.commPending)} accrued, awaiting collection` : "Matures upon collection", C.green)}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Card style={{ padding: 16, flex: "2 1 380px" }}>
          <SectionTitle>Pipeline by stage</SectionTitle>
          {stageAgg.map((s) => (
            <div key={s.stage} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 100, fontSize: 12, color: C.sub, flexShrink: 0 }}>{s.stage}</div>
              <div style={{ flex: 1, background: C.bg, borderRadius: 3, height: 20 }}>
                <div style={{ width: `${(s.value / maxVal) * 100}%`, minWidth: s.value > 0 ? 4 : 0, height: "100%", background: stageColor[s.stage], borderRadius: 3, transition: "width .3s" }} />
              </div>
              <div style={{ width: 115, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {s.count > 0 ? `${fmt(s.value)} · ${s.count}` : "—"}
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ padding: 16, flex: "1 1 280px" }}>
          <SectionTitle right={overdue.length > 0 && <span style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>{overdue.length} overdue</span>}>Next actions</SectionTitle>
          {nextActions.length === 0 && <div style={{ fontSize: 13, color: C.faint }}>No open actions.</div>}
          {nextActions.map((t) => (
            <div key={t.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.bg}` }}>
              <div style={{ fontSize: 13 }}>{t.text}</div>
              <div style={{ fontSize: 11, color: t.due && t.due < today() ? C.red : C.faint, marginTop: 2 }}>
                {t.due ? `Due ${t.due}` : "No date"}{t.accountId && acct(t.accountId) ? ` · ${acct(t.accountId).name}` : ""}
              </div>
            </div>
          ))}
          <button onClick={() => setTab("actions")} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>View all actions →</button>
        </Card>
      </div>

      {/* Radar: hygiene, registrations, reorders */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        <Card style={{ padding: 16, flex: "1 1 260px" }}>
          <SectionTitle><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><AlertTriangle size={13} color={C.red} /> Stale deals ({">"}{STALE_DAYS}d)</span></SectionTitle>
          {(() => {
            const stale = open.filter((d) => d.lastTouch && daysBetween(d.lastTouch, today()) > STALE_DAYS).sort((a, b) => daysBetween(b.lastTouch, today()) - daysBetween(a.lastTouch, today())).slice(0, 5);
            if (stale.length === 0) return <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Pipeline is clean — every open deal touched inside {STALE_DAYS} days.</div>;
            return stale.map((d) => (
              <div key={d.id} style={{ fontSize: 12, marginBottom: 7 }}>
                <strong>{d.name}</strong> — {acct(d.accountId)?.name}
                <div style={{ fontSize: 11, color: C.red }}>{daysBetween(d.lastTouch, today())} days idle · {fmt(dealValue(d))}</div>
              </div>
            ));
          })()}
        </Card>
        <Card style={{ padding: 16, flex: "1 1 260px" }}>
          <SectionTitle><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><ShieldCheck size={13} color={C.red} /> Collections overdue</span></SectionTitle>
          {(() => {
            const overdue = won.filter((d) => !d.collectedAt).map((d) => {
              const linkedQ = quotes.find((q) => q.oppId === d.id && q.status === "Accepted");
              const expected = expectedCollectionDate(d, linkedQ);
              return { d, expected, days: expected ? daysBetween(expected, today()) : -1 };
            }).filter((x) => x.days > 0).sort((a, b) => b.days - a.days);
            if (overdue.length === 0) return <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>No overdue collections.</div>;
            return overdue.slice(0, 5).map(({ d, days }) => (
              <div key={d.id} style={{ fontSize: 12, marginBottom: 7 }}>
                <strong>{acct(d.accountId)?.name}</strong> — {d.name}
                <div style={{ fontSize: 11, color: C.red }}>{days}d overdue · {fmt(dealValue(d))} · {userById ? userById(d.ownerId)?.name : ""}</div>
              </div>
            ));
          })()}
        </Card>
        <Card style={{ padding: 16, flex: "1 1 260px" }}>
          <SectionTitle><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><ClipboardCheck size={13} color={C.amber} /> Vendor registrations</span></SectionTitle>
          {(() => {
            const regs = accounts.filter((a) => a.reg && !["Not started", "PVL awarded"].includes(a.reg.status));
            const awarded = accounts.filter((a) => a.reg?.status === "PVL awarded").length;
            if (regs.length === 0) return <div style={{ fontSize: 13, color: C.faint }}>No registrations in progress.{awarded ? ` ${awarded} awarded.` : ""}</div>;
            return regs.slice(0, 5).map((a) => (
              <div key={a.id} style={{ fontSize: 12, marginBottom: 7 }}>
                <strong>{a.name}</strong> <Tag color={regColor[a.reg.status]}>{a.reg.status}</Tag>
                <div style={{ fontSize: 11, color: C.faint }}>{a.reg.expected ? `Expected award: ${a.reg.expected}` : "No target date set"}</div>
              </div>
            ));
          })()}
        </Card>
        <Card style={{ padding: 16, flex: "1 1 260px" }}>
          <SectionTitle><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RefreshCw size={13} color={C.teal} /> Reorder radar</span></SectionTitle>
          {(() => {
            const suggestions = [];
            accounts.forEach((a) => {
              REORDER_LINES.forEach((line) => {
                const wonDates = deals.filter((d) => d.accountId === a.id && d.stage === "Won" && d.closedAt && (d.lines || []).some((l) => l.product === line)).map((d) => d.closedAt).sort();
                if (wonDates.length) {
                  const last = wonDates[wonDates.length - 1];
                  const days = daysBetween(last, today());
                  if (days > REORDER_DAYS) suggestions.push({ a, line, days });
                }
              });
            });
            suggestions.sort((x, y) => y.days - x.days);
            if (suggestions.length === 0) return <div style={{ fontSize: 13, color: C.faint }}>Populates as consumable orders close Won — flags accounts {">"}6 months since their last lamp, belt or ULB order.</div>;
            return suggestions.slice(0, 5).map((s, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 7 }}>
                <strong>{s.a.name}</strong> — {PRODUCTS[s.line]?.short}
                <div style={{ fontSize: 11, color: C.teal }}>Last order {Math.round(s.days / 30)} months ago — time to call.</div>
              </div>
            ));
          })()}
        </Card>
      </div>

      <div style={{ marginTop: 16, background: C.amberBg, border: `1px solid ${C.line}`, borderRadius: 6, padding: "12px 16px", fontSize: 13 }}>
        <strong style={{ color: C.amber }}>On the calendar:</strong>&nbsp; Aviation Africa Summit — Nairobi, September 2026 · AFRAA 58th AGA — Libreville, November 2026
      </div>
    </div>
  );
}

/* ------------------------------ Quotes ----------------------------- */

function Quotes({ quotes, me, canEdit, thresholds, isAdmin, acct, userById, itemById, pendingRoleOf, decideQuote, submitQuote, setQuoteStatus, termsMatrix, onTermsMatrix, onAdd, onEdit, onDelete, updateQuote, onThresholds }) {
  const [docQ, setDocQ] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showTh, setShowTh] = useState(false);
  const [thDraft, setThDraft] = useState(thresholds);
  const [tmDraft, setTmDraft] = useState(termsMatrix);

  const mine = quotes.filter((q) => pendingRoleOf(q) === me.role);
  const rest = quotes.filter((q) => pendingRoleOf(q) !== me.role);
  const ordered = [...mine, ...rest];

  const chainDisplay = (q) => {
    const approvedRoles = q.approvals.filter((a) => a.decision === "Approved").map((a) => a.role);
    const rejected = q.approvals.find((a) => a.decision === "Rejected");
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        {q.chain.length === 0 && <span style={{ fontSize: 11, color: C.faint }}>Auto (within discretion)</span>}
        {q.chain.map((role, i) => {
          const done = approvedRoles.includes(role);
          const isRejected = rejected?.role === role;
          const isPending = q.status === "Pending Approval" && pendingRoleOf(q) === role;
          const bg = isRejected ? C.red : done ? C.green : isPending ? C.amber : C.faint;
          return (
            <span key={role} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              {i > 0 && <span style={{ color: C.faint, fontSize: 10 }}>→</span>}
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: bg, borderRadius: 3, padding: "2px 6px", whiteSpace: "nowrap" }}>
                {done && <Check size={9} style={{ verticalAlign: "-1px", marginRight: 2 }} />}{role === "Territory Manager (BD)" ? "BD" : role}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: C.sub }}>
          Approvals: discount ≤{thresholds.ad}% auto · &gt;{thresholds.ad}% AD · &gt;{thresholds.coo}% +COO · &gt;{thresholds.ceo}% +CEO · &gt;{thresholds.president}% +President. Payment terms escalate separately (credit = risk) — the deeper requirement sets the chain.
          {isAdmin && <button onClick={() => { setThDraft(thresholds); setTmDraft(termsMatrix); setShowTh(!showTh); }} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginLeft: 6 }}>{showTh ? "Hide" : "Edit thresholds"}</button>}
        </div>
        {canEdit && <Btn onClick={onAdd}><Plus size={14} /> New quote</Btn>}
      </div>

      {isAdmin && showTh && (
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {APPROVAL_LEVELS.map((l) => (
              <Field key={l.key} label={`${l.role} above (%)`}>
                <input type="number" min="0" max="100" style={{ ...inputStyle, width: 90 }} value={thDraft[l.key]} onChange={(e) => setThDraft({ ...thDraft, [l.key]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, margin: "6px 0" }}>Payment terms approval matrix</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {PAYMENT_TERMS.map((t) => (
              <Field key={t} label={t}>
                <select style={{ ...inputStyle, width: 150 }} value={tmDraft[t] || "None (auto)"} onChange={(e) => setTmDraft({ ...tmDraft, [t]: e.target.value })}>
                  {TERMS_LEVEL_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            ))}
            <div style={{ marginBottom: 12 }}><Btn small onClick={() => { onThresholds(thDraft); onTermsMatrix(tmDraft); setShowTh(false); }}>Save matrix</Btn></div>
          </div>
          <div style={{ fontSize: 11, color: C.faint }}>Applies to newly submitted quotes. The chain runs sequentially to the deepest level required by either the discount or the payment terms.</div>
        </Card>
      )}

      {mine.length > 0 && (
        <div style={{ background: C.amberBg, border: `1px solid ${C.line}`, borderRadius: 6, padding: "10px 14px", marginBottom: 14, fontSize: 13, fontWeight: 600, color: C.amber }}>
          {mine.length} quote{mine.length > 1 ? "s" : ""} awaiting your approval as {me.role} — shown first below.
        </div>
      )}

      <Card style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th></th><th>Quote</th><th>Account</th><th>Owner</th><th>List value</th><th>Discount</th><th>Net value</th><th>Terms</th><th>Approval chain</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {ordered.length === 0 && <tr><td colSpan={11} style={{ color: C.faint, textAlign: "center", padding: 24 }}>No quotes in view. Build one from the catalog.</td></tr>}
            {ordered.map((q) => {
              const sub = quoteSubtotal(q);
              const net = quoteNet(q);
              const isExp = expanded === q.id;
              const myTurn = pendingRoleOf(q) === me.role;
              const isOwnerish = canEdit;
              return (
                <React.Fragment key={q.id}>
                  <tr style={myTurn ? { background: C.amberBg } : undefined}>
                    <td style={{ width: 30 }}>
                      <IconBtn onClick={() => setExpanded(isExp ? null : q.id)}>{isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</IconBtn>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{q.number}</div>
                      <div style={{ fontSize: 11, color: C.faint }}>{q.createdAt}</div>
                      {q.rfqDate && q.sentAt && <div style={{ fontSize: 10, color: daysBetween(q.rfqDate, q.sentAt) <= 2 ? C.green : C.amber, fontWeight: 700 }}>RFQ→quote: {daysBetween(q.rfqDate, q.sentAt)}d</div>}
                      {q.rfqDate && !q.sentAt && q.status !== "Accepted" && q.status !== "Declined" && <div style={{ fontSize: 10, color: daysBetween(q.rfqDate, today()) > 3 ? C.red : C.faint }}>RFQ open {daysBetween(q.rfqDate, today())}d</div>}
                    </td>
                    <td>{acct(q.accountId)?.name || "—"}</td>
                    <td style={{ fontSize: 13 }}>{userById(q.ownerId)?.name || "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(sub)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: q.discountPct > thresholds.ad ? C.amber : C.ink }}>{q.discountPct}%</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(net)}</td>
                    <td style={{ fontSize: 12, color: (q.paymentTerms || "").startsWith("Net") ? C.amber : C.sub, fontWeight: 600, whiteSpace: "nowrap" }}>{q.paymentTerms || "Cash on Order"}</td>
                    <td>{chainDisplay(q)}</td>
                    <td><Tag color={quoteStatusColor[q.status]}>{q.status}</Tag></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {myTurn && (
                        <>
                          <Btn small kind="green" onClick={() => decideQuote(q, "Approved")}><Check size={12} /> Approve</Btn>{" "}
                          <Btn small kind="danger" onClick={() => decideQuote(q, "Rejected")}>Reject</Btn>
                        </>
                      )}
                      {isOwnerish && q.status === "Draft" && (
                        <>
                          <Btn small onClick={() => submitQuote(q)}><Send size={12} /> Submit</Btn>{" "}
                          <IconBtn onClick={() => onEdit(q)}><Pencil size={14} /></IconBtn>
                          <IconBtn onClick={() => onDelete(q.id)} color={C.red}><Trash2 size={14} /></IconBtn>
                        </>
                      )}
                      {isOwnerish && q.status === "Rejected" && (
                        <Btn small kind="ghost" onClick={() => updateQuote(q.id, { status: "Draft", chain: [], approvals: [] })}>Revise</Btn>
                      )}
                      {isOwnerish && q.status === "Approved" && (
                        <Btn small onClick={() => setQuoteStatus(q.id, "Sent")}><Send size={12} /> Mark sent</Btn>
                      )}
                      {isOwnerish && q.status === "Sent" && (
                        <>
                          <Btn small kind="green" onClick={() => setQuoteStatus(q.id, "Accepted")}>Accepted</Btn>{" "}
                          <Btn small kind="danger" onClick={() => setQuoteStatus(q.id, "Declined")}>Declined</Btn>
                        </>
                      )}
                      {["Approved", "Sent", "Accepted"].includes(q.status) && (
                        <IconBtn title="Quote document" onClick={() => setDocQ(q)} color={C.blue}><Copy size={14} /></IconBtn>
                      )}
                    </td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={11} style={{ background: C.bg }}>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "4px 6px" }}>
                          <div style={{ flex: "2 1 320px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>Line items</div>
                            {(q.lines || []).map((l, i) => {
                              const item = itemById(l.itemId);
                              return (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, gap: 10 }}>
                                  <span>{item?.name || "Unknown item"} <span style={{ color: C.faint, fontSize: 11 }}>({item?.productLine ? PRODUCTS[item.productLine]?.short : "—"})</span></span>
                                  <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{l.qty} × {fmt2(l.unitPrice)} = <strong>{fmt(l.qty * l.unitPrice)}</strong></span>
                                </div>
                              );
                            })}
                            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                              <span>Subtotal {fmt(sub)} · Discount −{fmt(sub - net)} ({q.discountPct}%)</span>
                              <strong>Net {fmt(net)}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: C.teal, marginTop: 4 }}>Commission on net: {fmt(quoteCommission(q, itemById))}</div>
                            {q.notes && <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{q.notes}</div>}
                          </div>
                          <div style={{ flex: "1 1 240px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>Approval log</div>
                            {q.approvals.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>No decisions yet.</div>}
                            {q.approvals.map((a, i) => (
                              <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>
                                <strong style={{ color: a.decision === "Approved" ? C.green : C.red }}>{a.decision}</strong> — {a.role} ({a.byName}), {a.date}
                                {a.comment && <div style={{ color: C.sub, marginTop: 1 }}>"{a.comment}"</div>}
                              </div>
                            ))}
                            {q.status === "Pending Approval" && <div style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>Awaiting: {pendingRoleOf(q)}</div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {docQ && (
        <QuoteDocModal q={docQ} acct={acct} userById={userById} itemById={itemById} onClose={() => setDocQ(null)} />
      )}
    </div>
  );
}

/* ------------------- native PDF generation (no libs) ---------------- */

const PDF_REPL = { "\u2014": "-", "\u2013": "-", "\u00B7": "|", "\u2022": "*", "\u2248": "~", "\u20AC": "EUR ", "\u2192": "->", "\u00D7": "x", "\u2264": "<=", "\u2265": ">=", "\u2019": "'", "\u2018": "'", "\u201C": '"', "\u201D": '"', "\u00A0": " ", "\u00E9": "e", "\u00E8": "e", "\u00C9": "E" };
const pdfAscii = (s) => String(s ?? "").split("").map((ch) => (ch.charCodeAt(0) < 127 ? ch : (PDF_REPL[ch] ?? "?"))).join("");
const pdfEsc = (s) => pdfAscii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const pdfWrap = (s, max) => {
  const words = pdfAscii(s).split(" ");
  const out = []; let cur = "";
  words.forEach((w) => { if ((cur + " " + w).trim().length > max) { if (cur.trim()) out.push(cur.trim()); cur = w; } else cur += " " + w; });
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [""];
};

/* Aviation-industry standard terms & conditions of sale */
const quoteTerms = (term, incoterm) => [
  `1. VALIDITY: This quotation is valid for 30 days from date of issue. All offers are subject to prior sale and stock availability at time of order.`,
  `2. PRICES: All prices are in US Dollars, exclusive of taxes, duties, bank charges and freight unless otherwise stated.`,
  `3. DELIVERY: ${incoterm}, Incoterms 2020. Quoted lead times are estimates from receipt of purchase order and are not guaranteed.`,
  `4. PAYMENT: ${term}. Overdue balances may accrue interest at 1.5% per month or the maximum permitted by law.`,
  `5. CERTIFICATION & TRACEABILITY: Material is supplied with FAA 8130-3, EASA Form 1, or Certificate of Conformance as applicable, with full back-to-birth or last-operator trace where stated.`,
  `6. WARRANTY: Manufacturer's warranty is passed through to Buyer (Anjou Aeronautique products: 36 months). Repaired units are warranted per the repair station's teardown report.`,
  `7. RETURNS: No returns accepted without prior written RMA authorization. Returned material must be in original condition with certification intact; a restocking fee may apply.`,
  `8. EXPORT CONTROL: Sale is subject to U.S. Export Administration Regulations (EAR) and, where applicable, ITAR. Buyer is responsible for end-use and end-user compliance and shall not re-export contrary to U.S. law.`,
  `9. AOG SUPPORT: 24/7/365 AOG desk — sales@banner.aero / +1 (855) 822-6637.`,
  `10. GOVERNING LAW: This quotation and any resulting order are governed by the laws of the State of Florida, USA. Banner Aircraft International standard conditions of sale apply.`,
];

function buildQuotePdf({ q, a, owner, itemById, sub, net, term, validUntil }) {
  const NAVY = "0.047 0.208 0.341", TEAL = "0.243 0.788 0.690", INK = "0.082 0.141 0.184", GRAY = "0.353 0.420 0.471", RED = "0.651 0.227 0.227", LINE = "0.855 0.886 0.914";
  const ops = [];
  const R = (x, y, w, h, c) => ops.push(`${c} rg ${x} ${y} ${w} ${h} re f`);
  const L = (x1, y1, x2, y2, c, wd = 0.8) => ops.push(`${c} RG ${wd} w ${x1} ${y1} m ${x2} ${y2} l S`);
  const T = (x, y, s, size, bold, c) => ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${c} rg 1 0 0 1 ${x} ${y} Tm (${pdfEsc(s)}) Tj ET`);
  const TR = (right, y, s, size, bold, c) => T(right - pdfAscii(s).length * size * 0.5, y, s, size, bold, c);
  const incoterm = q.incoterm || "EXW Hollywood, FL";

  // letterhead
  R(0, 726, 612, 66, NAVY);
  T(36, 764, "BANNER AIRCRAFT INTERNATIONAL", 14, true, "1 1 1");
  T(36, 749, "A I R W O R T H I N E S S   S U P P O R T   E X P E R T S", 6.5, false, TEAL);
  T(36, 737, "2252 Hayes St, Hollywood, FL 33020, USA | sales@banner.aero | +1 (855) 822-6637", 6.5, false, "0.75 0.83 0.89");
  TR(576, 762, "QUOTATION", 15, true, "1 1 1");
  TR(576, 747, q.number, 10, true, TEAL);
  TR(576, 735, `Date: ${q.createdAt}  Valid until: ${validUntil}`, 7, false, "0.75 0.83 0.89");

  // reference block
  let y = 704;
  const meta = [
    ["TO", `${a?.name || "-"}${a?.country ? ", " + a.country : ""}`],
    ["ATTENTION", q.attention || "-"],
    ["YOUR REF / RFQ", q.customerRef || "-"],
    ["DELIVERY", `${incoterm} (Incoterms 2020)`],
    ["PAYMENT TERMS", term],
    ["PREPARED BY", `${owner?.name || "-"}, Africa Area`],
  ];
  meta.forEach(([k, v]) => { T(36, y, k, 6.5, true, GRAY); T(130, y, v, 9, k === "TO", INK); y -= 13; });

  // certification banner
  y -= 4;
  R(36, y - 5, 540, 15, "0.905 0.953 0.929");
  T(42, y - 1, "All material supplied with FAA 8130-3 / EASA Form 1 dual release or Certificate of Conformance as applicable, with full traceability.", 7, true, "0.145 0.431 0.306");
  y -= 24;

  // table header
  T(36, y, "PART NUMBER", 6.5, true, GRAY); T(128, y, "DESCRIPTION", 6.5, true, GRAY);
  TR(352, y, "CD", 6.5, true, GRAY); TR(384, y, "QTY", 6.5, true, GRAY); TR(416, y, "UOM", 6.5, true, GRAY);
  TR(470, y, "LEAD TIME", 6.5, true, GRAY); TR(522, y, "UNIT USD", 6.5, true, GRAY); TR(576, y, "EXT USD", 6.5, true, GRAY);
  L(36, y - 4, 576, y - 4, NAVY, 1.3); y -= 16;

  (q.lines || []).forEach((l) => {
    if (y < 330) return; // reserve the lower page for totals + bottom-anchored T&Cs
    const it = itemById(l.itemId);
    const descLines = pdfWrap(it?.name || "Item", 40);
    T(36, y, it?.pn || "-", 7.5, true, INK);
    descLines.forEach((dl, di) => T(128, y - di * 9.5, dl, 8, false, INK));
    TR(352, y, l.cond || "NE", 8, false, INK);
    TR(384, y, String(l.qty), 8, false, INK);
    TR(416, y, it?.unit || "EA", 8, false, INK);
    TR(470, y, l.leadTime || it?.lead || "-", 7.5, false, INK);
    TR(522, y, fmt2(l.unitPrice).replace("$", ""), 8, false, INK);
    TR(576, y, fmt(l.qty * l.unitPrice).replace("$", ""), 8, true, INK);
    y -= Math.max(descLines.length * 9.5, 10) + 8;
    L(36, y + 5, 576, y + 5, LINE, 0.5);
  });

  // totals
  y -= 6;
  TR(500, y, "Subtotal", 8.5, false, GRAY); TR(576, y, fmt(sub).replace("$", ""), 8.5, false, INK); y -= 12;
  TR(500, y, `Discount (${q.discountPct}%)`, 8.5, false, GRAY); TR(576, y, "-" + fmt(sub - net).replace("$", ""), 8.5, false, RED); y -= 5;
  L(450, y, 576, y, NAVY, 1.1); y -= 12;
  TR(500, y, "TOTAL (USD)", 10.5, true, INK); TR(576, y, fmt(net).replace("$", ""), 10.5, true, INK); y -= 12;
  T(36, y, pdfAscii(COND_LEGEND), 6, false, GRAY); y -= 16;

  // T&Cs — anchored to the bottom of the page, just above the footer
  const approvedBy = (q.approvals || []).filter((x) => x.decision === "Approved" && x.role !== "Auto");
  const tcWrapped = [];
  quoteTerms(term, incoterm).forEach((clause) => { pdfWrap(clause, 134).forEach((ln) => tcWrapped.push(ln)); });
  const authLine = approvedBy.length ? "Authorised: " + approvedBy.map((x) => `${x.byName} (${x.role}, ${x.date})`).join(" | ") : null;
  const tcHeight = 14 + tcWrapped.length * 7.4 + (authLine ? 10 : 0);
  const tcTop = 60 + tcHeight; // footer rule sits at y=52
  L(36, tcTop + 8, 576, tcTop + 8, LINE, 0.6);
  T(36, tcTop, "TERMS AND CONDITIONS OF SALE", 6.8, true, NAVY);
  let yy = tcTop - 11;
  tcWrapped.forEach((ln) => { T(36, yy, ln, 6, false, GRAY); yy -= 7.4; });
  if (authLine) { yy -= 2; T(36, yy, authLine, 6, true, GRAY); }

  // footer
  L(36, 52, 576, 52, LINE);
  T(36, 40, "Banner Aircraft International | www.banner.aero | ASA member | ISO 9001", 6.5, false, GRAY);
  TR(576, 40, `${q.number} | Page 1 of 1`, 6.5, false, GRAY);

  const stream = ops.join("\n");
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { pdf += String(off).padStart(10, "0") + " 00000 n \n"; });
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;
  return pdf;
}

function QuoteDocModal({ q, acct, userById, itemById, onClose }) {
  const a = acct(q.accountId);
  const owner = userById(q.ownerId);
  const sub = quoteSubtotal(q);
  const net = quoteNet(q);
  const disc = sub - net;
  const term = q.paymentTerms || "Cash on Order";
  const incoterm = q.incoterm || "EXW Hollywood, FL";
  const approvedBy = (q.approvals || []).filter((x) => x.decision === "Approved" && x.role !== "Auto");
  const validUntil = (() => { const d = new Date(q.createdAt || today()); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  const downloadPdf = () => {
    try {
      const pdf = buildQuotePdf({ q, a, owner, itemById, sub, net, term, validUntil });
      const bytes = new Uint8Array(pdf.length);
      for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = `${q.number}_Banner_Quotation.pdf`;
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { console.error("PDF generation failed", e); }
  };

  const th = { textAlign: "left", fontSize: 9, letterSpacing: "0.07em", textTransform: "uppercase", color: "#5A6B78", padding: "5px 6px", borderBottom: "2px solid #0C3557", whiteSpace: "nowrap" };
  const td = { padding: "6px", borderBottom: "1px solid #E4E9EE", fontSize: 11.5, verticalAlign: "top" };
  const metaLabel = { fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A6B78" };
  const metaVal = { fontSize: 12, fontWeight: 600, color: "#15242F" };

  return (
    <Modal title={`Quotation — ${q.number}`} onClose={onClose} wide>
      <div style={{ border: "1px solid #DDE3E9", borderRadius: 6, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column", minHeight: 640 }}>
        {/* letterhead */}
        <div style={{ background: "#0C3557", color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Plane size={24} style={{ transform: "rotate(-45deg)", color: "#3EC9B0" }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.05em" }}>BANNER AIRCRAFT INTERNATIONAL</div>
              <div style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#3EC9B0" }}>Airworthiness Support Experts</div>
              <div style={{ fontSize: 9, color: "#BFD3E4", marginTop: 2 }}>2252 Hayes St, Hollywood, FL 33020, USA · sales@banner.aero · +1 (855) 822-6637</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.06em" }}>QUOTATION</div>
            <div style={{ fontSize: 12, color: "#3EC9B0", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{q.number}</div>
            <div style={{ fontSize: 10, color: "#BFD3E4" }}>Date {q.createdAt} · Valid until {validUntil}</div>
          </div>
        </div>

        {/* reference block */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, padding: "12px 18px", borderBottom: "1px solid #E4E9EE" }}>
          <div><div style={metaLabel}>To</div><div style={metaVal}>{a?.name || "—"}{a?.country ? `, ${a.country}` : ""}</div></div>
          <div><div style={metaLabel}>Attention</div><div style={metaVal}>{q.attention || "—"}</div></div>
          <div><div style={metaLabel}>Your ref / RFQ</div><div style={metaVal}>{q.customerRef || "—"}</div></div>
          <div><div style={metaLabel}>Delivery</div><div style={metaVal}>{incoterm}</div></div>
          <div><div style={metaLabel}>Payment terms</div><div style={{ ...metaVal, color: "#B8720F" }}>{term}</div></div>
        </div>

        {/* certification banner */}
        <div style={{ background: "#E7F3ED", padding: "7px 18px", fontSize: 10.5, fontWeight: 700, color: "#256E4E" }}>
          All material supplied with FAA 8130-3 / EASA Form 1 dual release or Certificate of Conformance as applicable, with full traceability.
        </div>

        {/* line items — aviation columns */}
        <div style={{ padding: "4px 18px 0", overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>
              <th style={th}>Part Number</th><th style={th}>Description</th><th style={th}>CD</th>
              <th style={{ ...th, textAlign: "right" }}>Qty</th><th style={th}>UOM</th><th style={th}>Lead Time</th>
              <th style={{ ...th, textAlign: "right" }}>Unit USD</th><th style={{ ...th, textAlign: "right" }}>Ext USD</th>
            </tr></thead>
            <tbody>
              {(q.lines || []).map((l, i) => {
                const it = itemById(l.itemId);
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{it?.pn || "—"}</td>
                    <td style={td}>
                      <div>{it?.name || "Item"}</div>
                      <div style={{ fontSize: 9.5, color: "#8CA0AE" }}>{it?.productLine}</div>
                    </td>
                    <td style={td}>{l.cond || "NE"}</td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.qty}</td>
                    <td style={td}>{it?.unit || "EA"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{l.leadTime || it?.lead || "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt2(l.unitPrice)}</td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(l.qty * l.unitPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* totals + legend */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "8px 18px", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, color: "#8CA0AE", maxWidth: 300 }}>{COND_LEGEND}</div>
          <div style={{ width: 250 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}><span style={{ color: "#5A6B78" }}>Subtotal</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(sub)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}><span style={{ color: "#5A6B78" }}>Discount ({q.discountPct}%)</span><span style={{ fontVariantNumeric: "tabular-nums", color: "#A63A3A" }}>−{fmt(disc)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 800, padding: "5px 0", borderTop: "2px solid #0C3557", marginTop: 3 }}><span>Total (USD)</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(net)}</span></div>
          </div>
        </div>

        {/* T&Cs — pinned to the bottom of the sheet */}
        <div style={{ padding: "10px 18px 12px", marginTop: "auto", borderTop: "1px solid #E4E9EE" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: "#0C3557", marginBottom: 4 }}>TERMS AND CONDITIONS OF SALE</div>
          {quoteTerms(term, incoterm).map((t, i) => (
            <div key={i} style={{ fontSize: 9.5, color: "#5A6B78", lineHeight: 1.45, marginBottom: 2 }}>{t}</div>
          ))}
          {approvedBy.length > 0 && (
            <div style={{ fontSize: 9.5, color: "#5A6B78", marginTop: 5 }}><strong>Authorised:</strong> {approvedBy.map((x) => `${x.byName} (${x.role}, ${x.date})`).join(" · ")}</div>
          )}
        </div>
        <div style={{ background: "#F4F6F8", borderTop: "1px solid #E4E9EE", padding: "9px 18px", fontSize: 10, color: "#5A6B78", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span>Banner Aircraft International · www.banner.aero · ASA member · ISO 9001</span>
          <span>{q.number} · Page 1 of 1</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: C.faint }}>Final document — approved quotes are issued as PDF only. Internal commission figures are excluded.</div>
        <Btn onClick={downloadPdf}><Download size={14} /> Download PDF</Btn>
      </div>
    </Modal>
  );
}

/* ----------------------------- Products ---------------------------- */

function Products({ catalog, isAdmin, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, color: C.sub }}>Real Banner portfolio from official materials and banner.aero. Novega ULBs carry published USD pricing; other lines are POA — the live stock catalogue sits behind the customer portal (store.banner.aero), so enter quoted prices per line. Tooling & Calibration commission rate is TBC with BAI.</div>
        {isAdmin && <Btn onClick={onAdd}><Plus size={14} /> New item</Btn>}
      </div>
      {Object.keys(PRODUCTS).map((line) => {
        const items = catalog.filter((p) => p.productLine === line);
        if (items.length === 0) return null;
        return (
          <div key={line} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.teal, marginBottom: 8 }}>
              {line}
            </div>
            <Card style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>Part No.</th><th>Description</th><th>UOM</th><th>Lead time</th><th>List price</th>{isAdmin && <th></th>}</tr></thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: 13, whiteSpace: "nowrap" }}>{p.pn || "—"}</td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ fontSize: 13, color: C.sub }}>{p.unit}</td>
                      <td style={{ fontSize: 13, color: C.sub }}>{p.lead || "—"}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.listPrice > 0 ? fmt2(p.listPrice) : <span style={{ color: C.faint }}>POA — quoted per RFQ</span>}</td>
                      {isAdmin && (
                        <td style={{ whiteSpace: "nowrap" }}>
                          <IconBtn onClick={() => onEdit(p)}><Pencil size={14} /></IconBtn>
                          <IconBtn onClick={() => onDelete(p.id)} color={C.red}><Trash2 size={14} /></IconBtn>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Leads ------------------------------ */

function Leads({ leads, acct, canEdit, setStatus, setRank, convert, onAdd, onEdit, onDelete }) {
  const sorted = [...leads].sort((a, b) => LEAD_STATUSES.indexOf(a.status) - LEAD_STATUSES.indexOf(b.status));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, color: C.sub }}>Oracle lead progression: Unqualified → Qualified → Convert (creates account, contact & opportunity). Dead leads are Retired. Rank by heat: Hot / Warm / Cool.</div>
        {canEdit && <Btn onClick={onAdd}><Plus size={14} /> New lead</Btn>}
      </div>
      <Card style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Company</th><th>Contact</th><th>Source</th><th>Region</th><th>Product interest</th><th>Est. value</th><th>Rank</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={9} style={{ color: C.faint, textAlign: "center", padding: 24 }}>No leads in view.</td></tr>}
            {sorted.map((l) => (
              <tr key={l.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{acct(l.accountId)?.name || l.company || "—"}</div>
                  {l.notes && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{l.notes}</div>}
                </td>
                <td style={{ fontSize: 13 }}>{l.contactName || "—"}{l.title ? <div style={{ fontSize: 11, color: C.faint }}>{l.title}</div> : null}</td>
                <td style={{ fontSize: 12, color: C.sub }}>{l.source}</td>
                <td style={{ fontSize: 12, color: C.sub }}>{acct(l.accountId)?.region || l.region || "—"}</td>
                <td style={{ fontSize: 12, color: C.sub }}>{PRODUCTS[l.product]?.short || l.product}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{l.est ? fmt(l.est) : "—"}</td>
                <td>
                  {canEdit ? (
                    <select value={l.rank || "Warm"} onChange={(e) => setRank(l.id, e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "4px 6px", borderColor: rankColor[l.rank || "Warm"], color: rankColor[l.rank || "Warm"], fontWeight: 600 }}>
                      {LEAD_RANKS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  ) : <Tag color={rankColor[l.rank || "Warm"]}>{l.rank || "Warm"}</Tag>}
                </td>
                <td>
                  {canEdit ? (
                    <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value)} disabled={l.status === "Converted"} style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "4px 6px", borderColor: leadColor[l.status], color: leadColor[l.status], fontWeight: 600 }}>
                      {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : <Tag color={leadColor[l.status]}>{l.status}</Tag>}
                </td>
                {canEdit && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.status === "Qualified" && <Btn small kind="green" onClick={() => convert(l)}>Convert <ArrowRight size={12} /></Btn>}
                    <IconBtn onClick={() => onEdit(l)}><Pencil size={14} /></IconBtn>
                    <IconBtn onClick={() => onDelete(l.id)} color={C.red}><Trash2 size={14} /></IconBtn>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------------------- Opportunities ------------------------- */

function Pipeline({ deals, quotes, acct, userById, canEdit, isAdmin, canProcessPayouts, toggleCollected, onAgreement, setStage, onAdd, onEdit, onDelete, onQuote }) {
  const [stageFilter, setStageFilter] = useState("All");
  const [fcatFilter, setFcatFilter] = useState("All");

  const list = deals
    .filter((d) => (stageFilter === "All" ? true : d.stage === stageFilter))
    .filter((d) => (fcatFilter === "All" ? true : d.forecastCat === fcatFilter))
    .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Filter size={14} color={C.sub} />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "6px 8px" }}>
            <option>All</option>{STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={fcatFilter} onChange={(e) => setFcatFilter(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "6px 8px" }}>
            <option>All</option>{FORECAST_CATS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        {canEdit && <Btn onClick={onAdd}><Plus size={14} /> New opportunity</Btn>}
      </div>

      <Card style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Opportunity</th><th>Account</th><th>Revenue lines</th><th>Value</th><th>Win %</th><th>Commission</th><th>Stage</th><th>Forecast</th><th>Close</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={10} style={{ color: C.faint, textAlign: "center", padding: 24 }}>No opportunities in view.</td></tr>}
            {list.map((d) => (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{userById(d.ownerId)?.name || "Unassigned"}</div>
                  {d.stage !== "Won" && d.stage !== "Lost" && d.lastTouch && daysBetween(d.lastTouch, today()) > STALE_DAYS && (
                    <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}><AlertTriangle size={10} /> Stale — {daysBetween(d.lastTouch, today())}d since last touch</div>
                  )}
                  {d.stage === "Lost" && d.lossReason && (
                    <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>Lost: {d.lossReason}</div>
                  )}
                  {d.stage === "Won" && (() => {
                    const canToggle = isAdmin || canProcessPayouts;
                    const linkedQ = quotes.find((q) => q.oppId === d.id && q.status === "Accepted");
                    const expected = expectedCollectionDate(d, linkedQ);
                    const overdue = !d.collectedAt && expected && daysBetween(expected, today()) > 0;
                    return (
                      <div style={{ marginTop: 3 }}>
                        {d.collectedAt ? (
                          <span onClick={() => canToggle && toggleCollected(d.id)} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.green, borderRadius: 3, padding: "1px 6px", cursor: canToggle ? "pointer" : "default" }} title={canToggle ? "Tap to un-mark" : ""}>Collected {d.collectedAt}</span>
                        ) : overdue ? (
                          canToggle ? (
                            <button onClick={() => toggleCollected(d.id)} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.red, border: "none", borderRadius: 3, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>Overdue {daysBetween(expected, today())}d — mark collected</button>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.red, borderRadius: 3, padding: "1px 6px" }}>Overdue {daysBetween(expected, today())}d</span>
                          )
                        ) : canToggle ? (
                          <button onClick={() => toggleCollected(d.id)} style={{ fontSize: 10, fontWeight: 700, color: C.amber, background: C.amberBg, border: `1px solid ${C.amber}`, borderRadius: 3, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}>Awaiting collection{expected ? ` — due ${expected}` : ""} — mark collected</button>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, background: C.amberBg, borderRadius: 3, padding: "1px 6px" }}>Awaiting collection{expected ? ` — due ${expected}` : ""}</span>
                        )}
                      </div>
                    );
                  })()}
                  {d.agreement?.assistBDId && (
                    <div style={{ fontSize: 10, color: C.blue, marginTop: 3 }}><Handshake size={10} style={{ verticalAlign: "-1px" }} /> Split {d.agreement.splitPct}% with {userById(d.agreement.assistBDId)?.name}</div>
                  )}
                  {quotes.filter((q) => q.oppId === d.id).map((q) => (
                    <div key={q.id} style={{ fontSize: 10, marginTop: 3 }}>
                      <span style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 3, padding: "1px 5px", color: quoteStatusColor[q.status], fontWeight: 700 }}>{q.number} · {q.status}</span>
                    </div>
                  ))}
                </td>
                <td>{acct(d.accountId)?.name || "—"}</td>
                <td>
                  {(d.lines || []).map((l, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{PRODUCTS[l.product]?.short || l.product} · {fmt(l.value)}</div>
                  ))}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(dealValue(d))}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{d.prob ?? STAGE_PROB[d.stage]}%</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.teal }}>{fmt(dealCommission(d, userById(d.ownerId)?.role))}</td>
                <td>
                  <select value={d.stage} onChange={(e) => setStage(d.id, e.target.value)} disabled={!canEdit} style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "4px 6px", borderColor: stageColor[d.stage], color: stageColor[d.stage], fontWeight: 600 }}>
                    {STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td><Tag color={fcatColor[d.forecastCat]}>{d.forecastCat}</Tag></td>
                <td style={{ fontSize: 12, color: C.sub }}>{d.closeDate || "—"}</td>
                {canEdit && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    {d.stage !== "Won" && d.stage !== "Lost" && <IconBtn title="Create quote (CPQ)" onClick={() => onQuote(d)} color={C.blue}><FileText size={14} /></IconBtn>}
                    {isAdmin && <IconBtn title="Cross-territory agreement" onClick={() => onAgreement(d)} color={C.blue}><Handshake size={14} /></IconBtn>}
                    <IconBtn onClick={() => onEdit(d)}><Pencil size={14} /></IconBtn>
                    <IconBtn onClick={() => onDelete(d.id)} color={C.red}><Trash2 size={14} /></IconBtn>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ----------------------------- Accounts ---------------------------- */

function Accounts({ accounts, deals, interactions, userById, canEdit, isAdmin, onAdd, onEdit, onDelete, onLog, onReg }) {
  const [open, setOpen] = useState(null);
  const byTier = TIERS.map((t) => [t, accounts.filter((a) => a.tier === t)]);
  const iconFor = { Call: Phone, Email: Mail, Meeting: CalendarDays, WhatsApp: MessageSquare, Note: Pencil };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: C.faint }}>{!isAdmin && "New accounts and territory (re)assignment are Area Director-only. You can edit details on accounts you own."}</div>
        {isAdmin && <Btn onClick={onAdd}><Plus size={14} /> New account</Btn>}
      </div>
      {byTier.map(([tier, list]) => list.length > 0 && (
        <div key={tier} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: tierColor[tier], marginBottom: 8 }}>{tier} · {list.length} accounts</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {list.map((a) => {
              const aDeals = deals.filter((d) => d.accountId === a.id && d.stage !== "Lost");
              const aVal = aDeals.reduce((s, d) => s + dealValue(d), 0);
              const aInts = interactions.filter((i) => i.accountId === a.id).sort((x, y) => (y.date || "").localeCompare(x.date || ""));
              const isOpen = open === a.id;
              return (
                <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${tierColor[a.tier]}`, borderRadius: 6, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>{a.country} · {a.region}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>Owner: {userById(a.ownerId)?.name || "Unassigned"}</div>
                    </div>
                    {canEdit && (
                      <div style={{ display: "flex" }}>
                        <IconBtn onClick={() => onEdit(a)}><Pencil size={13} /></IconBtn>
                        <IconBtn onClick={() => onDelete(a.id)} color={C.red}><Trash2 size={13} /></IconBtn>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>
                    {aDeals.length > 0 ? <>Pipeline: <strong style={{ color: C.ink }}>{fmt(aVal)}</strong> · {aDeals.length} opp{aDeals.length > 1 ? "s" : ""}</> : "No open opportunities"}
                    {aInts.length > 0 && <> · {aInts.length} touch{aInts.length > 1 ? "es" : ""}</>}
                  </div>
                  {a.webCustomer && (
                    <div style={{ marginTop: 5 }}><Tag color={C.teal}>Banner customer — banner.aero</Tag></div>
                  )}
                  {(a.fleet || []).length > 0 && (
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>
                      <Plane size={11} style={{ verticalAlign: "-2px", marginRight: 4, color: C.blue }} />
                      Fleet: <strong>{a.fleet.reduce((s, f) => s + (Number(f.count) || 0), 0)}</strong> a/c — {a.fleet.map((f) => f.type).slice(0, 3).join(", ")}{a.fleet.length > 3 ? ` +${a.fleet.length - 3}` : ""}
                    </div>
                  )}
                  {a.reg && a.reg.status !== "Not started" && (
                    <div style={{ marginTop: 6 }}>
                      <Tag color={regColor[a.reg.status]}>Reg: {a.reg.status}</Tag>
                      {a.reg.expected && a.reg.status !== "PVL awarded" && <span style={{ fontSize: 10, color: C.faint, marginLeft: 6 }}>ETA {a.reg.expected}</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    {canEdit && <button onClick={() => onReg(a)} style={{ background: "none", border: "none", color: C.amber, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 600 }}>Registration</button>}
                    {canEdit && <button onClick={() => onLog(a)} style={{ background: "none", border: "none", color: C.teal, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 600 }}>+ Log touch</button>}
                    <button onClick={() => setOpen(isOpen ? null : a.id)} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 600 }}>
                      {isOpen ? "Hide detail" : "Detail"}
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 8, background: C.bg, borderRadius: 4, padding: 8 }}>
                      {a.notes && <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>{a.notes}</div>}
                      {aInts.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>No interactions logged yet.</div>}
                      {aInts.slice(0, 6).map((i) => {
                        const Ic = iconFor[i.type] || Pencil;
                        return (
                          <div key={i.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                            <Ic size={13} color={C.teal} style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 12 }}>{i.summary}</div>
                              <div style={{ fontSize: 10, color: C.faint }}>{i.type} · {i.date}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Contacts ---------------------------- */

function Contacts({ contacts, acct, canEdit, onAdd, onEdit, onDelete }) {
  return (
    <div>
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <Btn onClick={onAdd}><Plus size={14} /> New contact</Btn>
        </div>
      )}
      <Card style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Name</th><th>Title</th><th>Account</th><th>Email</th><th>Phone</th><th>Notes</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {contacts.length === 0 && <tr><td colSpan={7} style={{ color: C.faint, textAlign: "center", padding: 24 }}>No contacts in view.</td></tr>}
            {contacts.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td style={{ fontSize: 13, color: C.sub }}>{c.title}</td>
                <td>{acct(c.accountId)?.name || "—"}</td>
                <td style={{ fontSize: 13 }}>{c.email || "—"}</td>
                <td style={{ fontSize: 13 }}>{c.phone || "—"}</td>
                <td style={{ fontSize: 12, color: C.faint, maxWidth: 220 }}>{c.notes}</td>
                {canEdit && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <IconBtn onClick={() => onEdit(c)}><Pencil size={14} /></IconBtn>
                    <IconBtn onClick={() => onDelete(c.id)} color={C.red}><Trash2 size={14} /></IconBtn>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------ Actions ---------------------------- */

function Actions({ activities, acct, canEdit, toggle, onAdd, onDelete }) {
  const sorted = [...activities].sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
  return (
    <div>
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <Btn onClick={onAdd}><Plus size={14} /> New action</Btn>
        </div>
      )}
      <Card style={{ padding: 8 }}>
        {sorted.length === 0 && <div style={{ color: C.faint, textAlign: "center", padding: 24, fontSize: 13 }}>Nothing here.</div>}
        {sorted.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 8px", borderBottom: `1px solid ${C.bg}` }}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} disabled={!canEdit} style={{ marginTop: 3, width: 16, height: 16, accentColor: C.green, cursor: canEdit ? "pointer" : "not-allowed" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, textDecoration: t.done ? "line-through" : "none", color: t.done ? C.faint : C.ink }}>{t.text}</div>
              <div style={{ fontSize: 11, color: !t.done && t.due && t.due < today() ? C.red : C.faint, marginTop: 2 }}>
                {t.due ? `Due ${t.due}` : "No date"}{t.accountId && acct(t.accountId) ? ` · ${acct(t.accountId).name}` : ""}
              </div>
            </div>
            {canEdit && <IconBtn onClick={() => onDelete(t.id)} color={C.red}><Trash2 size={14} /></IconBtn>}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ------------------------------ Forecast --------------------------- */

function Forecast({ deals, settings, isAdmin, onQuota, userById, users, isBD, me }) {
  const quarters = [...new Set(deals.map((d) => quarterOf(d.closeDate)))].filter((q) => q !== "No date").sort((a, b) => {
    const [qa, ya] = a.split(" "), [qb, yb] = b.split(" ");
    return ya === yb ? qa.localeCompare(qb) : Number(ya) - Number(yb);
  });
  const [quarter, setQuarter] = useState(quarters[0] || "");
  const [quotaDraft, setQuotaDraft] = useState(settings.monthlyQuota);

  const qDeals = deals.filter((d) => quarterOf(d.closeDate) === quarter);
  const byCat = FORECAST_CATS.map((cat) => {
    const list = qDeals.filter((d) => d.forecastCat === cat);
    return { cat, count: list.length, value: list.reduce((s, d) => s + dealValue(d), 0), comm: list.reduce((s, d) => s + dealCommission(d, userById(d.ownerId)?.role), 0) };
  });
  const reps = (users || []).filter((u) => OWNER_ROLES.includes(u.role) && (!isBD || u.id === me.id));
  const quarterQuota = (Number(settings.monthlyQuota) || 0) * 3;
  const evenRepQuota = reps.length ? quarterQuota / reps.length : 0;

  const byRep = reps.map((r) => {
    const mine = qDeals.filter((d) => d.ownerId === r.id);
    const won = mine.filter((d) => d.forecastCat === "Closed");
    const forecastCat = mine.filter((d) => d.forecastCat === "Forecast");
    const upsideCat = mine.filter((d) => d.forecastCat === "Upside");
    const pipelineCat = mine.filter((d) => d.forecastCat === "Pipeline");
    const value = mine.reduce((s, d) => s + dealValue(d), 0);
    const weighted = mine.reduce((s, d) => s + dealWeighted(d), 0);
    const closedVal = won.reduce((s, d) => s + dealValue(d), 0);
    const forecastVal_ = forecastCat.reduce((s, d) => s + dealValue(d), 0);
    const upsideVal = upsideCat.reduce((s, d) => s + dealValue(d), 0);
    const cov = evenRepQuota > 0 ? ((closedVal + forecastVal_) / evenRepQuota) * 100 : 0;
    return { r, count: mine.length, value, weighted, closedVal, forecastVal: forecastVal_, upsideVal, pipelineCount: pipelineCat.length, cov };
  }).sort((a, b) => b.value - a.value);
  const forecastVal = byCat.find((c) => c.cat === "Forecast")?.value || 0;
  const closed = byCat.find((c) => c.cat === "Closed")?.value || 0;
  const upside = byCat.find((c) => c.cat === "Upside")?.value || 0;
  const coverage = quarterQuota > 0 ? ((forecastVal + closed) / quarterQuota) * 100 : 0;
  const coverageBest = quarterQuota > 0 ? ((forecastVal + closed + upside) / quarterQuota) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
        <Field label="Forecast period">
          <select style={{ ...inputStyle, width: "auto" }} value={quarter} onChange={(e) => setQuarter(e.target.value)}>
            {quarters.length === 0 && <option value="">No dated opportunities</option>}
            {quarters.map((q) => <option key={q}>{q}</option>)}
          </select>
        </Field>
        <Field label={isAdmin ? "Monthly quota (USD)" : "Monthly quota"}>
          {isAdmin ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" style={{ ...inputStyle, width: 140 }} value={quotaDraft} onChange={(e) => setQuotaDraft(e.target.value)} />
              <Btn small onClick={() => onQuota(Number(quotaDraft) || 0)}>Set</Btn>
            </div>
          ) : (
            <div style={{ ...inputStyle, background: C.bg, width: 140 }}>{fmt(settings.monthlyQuota)}</div>
          )}
        </Field>
      </div>

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionTitle>Quota coverage — {quarter || "select a period"} (quarterly quota {fmt(quarterQuota)})</SectionTitle>
        <div style={{ background: C.bg, borderRadius: 4, height: 26, position: "relative", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(coverageBest, 100)}%`, height: "100%", background: "#BFD3E4", position: "absolute" }} />
          <div style={{ width: `${Math.min(coverage, 100)}%`, height: "100%", background: coverage >= 100 ? C.green : C.blue, position: "absolute", transition: "width .3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.sub, marginTop: 6 }}>
          <span>Closed + Forecast: <strong style={{ color: C.ink }}>{fmt(closed + forecastVal)}</strong> ({coverage.toFixed(0)}%)</span>
          <span>incl. Upside: {fmt(closed + forecastVal + upside)} ({coverageBest.toFixed(0)}%)</span>
        </div>
      </Card>

      <Card style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Forecast category</th><th>Opportunities</th><th>Revenue</th><th>Commission</th></tr></thead>
          <tbody>
            {byCat.map((c) => (
              <tr key={c.cat}>
                <td><Tag color={fcatColor[c.cat]}>{c.cat}</Tag></td>
                <td>{c.count || "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{c.count ? fmt(c.value) : "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.teal }}>{c.count ? fmt(c.comm) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 700, color: C.ink }}>Forecast by rep — {quarter || "select a period"}</div>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 10 }}>
        Quota coverage per rep is measured against an even split of the team quota ({fmt(evenRepQuota)}/quarter each) — swap in individual quotas once BAI sets them per territory.
      </div>
      <Card style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Rep</th><th>Open deals</th><th>Pipeline (unweighted)</th><th>Weighted</th><th>Upside</th><th>Forecast</th><th>Closed</th><th>Quota coverage</th></tr></thead>
          <tbody>
            {byRep.length === 0 && <tr><td colSpan={8} style={{ color: C.faint, textAlign: "center", padding: 20 }}>No reps in view.</td></tr>}
            {byRep.map(({ r, count, value, weighted, closedVal, forecastVal, upsideVal, cov }) => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{r.region || "All territories"}</div>
                </td>
                <td>{count}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(weighted)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.amber }}>{upsideVal ? fmt(upsideVal) : "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.blue, fontWeight: 600 }}>{forecastVal ? fmt(forecastVal) : "—"}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.green, fontWeight: 700 }}>{closedVal ? fmt(closedVal) : "—"}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 60, height: 8, background: C.bg, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(cov, 100)}%`, height: "100%", background: cov >= 100 ? C.green : C.blue }} />
                    </div>
                    <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: cov >= 100 ? C.green : C.sub, fontWeight: 600 }}>{cov.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------ Insights --------------------------- */

function Insights({ deals, accounts, quotes, acct, userById }) {
  const closedDeals = deals.filter((d) => d.stage === "Won" || d.stage === "Lost");
  const won = deals.filter((d) => d.stage === "Won");
  const open = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
  const winRate = closedDeals.length ? (won.length / closedDeals.length) * 100 : null;
  const avgSize = won.length ? won.reduce((s, d) => s + dealValue(d), 0) / won.length : null;
  const cycles = won.filter((d) => d.createdAt && d.closedAt).map((d) => (new Date(d.closedAt) - new Date(d.createdAt)) / 86400000);
  const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null;
  const rfqTimes = (quotes || []).filter((q) => q.rfqDate && q.sentAt).map((q) => daysBetween(q.rfqDate, q.sentAt));
  const avgRfq = rfqTimes.length ? rfqTimes.reduce((a, b) => a + b, 0) / rfqTimes.length : null;
  const lossAgg = {};
  deals.filter((d) => d.stage === "Lost" && d.lossReason).forEach((d) => { lossAgg[d.lossReason] = (lossAgg[d.lossReason] || 0) + dealValue(d); });
  const byLoss = Object.entries(lossAgg).map(([label, value]) => ({ label, value }));

  const byRegion = REGIONS.map((r) => {
    const list = open.filter((d) => acct(d.accountId)?.region === r);
    return { label: r, value: list.reduce((s, d) => s + dealValue(d), 0), count: list.length };
  }).filter((x) => x.count > 0);

  const byProduct = Object.keys(PRODUCTS).map((p) => {
    let value = 0, count = 0;
    open.forEach((d) => (d.lines || []).forEach((l) => { if (l.product === p) { value += Number(l.value) || 0; count++; } }));
    return { label: PRODUCTS[p].short, value, count };
  }).filter((x) => x.count > 0);

  const ownersAgg = {};
  open.forEach((d) => {
    const name = userById(d.ownerId)?.name || "Unassigned";
    ownersAgg[name] = (ownersAgg[name] || 0) + dealValue(d);
  });
  const byOwner = Object.entries(ownersAgg).map(([label, value]) => ({ label, value }));

  const BarBlock = ({ title, rows, color }) => {
    const max = Math.max(...rows.map((r) => r.value), 1);
    return (
      <Card style={{ padding: 16, flex: "1 1 300px" }}>
        <SectionTitle>{title}</SectionTitle>
        {rows.length === 0 && <div style={{ fontSize: 13, color: C.faint }}>No open pipeline.</div>}
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 110, fontSize: 12, color: C.sub, flexShrink: 0 }}>{r.label}</div>
            <div style={{ flex: 1, background: C.bg, borderRadius: 3, height: 18 }}>
              <div style={{ width: `${(r.value / max) * 100}%`, minWidth: 4, height: "100%", background: color, borderRadius: 3 }} />
            </div>
            <div style={{ width: 90, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(r.value)}</div>
          </div>
        ))}
      </Card>
    );
  };

  const kpi = (label, value, note) => (
    <Card style={{ padding: "14px 16px", flex: "1 1 180px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{note}</div>}
    </Card>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {kpi("Win rate", winRate === null ? "—" : `${winRate.toFixed(0)}%`, `${won.length} won / ${closedDeals.length} closed`)}
        {kpi("Avg deal size (won)", avgSize === null ? "—" : fmt(avgSize), "Closed-won only")}
        {kpi("Avg sales cycle", avgCycle === null ? "—" : `${Math.round(avgCycle)} days`, "Created → closed")}
        {kpi("RFQ → quote", avgRfq === null ? "—" : `${avgRfq.toFixed(1)} days`, `${rfqTimes.length} quotes measured`)}
        {kpi("Accounts in view", accounts.length, "Current scope")}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <BarBlock title="Open pipeline by region" rows={byRegion} color={C.blue} />
        <BarBlock title="Open pipeline by product line" rows={byProduct} color={C.teal} />
        <BarBlock title="Open pipeline by owner" rows={byOwner} color={C.amber} />
        <BarBlock title="Lost revenue by reason" rows={byLoss} color={C.red} />
      </div>
    </div>
  );
}

/* ---------------------------- Aircraft 360 -------------------------- */

function Aircraft360({ accounts, allAccounts, aircraft, aogCases, catalog, deals, acct, userById, canEdit, onAddAircraft, onEditAircraft, onDeleteAircraft, onAddAog, onEditAog, onDeleteAog, setAogStatus }) {
  const [sub, setSub] = useState("fleet");
  const [q, setQ] = useState("");
  const [ataOpen, setAtaOpen] = useState(null);
  const openDeals = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");

  const [selModel, setSelModel] = useState("737NG");
  const subs = [
    ["fleet", "Fleet Intelligence"], ["model", "Model 360"], ["registry", "Aircraft Registry"], ["ata", "ATA Browser"],
    ["parts", "Parts Intelligence"], ["pma", "PMA Directory"], ["oem", "OEM Directory"],
    ["mro", "MRO Directory"], ["suppliers", "Suppliers"], ["aog", "AOG Desk"], ["heat", "Sales Heat Map"],
  ];

  const Pill = ({ id, label }) => (
    <button onClick={() => setSub(id)} style={{ background: sub === id ? C.blueDeep : C.surface, color: sub === id ? "#fff" : C.sub, border: `1px solid ${sub === id ? C.blueDeep : C.line}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
  );

  /* per-account fleet intel */
  const fleetRows = accounts.filter((a) => (a.fleet || []).length > 0).map((a) => {
    const size = a.fleet.reduce((s, f) => s + (Number(f.count) || 0), 0);
    const suggested = [...new Set(a.fleet.flatMap((f) => fleetSuggest(f.type)))];
    const activeLines = new Set();
    deals.filter((d) => d.accountId === a.id && d.stage !== "Lost").forEach((d) => (d.lines || []).forEach((l) => activeLines.add(l.product)));
    const gaps = suggested.filter((s) => !activeLines.has(s));
    return { a, size, suggested, activeLines: [...activeLines], gaps };
  }).sort((x, y) => y.size - x.size);

  const partsFiltered = catalog.filter((p) => {
    if (!q.trim()) return true;
    const hay = `${p.pn} ${p.name} ${p.productLine} ATA${p.ata || ""} ${p.pma ? "PMA" : ""}`.toLowerCase();
    return q.toLowerCase().split(" ").every((w) => hay.includes(w));
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {subs.map(([id, label]) => <Pill key={id} id={id} label={label} />)}
      </div>

      {sub === "fleet" && (
        <div>
          <div style={{ fontSize: 12, color: C.amber, background: C.amberBg, borderRadius: 4, padding: "8px 12px", marginBottom: 12, fontWeight: 600 }}>
            African Fleet Database — indicative compositions from public sources (2025). Verify counts with the operator before customer-facing use; refine via the Registry.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 12 }}>
            {fleetRows.map(({ a, size, suggested, activeLines, gaps }) => (
              <Card key={a.id} style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: C.sub }}><strong style={{ color: C.ink, fontSize: 16 }}>{size}</strong> a/c</div>
                </div>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 8 }}>{a.country} · {a.fleet.length} families · Owner: {userById(a.ownerId)?.name || "—"}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {a.fleet.map((f, i) => (
                    <span key={i} style={{ fontSize: 11, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 3, padding: "2px 6px" }}>
                      <strong>{f.type}</strong> ×{f.count}{f.engine ? <span style={{ color: C.faint }}> · {f.engine}</span> : null}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.sub }}>
                  Banner coverage: <strong style={{ color: activeLines.length ? C.green : C.faint }}>{activeLines.length}</strong>/{suggested.length} suggested lines active
                </div>
                {gaps.length > 0 && (
                  <div style={{ fontSize: 11, color: C.teal, marginTop: 4 }}>
                    <strong>Opportunity:</strong> {gaps.map((g) => PRODUCTS[g]?.short || g).join(", ")}
                  </div>
                )}
              </Card>
            ))}
            {fleetRows.length === 0 && <div style={{ fontSize: 13, color: C.faint }}>No fleet data in view — add aircraft in the Registry or fleet mixes on accounts.</div>}
          </div>
        </div>
      )}

      {sub === "model" && (() => {
        const def = FAMILY_DEFS.find((d) => d.id === selModel) || FAMILY_DEFS[0];
        const re = new RegExp(def.re, "i");
        const ops = accounts.map((a) => ({
          a,
          tails: (a.fleet || []).filter((f) => re.test(f.type)).reduce((s, f) => s + (Number(f.count) || 0), 0),
          types: (a.fleet || []).filter((f) => re.test(f.type)),
        })).filter((x) => x.tails > 0).sort((x, y) => y.tails - x.tails);
        const totalTails = ops.reduce((s, o) => s + o.tails, 0);
        const regTails = aircraft.filter((x) => re.test(x.type || ""));
        const lines = [...(def.vogt ? ["Vogt PMA Parts"] : []), "Oshino Lamps", "Anjou Seat Belts", "Novega ULBs", "Repair Management"];
        const fitItems = catalog.filter((p) => lines.includes(p.productLine));
        const opIds = new Set(ops.map((o) => o.a.id));
        const openOnOps = openDeals.filter((d) => opIds.has(d.accountId));
        const engaged = new Set([...openOnOps.map((d) => d.accountId), ...deals.filter((d) => d.stage === "Won" && opIds.has(d.accountId)).map((d) => d.accountId)]);
        const uncovered = ops.filter((o) => !engaged.has(o.a.id));
        return (
          <div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
              {FAMILY_DEFS.map((d) => (
                <button key={d.id} onClick={() => setSelModel(d.id)} style={{ background: selModel === d.id ? C.teal : C.surface, color: selModel === d.id ? "#fff" : C.sub, border: `1px solid ${selModel === d.id ? C.teal : C.line}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{d.label}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
              <Card style={{ padding: 16, flex: "2 1 340px" }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{def.label} <span style={{ fontSize: 12, fontWeight: 600, color: C.faint }}>· {def.oem}</span></div>
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}><strong>Engines:</strong> {def.engines}</div>
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}><strong>Banner fit:</strong> {lines.map((l) => PRODUCTS[l]?.short).join(" · ")}{def.vogt ? " — incl. Vogt lav-system PMAs (ATA 38)" : ""}</div>
                <div style={{ display: "flex", gap: 22, marginTop: 12 }}>
                  <div><div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{totalTails}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tails in territory*</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 800 }}>{ops.length}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Operators in book</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 800, color: C.teal }}>{fmt(openOnOps.reduce((s, d) => s + dealValue(d), 0))}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Open pipeline on operators</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 800 }}>{regTails.length}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Registry tails</div></div>
                </div>
                <div style={{ fontSize: 10, color: C.faint, marginTop: 8 }}>*Indicative fleet counts — verify with operators; refine tail-by-tail in the Registry.</div>
              </Card>
              {uncovered.length > 0 && (
                <Card style={{ padding: 16, flex: "1 1 240px", borderLeft: `3px solid ${C.teal}` }}>
                  <SectionTitle>Campaign hint</SectionTitle>
                  <div style={{ fontSize: 12.5, color: C.sub }}>
                    {uncovered.length} {def.label} operator{uncovered.length > 1 ? "s" : ""} with <strong>no Banner engagement yet</strong>:
                  </div>
                  {uncovered.slice(0, 5).map((o) => (
                    <div key={o.a.id} style={{ fontSize: 12, marginTop: 5 }}><strong>{o.a.name}</strong> — {o.tails} tails · {userById(o.a.ownerId)?.name || "unassigned"}</div>
                  ))}
                </Card>
              )}
            </div>

            <Card style={{ overflowX: "auto", marginBottom: 14 }}>
              <table>
                <thead><tr><th>Operator</th><th>Tails</th><th>Variants / engines</th><th>Owner</th><th>Open pipeline</th><th>Status</th></tr></thead>
                <tbody>
                  {ops.length === 0 && <tr><td colSpan={6} style={{ color: C.faint, textAlign: "center", padding: 20 }}>No {def.label} operators in view.</td></tr>}
                  {ops.map(({ a, tails, types }) => {
                    const openV = openDeals.filter((d) => d.accountId === a.id).reduce((s, d) => s + dealValue(d), 0);
                    return (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.name}<div style={{ fontSize: 10.5, color: C.faint }}>{a.country}</div></td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{tails}</td>
                        <td style={{ fontSize: 12, color: C.sub }}>{types.map((t) => `${t.type}${t.engine ? ` (${t.engine})` : ""}`).join(", ")}</td>
                        <td style={{ fontSize: 13 }}>{userById(a.ownerId)?.name || "—"}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{openV ? fmt(openV) : <span style={{ color: C.faint }}>—</span>}</td>
                        <td>{engaged.has(a.id) ? <Tag color={C.green}>Engaged</Tag> : <Tag color={C.amber}>Opportunity</Tag>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <Card style={{ overflowX: "auto" }}>
              <div style={{ padding: "12px 14px 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub }}>Applicable Banner catalogue — {def.label}</div>
              <table>
                <thead><tr><th>Part No.</th><th>Description</th><th>Line</th><th>ATA</th><th>PMA</th><th>List</th></tr></thead>
                <tbody>
                  {fitItems.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{p.pn}</td>
                      <td>{p.name}</td>
                      <td style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{PRODUCTS[p.productLine]?.short}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.ata ? p.ata : "Multi"}</td>
                      <td>{p.pma ? <Tag color={C.teal}>PMA</Tag> : <span style={{ color: C.faint }}>—</span>}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.listPrice > 0 ? fmt2(p.listPrice) : <span style={{ color: C.faint }}>POA</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        );
      })()}

      {sub === "registry" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, color: C.sub }}>Tail-level registry — build it as BDs confirm registrations, MSNs and configurations.</div>
            {canEdit && <Btn onClick={() => onAddAircraft()}><Plus size={14} /> Add aircraft</Btn>}
          </div>
          <Card style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Operator</th><th>Type</th><th>Registration</th><th>MSN</th><th>Delivery</th><th>Engine</th><th>Status</th><th>Notes</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {aircraft.length === 0 && <tr><td colSpan={9} style={{ color: C.faint, textAlign: "center", padding: 24 }}>Registry is empty in this view.</td></tr>}
                {aircraft.map((x) => (
                  <tr key={x.id}>
                    <td style={{ fontWeight: 600 }}>{acct(x.accountId)?.name || "—"}</td>
                    <td>{x.type}</td>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{x.reg || "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{x.msn || "—"}</td>
                    <td>{x.deliveryYear || "—"}</td>
                    <td style={{ fontSize: 13, color: C.sub }}>{x.engine || "—"}</td>
                    <td><Tag color={x.status === "Active" ? C.green : x.status === "Stored" ? C.faint : C.amber}>{x.status || "Active"}</Tag></td>
                    <td style={{ fontSize: 12, color: C.faint, maxWidth: 200 }}>{x.notes}</td>
                    {canEdit && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <IconBtn onClick={() => onEditAircraft(x)}><Pencil size={14} /></IconBtn>
                        <IconBtn onClick={() => onDeleteAircraft(x.id)} color={C.red}><Trash2 size={14} /></IconBtn>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {sub === "ata" && (
        <div>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>ATA chapter reference mapped to Banner's portfolio. Repair Management covers components across chapters via the 400+ shop network.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {ATA_CHAPTERS.map((c) => {
              const items = catalog.filter((p) => p.ata === c.ch);
              const covered = (c.banner || []).length > 0;
              const isOpen = ataOpen === c.ch;
              return (
                <div key={c.ch} style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${covered ? C.teal : C.line}`, borderRadius: 6, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div><span style={{ fontWeight: 800, color: covered ? C.teal : C.faint, fontVariantNumeric: "tabular-nums" }}>ATA {c.ch}</span> <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span></div>
                    {items.length > 0 && <button onClick={() => setAtaOpen(isOpen ? null : c.ch)} style={{ background: "none", border: "none", color: C.blue, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{items.length} items {isOpen ? "▴" : "▾"}</button>}
                  </div>
                  <div style={{ fontSize: 11, color: covered ? C.sub : C.faint, marginTop: 3 }}>
                    {covered ? `Banner: ${c.banner.map((b) => PRODUCTS[b]?.short || b).join(", ")}` : "No dedicated line — Repair Mgmt on request"}
                  </div>
                  {isOpen && items.map((p) => (
                    <div key={p.id} style={{ fontSize: 11, marginTop: 5, paddingTop: 5, borderTop: `1px solid ${C.bg}` }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{p.pn}</span> {p.name}{p.pma && <Tag color={C.teal}>PMA</Tag>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(sub === "parts" || sub === "pma") && (
        <div>
          {sub === "parts" && (
            <div style={{ position: "relative", marginBottom: 12, maxWidth: 420 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: C.faint }} />
              <input style={{ ...inputStyle, paddingLeft: 32 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PN, description, line, ATA, PMA…" />
            </div>
          )}
          {sub === "pma" && (
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>FAA-PMA / STC approved alternatives distributed by Banner — the lessor-friendly cost story. Vogt Aero: 130+ PMA/STC/OOP parts (full list on request from Vogt).</div>
          )}
          <Card style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Part No.</th><th>Description</th><th>Line</th><th>ATA</th><th>UOM</th><th>Lead</th><th>PMA</th><th>List</th></tr></thead>
              <tbody>
                {(sub === "pma" ? catalog.filter((p) => p.pma) : partsFiltered).map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{p.pn}</td>
                    <td>{p.name}</td>
                    <td style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{PRODUCTS[p.productLine]?.short}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.ata ? p.ata : "Multi"}</td>
                    <td style={{ fontSize: 12 }}>{p.unit}</td>
                    <td style={{ fontSize: 12, color: C.sub }}>{p.lead || "—"}</td>
                    <td>{p.pma ? <Tag color={C.teal}>PMA</Tag> : <span style={{ color: C.faint }}>—</span>}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.listPrice > 0 ? fmt2(p.listPrice) : <span style={{ color: C.faint }}>POA</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {sub === "oem" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {OEM_DIRECTORY.map((o) => (
            <Card key={o.name} style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Factory size={15} color={C.blue} />
                <div style={{ fontWeight: 700 }}>{o.name}</div>
              </div>
              <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, marginTop: 3 }}>{o.role}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{o.scope}</div>
            </Card>
          ))}
        </div>
      )}

      {sub === "mro" && (
        <Card style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>MRO</th><th>Base</th><th>Notes</th><th>CRM account</th><th>Owner</th></tr></thead>
            <tbody>
              {MRO_DIRECTORY.map((m) => {
                const a = m.accountId ? allAccounts.find((x) => x.id === m.accountId) : null;
                return (
                  <tr key={m.name}>
                    <td style={{ fontWeight: 600 }}><Wrench size={13} style={{ verticalAlign: "-2px", marginRight: 5, color: C.teal }} />{m.name}</td>
                    <td style={{ fontSize: 13 }}>{m.base}</td>
                    <td style={{ fontSize: 12, color: C.sub }}>{m.note}</td>
                    <td>{a ? <Tag color={tierColor[a.tier]}>{a.tier}</Tag> : <span style={{ color: C.faint, fontSize: 12 }}>Not in book</span>}</td>
                    <td style={{ fontSize: 13 }}>{a ? (userById(a.ownerId)?.name || "—") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {sub === "suppliers" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {SUPPLIER_CONTACTS.map((s, i) => (
            <Card key={i} style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.company}</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.sub }}>{s.title}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>{s.email && <div>{s.email}</div>}{s.phone && <div style={{ color: C.sub }}>{s.phone}</div>}</div>
            </Card>
          ))}
        </div>
      )}

      {sub === "aog" && (
        <div>
          <div style={{ background: C.blueDeep, color: "#fff", borderRadius: 6, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}><Flame size={15} color="#F0A050" /> Banner AOG Desk — 24/7/365</div>
              <div style={{ fontSize: 12, color: "#BFD3E4", marginTop: 2 }}>sales@banner.aero · +1 (855) 822-6637 · Response commitment: immediate</div>
            </div>
            {canEdit && <Btn kind="amber" onClick={onAddAog}><Plus size={14} /> Log AOG case</Btn>}
          </div>
          <Card style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Case</th><th>Operator</th><th>Aircraft</th><th>Part / need</th><th>Opened</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {aogCases.length === 0 && <tr><td colSpan={7} style={{ color: C.faint, textAlign: "center", padding: 24 }}>No AOG cases logged. May it stay that way — but when the call comes, log it here so response time is on record.</td></tr>}
                {[...aogCases].sort((x, y) => (x.status === "Closed") - (y.status === "Closed")).map((cse) => (
                  <tr key={cse.id} style={cse.status === "Open" ? { background: C.redBg } : undefined}>
                    <td style={{ fontWeight: 700 }}>{cse.number}<div style={{ fontSize: 10, color: C.faint }}>{cse.status !== "Closed" ? `${daysBetween(cse.openedAt, today())}d open` : `closed ${cse.closedAt}`}</div></td>
                    <td>{acct(cse.accountId)?.name || "—"}</td>
                    <td style={{ fontSize: 13 }}>{cse.acType}{cse.reg ? ` · ${cse.reg}` : ""}</td>
                    <td style={{ fontSize: 13 }}>{cse.need}</td>
                    <td style={{ fontSize: 12, color: C.sub }}>{cse.openedAt}</td>
                    <td>
                      {canEdit ? (
                        <select value={cse.status} onChange={(e) => setAogStatus(cse.id, e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "4px 6px", borderColor: aogColor[cse.status], color: aogColor[cse.status], fontWeight: 700 }}>
                          {AOG_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ) : <Tag color={aogColor[cse.status]}>{cse.status}</Tag>}
                    </td>
                    {canEdit && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <IconBtn onClick={() => onEditAog(cse)}><Pencil size={14} /></IconBtn>
                        <IconBtn onClick={() => onDeleteAog(cse.id)} color={C.red}><Trash2 size={14} /></IconBtn>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {sub === "heat" && (() => {
        const regions = [...new Set(accounts.map((a) => a.region))].filter(Boolean);
        const lines = Object.keys(PRODUCTS);
        const cell = {};
        let max = 1;
        openDeals.forEach((d) => {
          const r = acct(d.accountId)?.region;
          if (!r) return;
          (d.lines || []).forEach((l) => {
            const k = r + "|" + l.product;
            cell[k] = (cell[k] || 0) + (Number(l.value) || 0);
            if (cell[k] > max) max = cell[k];
          });
        });
        return (
          <div>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>Open pipeline heat by territory × product line — where the money is, and where the white space is.</div>
            <Card style={{ overflowX: "auto", padding: 8 }}>
              <table>
                <thead><tr><th><Grid3X3 size={13} /></th>{lines.map((l) => <th key={l} style={{ textAlign: "center" }}>{PRODUCTS[l].short}</th>)}</tr></thead>
                <tbody>
                  {regions.map((r) => (
                    <tr key={r}>
                      <td style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{r}</td>
                      {lines.map((l) => {
                        const v = cell[r + "|" + l] || 0;
                        const alpha = v ? 0.15 + 0.75 * (v / max) : 0;
                        return (
                          <td key={l} style={{ textAlign: "center", background: v ? `rgba(20,83,140,${alpha})` : C.bg, color: alpha > 0.5 ? "#fff" : C.ink, fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: v ? 700 : 400, minWidth: 78 }}>
                            {v ? "$" + (v >= 1000 ? Math.round(v / 1000) + "k" : v) : "·"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>Empty cells are white space — cross-reference with Fleet Intelligence gaps to pick the next campaign.</div>
          </div>
        );
      })()}
    </div>
  );
}

function AircraftForm({ item, preset, accounts, onSave, onClose }) {
  const [f, setF] = useState(item || { id: uid(), accountId: preset?.accountId || accounts[0]?.id || "", type: "", reg: "", msn: "", deliveryYear: "", engine: "", status: "Active", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={item ? "Edit aircraft" : "Add aircraft"} onClose={onClose}>
      <Field label="Operator"><select style={inputStyle} value={f.accountId} onChange={set("accountId")}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Type" flex><input style={inputStyle} value={f.type} onChange={set("type")} placeholder="e.g. B737-800" /></Field>
        <Field label="Registration" flex><input style={inputStyle} value={f.reg} onChange={set("reg")} placeholder="e.g. 5Y-KZA" /></Field>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="MSN" flex><input style={inputStyle} value={f.msn} onChange={set("msn")} /></Field>
        <Field label="Delivery year" flex><input style={inputStyle} value={f.deliveryYear} onChange={set("deliveryYear")} /></Field>
        <Field label="Engine" flex><input style={inputStyle} value={f.engine} onChange={set("engine")} placeholder="CFM56-7B" /></Field>
      </div>
      <Field label="Status"><select style={inputStyle} value={f.status} onChange={set("status")}><option>Active</option><option>Stored</option><option>On order</option><option>Retired</option></select></Field>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.type.trim() && onSave(f)}>Save aircraft</Btn>
      </div>
    </Modal>
  );
}

function AogForm({ item, accounts, me, onSave, onClose }) {
  const [f, setF] = useState(item || { id: uid(), number: `AOG-${today().replace(/-/g, "").slice(2)}-${Math.floor(Math.random() * 90 + 10)}`, accountId: accounts[0]?.id || "", acType: "", reg: "", need: "", status: "Open", openedAt: today(), closedAt: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={item ? `Edit ${f.number}` : `Log AOG case ${f.number}`} onClose={onClose}>
      <Field label="Operator"><select style={inputStyle} value={f.accountId} onChange={set("accountId")}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Aircraft type" flex><input style={inputStyle} value={f.acType} onChange={set("acType")} placeholder="B737-800" /></Field>
        <Field label="Registration" flex><input style={inputStyle} value={f.reg} onChange={set("reg")} /></Field>
      </div>
      <Field label="Part / need"><input style={inputStyle} value={f.need} onChange={set("need")} placeholder="e.g. Sealed beam landing light — 2 off, ship NBO" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.need.trim() && onSave(f)}>Save case</Btn>
      </div>
    </Modal>
  );
}

/* ---------------------------- Commissions -------------------------- */

function Commissions({ deals, users, me, isBD, isAdmin, canProcessPayouts, payouts, roleOf, onRecordPayout }) {
  const owners = users.filter((u) => OWNER_ROLES.includes(u.role) && (!isBD || u.id === me.id));
  const q = quarterOf(today());

  const rows = owners.map((o) => {
    const relevant = deals.filter((d) => d.ownerId === o.id || (d.agreement && d.agreement.assistBDId === o.id));
    const open = relevant.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
    const won = relevant.filter((d) => d.stage === "Won");
    const collected = won.filter((d) => d.collectedAt);
    const shareOf = (d) => commissionShare(d, o.id, roleOf);
    const maturedAll = collected.reduce((s, d) => s + shareOf(d), 0);
    const paid = payouts.filter((p) => p.ownerId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return {
      o,
      pipeComm: open.reduce((s, d) => s + shareOf(d) * ((d.prob ?? STAGE_PROB[d.stage] ?? 0) / 100), 0),
      fcatComm: open.filter((d) => d.forecastCat === "Forecast").reduce((s, d) => s + shareOf(d), 0),
      pendingColl: won.filter((d) => !d.collectedAt).reduce((s, d) => s + shareOf(d), 0),
      maturedQ: collected.filter((d) => quarterOf(d.collectedAt) === q).reduce((s, d) => s + shareOf(d), 0),
      maturedAll, paid, payable: Math.max(0, maturedAll - paid),
      openCount: open.length, wonCount: won.length, collCount: collected.length,
    };
  }).sort((a, b) => b.pipeComm - a.pipeComm);

  /* Area Director's 1% territory override — every deal, whole territory. Not visible to BDs (compensation privacy). */
  const overrideRows = !isBD && (() => {
    const openAll = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
    const wonAll = deals.filter((d) => d.stage === "Won");
    const collectedAll = wonAll.filter((d) => d.collectedAt);
    return {
      weighted: openAll.reduce((s, d) => s + dealOverrideCommission(d) * ((d.prob ?? STAGE_PROB[d.stage] ?? 0) / 100), 0),
      pending: wonAll.filter((d) => !d.collectedAt).reduce((s, d) => s + dealOverrideCommission(d), 0),
      maturedQ: collectedAll.filter((d) => quarterOf(d.collectedAt) === q).reduce((s, d) => s + dealOverrideCommission(d), 0),
      maturedAll: collectedAll.reduce((s, d) => s + dealOverrideCommission(d), 0),
    };
  })();

  return (
    <div>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
        <strong>Owner-based commission:</strong> Territory Managers earn {(BDM_RATE * 100).toFixed(0)}% of gross deal value on deals they own. The Area Director earns {(AD_DIRECT_RATE * 100).toFixed(0)}% direct on deals they personally register, plus a {(AD_OVERRIDE_RATE * 100).toFixed(0)}% override on every deal across the whole territory. <strong>Commission matures upon collection</strong> — accrued on Won, payable once the Area Director or Finance confirms the customer's payment was received. {isBD ? "You see your own statement only." : "Visible to Area Director and executives."}
      </div>

      {overrideRows && (
        <Card style={{ padding: 14, marginBottom: 16, borderLeft: `3px solid ${C.amber}` }}>
          <SectionTitle>Area Director territory override — {(AD_OVERRIDE_RATE * 100).toFixed(0)}% of every deal</SectionTitle>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 6 }}>
            <div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(overrideRows.weighted)}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase" }}>Weighted pipeline</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{fmt(overrideRows.pending)}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase" }}>Accrued, awaiting collection</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmt(overrideRows.maturedQ)}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase" }}>Matured — {q}</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmt(overrideRows.maturedAll)}</div><div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase" }}>Matured — all time</div></div>
          </div>
        </Card>
      )}

      <Card style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Owner</th><th>Open deals</th><th>Weighted pipeline</th><th>Forecast-category</th><th>Accrued — awaiting collection</th><th>Matured — {q}</th><th>Matured — all time</th><th>Paid to date</th><th>Payable now</th>{canProcessPayouts && <th></th>}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} style={{ color: C.faint, textAlign: "center", padding: 24 }}>No owners in view.</td></tr>}
            {rows.map((r) => (
              <tr key={r.o.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.o.name}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{r.o.role === "Area Director" ? "Direct only — override shown above" : (r.o.region || "All territories")}</div>
                </td>
                <td>{r.openCount}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.pipeComm)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(r.fcatComm)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.amber, fontWeight: 700 }}>{fmt(r.pendingColl)} <span style={{ color: C.faint, fontSize: 11, fontWeight: 400 }}>({r.wonCount - r.collCount} deals)</span></td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.green, fontWeight: 700 }}>{fmt(r.maturedQ)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: C.green }}>{fmt(r.maturedAll)} <span style={{ color: C.faint, fontSize: 11 }}>({r.collCount} collected)</span></td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.paid)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: r.payable > 0 ? C.amber : C.faint, fontWeight: r.payable > 0 ? 700 : 400 }}>{fmt(r.payable)}</td>
                {canProcessPayouts && (
                  <td>{r.payable > 0 && <Btn small onClick={() => onRecordPayout(r.o, r.payable)}>Record payout</Btn>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>
        Weighted pipeline applies win probability; Forecast-category is the unweighted value of deals you would defend in a forecast call. Accrued commission becomes Matured on the date collection is confirmed. Cross-territory agreements split a deal's direct commission between the owning and assisting BD automatically. Payable = Matured minus payouts already recorded by Finance. All figures are indicative — the payroll calculation on actual collections remains authoritative.
      </div>
    </div>
  );
}

function MeetingNoteForm({ onSave, onClose }) {
  const [f, setF] = useState({ date: today(), venue: "", attendees: "", orgResponsibility: "", issues: "", leadershipNeeded: false, leadershipNote: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Meeting brief" onClose={onClose}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Stage moved to Meeting Held — capture the brief while it's fresh.</div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Date" flex><input type="date" style={inputStyle} value={f.date} onChange={set("date")} /></Field>
        <Field label="Venue" flex><input style={inputStyle} value={f.venue} onChange={set("venue")} placeholder="e.g. KQ HQ, Nairobi" /></Field>
      </div>
      <Field label="Who was in attendance"><textarea style={{ ...inputStyle, minHeight: 45 }} value={f.attendees} onChange={set("attendees")} placeholder="Names & titles, both sides" /></Field>
      <Field label="Responsibility within our org"><input style={inputStyle} value={f.orgResponsibility} onChange={set("orgResponsibility")} placeholder="Who owns the follow-up" /></Field>
      <Field label="Issue(s) for discussion"><textarea style={{ ...inputStyle, minHeight: 55 }} value={f.issues} onChange={set("issues")} /></Field>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
        <input type="checkbox" checked={f.leadershipNeeded} onChange={(e) => setF({ ...f, leadershipNeeded: e.target.checked })} id="ldr" />
        <label htmlFor="ldr" style={{ fontSize: 13, fontWeight: 600 }}>Leadership involvement needed?</label>
      </div>
      {f.leadershipNeeded && <Field label="Detail"><input style={inputStyle} value={f.leadershipNote} onChange={set("leadershipNote")} placeholder="What's needed from leadership" /></Field>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Skip</Btn>
        <Btn onClick={() => onSave(f)}>Save brief</Btn>
      </div>
    </Modal>
  );
}

function AgreementForm({ deal, bds, onSave, onClose }) {
  const otherBDs = bds.filter((b) => b.id !== deal?.ownerId);
  const [f, setF] = useState(deal?.agreement || { assistBDId: otherBDs[0]?.id || "", splitPct: 20, notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={`Cross-territory agreement — ${deal?.name || ""}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Arranges a split of the deal owner's direct commission with an assisting BD from another territory. The Area Director's override is unaffected.</div>
      <Field label="Assisting BD">
        <select style={inputStyle} value={f.assistBDId} onChange={set("assistBDId")}>{otherBDs.map((b) => <option key={b.id} value={b.id}>{b.name}{b.region ? ` — ${b.region}` : ""}</option>)}</select>
      </Field>
      <Field label="Split to assisting BD (% of owner's direct commission)"><input type="number" min="0" max="100" style={inputStyle} value={f.splitPct} onChange={set("splitPct")} /></Field>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.notes} onChange={set("notes")} placeholder="e.g. Air Peace introduction sourced by Isaac, account owned by Zelealem" /></Field>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        {deal?.agreement && <Btn kind="danger" onClick={() => onSave(null)}>Remove agreement</Btn>}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => onSave({ assistBDId: f.assistBDId, splitPct: Number(f.splitPct) || 0, notes: f.notes, createdAt: today() })}>Save agreement</Btn>
        </div>
      </div>
    </Modal>
  );
}

function PayoutForm({ owner, defaultAmount, onSave, onClose }) {
  const [f, setF] = useState({ ownerId: owner.id, amount: Math.round(defaultAmount || 0), date: today(), note: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={`Record payout — ${owner.name}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Logs commission paid out to staff. Reduces their outstanding payable in the statement.</div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Amount (USD)" flex><input type="number" style={inputStyle} value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Date" flex><input type="date" style={inputStyle} value={f.date} onChange={set("date")} /></Field>
      </div>
      <Field label="Note"><input style={inputStyle} value={f.note} onChange={set("note")} placeholder="e.g. July payroll run" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave({ ...f, amount: Number(f.amount) || 0 })}>Save payout</Btn>
      </div>
    </Modal>
  );
}

function LostReasonForm({ onSave, onClose }) {
  const [reason, setReason] = useState("Price");
  const [note, setNote] = useState("");
  return (
    <Modal title="Why was this deal lost?" onClose={onClose}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Capturing the reason feeds the win/loss analysis in Insights — thirty seconds now buys strategy later.</div>
      <Field label="Primary reason">
        <select style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)}>{LOSS_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      </Field>
      <Field label="Detail (optional)"><textarea style={{ ...inputStyle, minHeight: 50 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. OEM matched our price with 60-day terms" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Skip</Btn>
        <Btn onClick={() => onSave(reason, note)}>Save reason</Btn>
      </div>
    </Modal>
  );
}

function RegForm({ account, onSave, onClose }) {
  const [f, setF] = useState(account.reg || { status: "Not started", submitted: "", expected: "", expiry: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={`Vendor registration — ${account.name}`} onClose={onClose}>
      <Field label="Status">
        <select style={inputStyle} value={f.status} onChange={set("status")}>{REG_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Docs submitted" flex><input type="date" style={inputStyle} value={f.submitted} onChange={set("submitted")} /></Field>
        <Field label="Expected award" flex><input type="date" style={inputStyle} value={f.expected} onChange={set("expected")} /></Field>
      </div>
      <Field label="Approval expiry (if awarded)"><input type="date" style={inputStyle} value={f.expiry} onChange={set("expiry")} /></Field>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 55 }} value={f.notes} onChange={set("notes")} placeholder="e.g. Register Vogt PMA and Oshino under separate procurement committees" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(f)}>Save registration</Btn>
      </div>
    </Modal>
  );
}

/* ------------------------------- Forms ----------------------------- */

function QuoteForm({ item, preset, accounts, deals, contacts, quotes, catalog, me, thresholds, termsMatrix, quoteCount, onSave, onClose }) {
  const year = new Date().getFullYear();
  const [f, setF] = useState(item || {
    id: uid(), number: `Q-${year}-${String(quoteCount + 1).padStart(3, "0")}`, accountId: preset?.accountId || accounts[0]?.id || "", oppId: preset?.oppId || "", ownerId: me.id,
    lines: [{ itemId: catalog[0]?.id || "", qty: 1, unitPrice: catalog[0]?.listPrice || 0, cond: "NE", leadTime: catalog[0]?.lead || "" }],
    discountPct: 0, paymentTerms: "Cash on Order", incoterm: "EXW Hollywood, FL", attention: "", customerRef: "", status: "Draft", chain: [], approvals: [], createdAt: today(), rfqDate: "", sentAt: "", notes: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const itemById = (id) => catalog.find((p) => p.id === id);

  const tierPrice = (it, qty) => (it?.bulkQty && Number(qty) >= it.bulkQty && it.bulkPrice) ? it.bulkPrice : (it?.listPrice ?? 0);
  const setLine = (i, k, v) => {
    setF({
      ...f,
      lines: f.lines.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, [k]: v };
        if (k === "itemId") {
          const it = itemById(v);
          next.unitPrice = tierPrice(it, next.qty);
          next.leadTime = it?.lead || next.leadTime || "";
        }
        if (k === "qty") {
          const it = itemById(next.itemId);
          // pricing engine: snap to the correct tier unless the rep typed a custom price
          const standard = [it?.listPrice, it?.bulkPrice].filter((x) => x !== undefined);
          if (it && (standard.includes(Number(l.unitPrice)) || Number(l.unitPrice) === 0)) {
            next.unitPrice = tierPrice(it, v);
          }
        }
        return next;
      }),
    });
  };
  const addLine = () => setF({ ...f, lines: [...f.lines, { itemId: catalog[0]?.id || "", qty: 1, unitPrice: catalog[0]?.listPrice || 0, cond: "NE", leadTime: catalog[0]?.lead || "" }] });
  const delLine = (i) => setF({ ...f, lines: f.lines.filter((_, idx) => idx !== i) });

  const sub = quoteSubtotal(f);
  const pct = Number(f.discountPct) || 0;
  const net = sub * (1 - pct / 100);
  const term = f.paymentTerms || "Cash on Order";
  const chain = chainForQuote(pct, term, thresholds, termsMatrix);
  const dD = discountDepth(pct, thresholds);
  const tD = termsDepth(term, termsMatrix);
  const accountDeals = deals.filter((d) => d.accountId === f.accountId && d.stage !== "Won" && d.stage !== "Lost");
  const pastOrders = (quotes || []).filter((q) => q.accountId === f.accountId && q.status === "Accepted" && q.id !== f.id).sort((a, b) => (b.sentAt || b.createdAt).localeCompare(a.sentAt || a.createdAt));
  const useAsTemplate = (pq) => setF({ ...f, lines: pq.lines.map((l) => ({ ...l })), notes: f.notes ? f.notes : `Repeat order — referencing ${pq.number}.` });

  return (
    <Modal title={item ? `Edit quote ${f.number}` : `New quote ${f.number}`} onClose={onClose} wide>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Account" flex>
          <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value, oppId: "" })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
        <Field label="Link opportunity (optional)" flex>
          <select style={inputStyle} value={f.oppId} onChange={set("oppId")}>
            <option value="">None</option>
            {accountDeals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Attention (contact)" flex>
          <select style={inputStyle} value={f.attention || ""} onChange={set("attention")}>
            <option value="">—</option>
            {(contacts || []).filter((c) => c.accountId === f.accountId).map((c) => <option key={c.id} value={c.name}>{c.name}{c.title ? ` — ${c.title}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Customer ref / RFQ no." flex><input style={inputStyle} value={f.customerRef || ""} onChange={set("customerRef")} placeholder="e.g. KQ-RFQ-2026-0412" /></Field>
        <Field label="Delivery (Incoterms 2020)" flex>
          <select style={inputStyle} value={f.incoterm || INCOTERMS[0]} onChange={set("incoterm")}>{INCOTERMS.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
      </div>

      {pastOrders.length > 0 && (
        <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>Past orders for this account — reference for repeat business</div>
          {pastOrders.slice(0, 4).map((pq) => (
            <div key={pq.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.surface}` }}>
              <div>
                <strong>{pq.number}</strong> · {pq.sentAt || pq.createdAt} · {pq.lines.length} line{pq.lines.length > 1 ? "s" : ""} · {fmt(quoteNet(pq))}
                <span style={{ color: C.faint }}> — {pq.lines.map((l) => catalog.find((p) => p.id === l.itemId)?.name).filter(Boolean).slice(0, 2).join(", ")}{pq.lines.length > 2 ? "…" : ""}</span>
              </div>
              <button onClick={() => useAsTemplate(pq)} style={{ background: "none", border: `1px solid ${C.teal}`, color: C.teal, borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Use as template</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>Line items (from catalog)</div>
      {f.lines.map((l, i) => {
        const it = itemById(l.itemId);
        return (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select style={{ ...inputStyle, flex: "3 1 220px" }} value={l.itemId} onChange={(e) => setLine(i, "itemId", e.target.value)}>
              {Object.keys(PRODUCTS).map((line) => (
                <optgroup key={line} label={line}>
                  {catalog.filter((p) => p.productLine === line).map((p) => <option key={p.id} value={p.id}>{p.pn ? `[${p.pn}] ` : ""}{p.name} — {p.listPrice > 0 ? fmt2(p.listPrice) : "POA"}</option>)}
                </optgroup>
              ))}
            </select>
            <select style={{ ...inputStyle, flex: "0 1 70px" }} value={l.cond || "NE"} onChange={(e) => setLine(i, "cond", e.target.value)} title="Condition code">
              {COND_CODES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" min="1" style={{ ...inputStyle, flex: "1 1 60px" }} value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} placeholder="Qty" />
            <input style={{ ...inputStyle, flex: "1 1 85px" }} value={l.leadTime || ""} onChange={(e) => setLine(i, "leadTime", e.target.value)} placeholder="Lead time" title="Lead time" />
            <input type="number" step="0.01" style={{ ...inputStyle, flex: "1 1 95px" }} value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", e.target.value)} placeholder="Unit $" />
            <div style={{ width: 85, fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</div>
            {f.lines.length > 1 && <IconBtn onClick={() => delLine(i)} color={C.red}><Trash2 size={14} /></IconBtn>}
            {it?.bulkQty && (
              <div style={{ width: "100%", fontSize: 11, color: Number(l.qty) >= it.bulkQty ? C.green : C.sub, fontWeight: Number(l.qty) >= it.bulkQty ? 600 : 400 }}>
                Volume tier: {fmt2(it.bulkPrice)} at {it.bulkQty}+ units{Number(l.qty) >= it.bulkQty ? " — applied automatically" : ""}
              </div>
            )}
            {it && it.listPrice > 0 && Number(l.unitPrice) !== it.listPrice && Number(l.unitPrice) !== it.bulkPrice && <div style={{ width: "100%", fontSize: 11, color: C.amber }}>Unit price differs from list ({fmt2(it.listPrice)}{it.bulkQty ? ` / ${fmt2(it.bulkPrice)} @${it.bulkQty}+` : ""}). Use the discount field for approved discounting; line price changes bypass the workflow.</div>}
          </div>
        );
      })}
      <button onClick={addLine} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", marginBottom: 12 }}>+ Add line</button>

      {[...new Set(f.lines.map((l) => itemById(l.itemId)?.productLine).filter(Boolean))].map((pl) => GUIDANCE[pl] && (
        <div key={pl} style={{ background: C.greenBg, borderRadius: 4, padding: "8px 10px", fontSize: 12, color: C.ink, marginBottom: 8 }}>
          <strong style={{ color: C.green }}>Guided selling — {pl}:</strong> {GUIDANCE[pl]}
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Discount (%)">
          <input type="number" min="0" max="60" style={{ ...inputStyle, width: 100 }} value={f.discountPct} onChange={set("discountPct")} />
        </Field>
        <Field label="Payment terms">
          <select style={{ ...inputStyle, width: 170 }} value={term} onChange={set("paymentTerms")}>
            {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="RFQ received (mandatory)">
          <input type="date" required style={{ ...inputStyle, width: 150, borderColor: f.rfqDate ? C.line : C.red }} value={f.rfqDate || ""} onChange={set("rfqDate")} />
          {!f.rfqDate && <div style={{ fontSize: 10.5, color: C.red, marginTop: 3 }}>Required before this quote can be submitted for approval.</div>}
        </Field>
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          Subtotal <strong>{fmt(sub)}</strong> · Discount −{fmt(sub - net)} · Net <strong style={{ fontSize: 15 }}>{fmt(net)}</strong>
        </div>
      </div>

      <div style={{ background: C.bg, borderRadius: 4, padding: "10px 12px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>Approval required</div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>
          Discount {pct}%: {dD === 0 ? "no approval" : `through ${APPROVAL_LEVELS[dD - 1].role}`} · Terms "{term}": {tD === 0 ? "no approval" : `through ${APPROVAL_LEVELS[tD - 1].role}`} — deepest requirement sets the chain.
        </div>
        {chain.length === 0 ? (
          <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}><Check size={13} style={{ verticalAlign: "-2px" }} /> Within standard discretion — auto-approves on submit.</div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {chain.map((role, i) => (
              <span key={role} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {i > 0 && <span style={{ color: C.faint }}>→</span>}
                <Tag color={roleColorMap[role]}>{role}</Tag>
              </span>
            ))}
          </div>
        )}
      </div>

      <Field label="Notes / justification for approvers"><textarea style={{ ...inputStyle, minHeight: 55 }} value={f.notes} onChange={set("notes")} placeholder="e.g. Volume commitment; matches competitor offer at Ethiopian MRO" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => {
          if (!f.rfqDate) { alert("RFQ received date is mandatory."); return; }
          if (f.lines.length) onSave({ ...f, discountPct: pct, lines: f.lines.map((l) => ({ ...l, qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0 })) });
        }}>Save draft</Btn>
      </div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>Saved as Draft — submit it from the Quotes table to start the approval chain.</div>
    </Modal>
  );
}

function ProductForm({ item, onSave, onClose }) {
  const [f, setF] = useState(item || { id: uid(), productLine: "Oshino Lamps", pn: "", name: "", unit: "EA", listPrice: 0, lead: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={item ? "Edit catalog item" : "New catalog item"} onClose={onClose}>
      <Field label="Product line"><select style={inputStyle} value={f.productLine} onChange={set("productLine")}>{Object.keys(PRODUCTS).map((p) => <option key={p}>{p}</option>)}</select></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Part number" flex><input style={inputStyle} value={f.pn || ""} onChange={set("pn")} placeholder="e.g. VA-2540-T01" /></Field>
        <Field label="UOM" flex><input style={inputStyle} value={f.unit} onChange={set("unit")} placeholder="EA / KIT / EVT" /></Field>
      </div>
      <Field label="Description"><input style={inputStyle} value={f.name} onChange={set("name")} placeholder="e.g. Hot Water Tank Assy (OEM 8921110G5)" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Standard lead time" flex><input style={inputStyle} value={f.lead || ""} onChange={set("lead")} placeholder="Stock / 2-3 wks / Per T/A" /></Field>
        <Field label="List price (USD)" flex><input type="number" step="0.01" style={inputStyle} value={f.listPrice} onChange={set("listPrice")} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.name.trim() && onSave({ ...f, listPrice: Number(f.listPrice) || 0 })}>Save item</Btn>
      </div>
    </Modal>
  );
}

function DealForm({ item, accounts, owners, me, lockOwner, roleOf, onSave, onClose }) {
  const [f, setF] = useState(item || {
    id: uid(), name: "", accountId: accounts[0]?.id || "", ownerId: me.id,
    lines: [{ product: "Oshino Lamps", value: 0 }],
    stage: "Prospect", prob: 10, forecastCat: "Pipeline", closeDate: "", notes: "", createdAt: today(), closedAt: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setStageLocal = (e) => {
    const stage = e.target.value;
    setF({ ...f, stage, prob: STAGE_PROB[stage] ?? f.prob, forecastCat: STAGE_FCAT[stage] || f.forecastCat, closedAt: (stage === "Won" || stage === "Lost") ? (f.closedAt || today()) : "" });
  };
  const setLine = (i, k, v) => setF({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)) });
  const addLine = () => setF({ ...f, lines: [...f.lines, { product: "Oshino Lamps", value: 0 }] });
  const delLine = (i) => setF({ ...f, lines: f.lines.filter((_, idx) => idx !== i) });
  const total = f.lines.reduce((s, l) => s + (Number(l.value) || 0), 0);
  const ownerRole = (roleOf && roleOf(f.ownerId)) || "Territory Manager (BD)";
  const directRate = ownerRole === "Area Director" ? AD_DIRECT_RATE : BDM_RATE;
  const comm = total * directRate;
  const override = total * AD_OVERRIDE_RATE;

  return (
    <Modal title={item ? "Edit opportunity" : "New opportunity"} onClose={onClose} wide>
      <Field label="Opportunity name"><input style={inputStyle} value={f.name} onChange={set("name")} placeholder="e.g. PMA parts evaluation" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Account" flex>
          <select style={inputStyle} value={f.accountId} onChange={set("accountId")}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
        <Field label="Owner" flex>
          <select style={inputStyle} value={f.ownerId} onChange={set("ownerId")} disabled={lockOwner}>{owners.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </Field>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>Revenue lines</div>
      {f.lines.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <select style={{ ...inputStyle, flex: 2 }} value={l.product} onChange={(e) => setLine(i, "product", e.target.value)}>
            {Object.keys(PRODUCTS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="number" style={{ ...inputStyle, flex: 1 }} value={l.value} onChange={(e) => setLine(i, "value", e.target.value)} placeholder="USD" />
          {f.lines.length > 1 && <IconBtn onClick={() => delLine(i)} color={C.red}><Trash2 size={14} /></IconBtn>}
        </div>
      ))}
      <button onClick={addLine} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", marginBottom: 10 }}>+ Add product line</button>
      <div style={{ fontSize: 12, color: C.teal, marginBottom: 12 }}>
        Total {fmt(total)} · {ownerRole} direct commission ({(directRate * 100).toFixed(0)}%) <strong>{fmt(comm)}</strong>
        {ownerRole !== "Area Director" && <span style={{ color: C.faint }}> · +1% Area Director territory override {fmt(override)}</span>}
        {f.agreement?.assistBDId && <span style={{ color: C.amber }}> · Cross-territory split active — see Pipeline</span>}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Stage" flex>
          <select style={inputStyle} value={f.stage} onChange={setStageLocal}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Win %" flex><input type="number" min="0" max="100" style={inputStyle} value={f.prob} onChange={(e) => setF({ ...f, prob: Number(e.target.value) })} /></Field>
        <Field label="Forecast category" flex>
          <select style={inputStyle} value={f.forecastCat} onChange={set("forecastCat")}>{FORECAST_CATS.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Target close" flex><input type="date" style={inputStyle} value={f.closeDate} onChange={set("closeDate")} /></Field>
        <Field label="Created" flex><input type="date" style={inputStyle} value={f.createdAt} onChange={set("createdAt")} /></Field>
      </div>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={f.notes} onChange={set("notes")} /></Field>
      {(f.meetingNotes || []).length > 0 && (
        <div style={{ marginTop: 4, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>Meeting brief history</div>
          {f.meetingNotes.map((n, i) => (
            <div key={i} style={{ fontSize: 12, background: C.bg, borderRadius: 4, padding: "8px 10px", marginBottom: 6 }}>
              <strong>{n.date}</strong> · {n.venue} — Attendees: {n.attendees} · Owner: {n.orgResponsibility}
              <div style={{ color: C.sub, marginTop: 2 }}>Issue: {n.issues}</div>
              {n.leadershipNeeded && <div style={{ color: C.amber, fontWeight: 700, marginTop: 2 }}>⚠ Leadership involvement requested</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.name.trim() && onSave({ ...f, lines: f.lines.map((l) => ({ ...l, value: Number(l.value) || 0 })) })}>Save opportunity</Btn>
      </div>
    </Modal>
  );
}

function LeadForm({ item, accounts, contacts, onSave, onClose }) {
  const [f, setF] = useState(item || { id: uid(), accountId: accounts[0]?.id || "", contactId: "", contactName: "", title: "", source: "Referral", product: "Oshino Lamps", est: 0, status: "Unqualified", rank: "Warm", notes: "", createdAt: today() });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const acctContacts = contacts.filter((c) => c.accountId === f.accountId);
  const selectedAccount = accounts.find((a) => a.id === f.accountId);
  return (
    <Modal title={item ? "Edit lead" : "New lead"} onClose={onClose}>
      <Field label="Airline / company">
        <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value, contactId: "" })}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <div style={{ fontSize: 11, color: C.faint, marginTop: -8, marginBottom: 10 }}>
        Don't see the airline? Only the Area Director can add a new account — ask them to create it first, then log this lead against it.{selectedAccount ? ` Region: ${selectedAccount.region}.` : ""}
      </div>
      <Field label="Contact">
        <select style={inputStyle} value={f.contactId} onChange={set("contactId")}>
          <option value="">— New / not listed (type below) —</option>
          {acctContacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ""}</option>)}
        </select>
      </Field>
      {!f.contactId && (
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="New contact name" flex><input style={inputStyle} value={f.contactName} onChange={set("contactName")} /></Field>
          <Field label="Title" flex><input style={inputStyle} value={f.title} onChange={set("title")} /></Field>
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Source" flex><select style={inputStyle} value={f.source} onChange={set("source")}>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Rank" flex><select style={inputStyle} value={f.rank || "Warm"} onChange={set("rank")}>{LEAD_RANKS.map((r) => <option key={r}>{r}</option>)}</select></Field>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Product interest" flex><select style={inputStyle} value={f.product} onChange={set("product")}>{Object.keys(PRODUCTS).map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Est. value (USD)" flex><input type="number" style={inputStyle} value={f.est} onChange={set("est")} /></Field>
      </div>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.accountId && onSave({ ...f, est: Number(f.est) || 0 })}>Save lead</Btn>
      </div>
    </Modal>
  );
}

function AccountForm({ item, owners, me, lockOwner, onSave, onClose }) {
  const [f, setF] = useState(item || { id: uid(), name: "", tier: "Tier 2", region: "East Africa", country: "", ownerId: me.id, notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={item ? "Edit account" : "New account"} onClose={onClose}>
      <Field label="Airline / organisation"><input style={inputStyle} value={f.name} onChange={set("name")} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Tier" flex><select style={inputStyle} value={f.tier} onChange={set("tier")}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Region" flex>
          <select style={inputStyle} value={f.region} onChange={set("region")}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Country" flex><input style={inputStyle} value={f.country} onChange={set("country")} /></Field>
        <Field label="Owner" flex><select style={inputStyle} value={f.ownerId} onChange={set("ownerId")} disabled={lockOwner}>{owners.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.name.trim() && onSave(f)}>Save account</Btn>
      </div>
    </Modal>
  );
}

function ContactForm({ item, accounts, onSave, onClose }) {
  const [f, setF] = useState(item || { id: uid(), name: "", title: "", accountId: accounts[0]?.id || "", email: "", phone: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={item ? "Edit contact" : "New contact"} onClose={onClose}>
      <Field label="Name"><input style={inputStyle} value={f.name} onChange={set("name")} /></Field>
      <Field label="Title"><input style={inputStyle} value={f.title} onChange={set("title")} /></Field>
      <Field label="Account"><select style={inputStyle} value={f.accountId} onChange={set("accountId")}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Email" flex><input style={inputStyle} value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone" flex><input style={inputStyle} value={f.phone} onChange={set("phone")} /></Field>
      </div>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.notes} onChange={set("notes")} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.name.trim() && onSave(f)}>Save contact</Btn>
      </div>
    </Modal>
  );
}

function ActivityForm({ accounts, onSave, onClose }) {
  const [f, setF] = useState({ id: uid(), text: "", accountId: "", due: "", done: false });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="New action" onClose={onClose}>
      <Field label="What needs doing"><input style={inputStyle} value={f.text} onChange={set("text")} placeholder="e.g. Follow up on RFQ with Jambojet" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Linked account (optional)" flex>
          <select style={inputStyle} value={f.accountId} onChange={set("accountId")}>
            <option value="">None</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Due date" flex><input type="date" style={inputStyle} value={f.due} onChange={set("due")} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.text.trim() && onSave(f)}>Save action</Btn>
      </div>
    </Modal>
  );
}

function InteractionForm({ account, onSave, onClose }) {
  const [f, setF] = useState({ id: uid(), accountId: account.id, type: "Call", date: today(), summary: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={`Log touch — ${account.name}`} onClose={onClose}>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Type" flex><select style={inputStyle} value={f.type} onChange={set("type")}>{INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Date" flex><input type="date" style={inputStyle} value={f.date} onChange={set("date")} /></Field>
      </div>
      <Field label="Summary"><textarea style={{ ...inputStyle, minHeight: 60 }} value={f.summary} onChange={set("summary")} placeholder="e.g. Call with CTO — asked for Oshino cross-reference list" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.summary.trim() && onSave(f)}>Log it</Btn>
      </div>
    </Modal>
  );
}

function UsersForm({ users, onSave, onClose }) {
  const [list, setList] = useState(users);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Territory Manager (BD)");
  const [region, setRegion] = useState("East Africa");
  const add = () => {
    if (!name.trim()) return;
    setList([...list, { id: uid(), name: name.trim(), role, region: role === "Territory Manager (BD)" ? region : "" }]);
    setName("");
  };
  return (
    <Modal title="Users & roles" onClose={onClose} wide>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
        BDs are locked to their territory. COO, CEO and President see everything read-only and approve quotes at their level. Analysts are pure read-only.
      </div>
      {list.map((u) => (
        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.bg}`, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</span>
            {u.region && <span style={{ fontSize: 12, color: C.faint, marginLeft: 8 }}>{u.region}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Tag color={roleColorMap[u.role] || C.faint}>{u.role}</Tag>
            {list.length > 1 && <IconBtn onClick={() => setList(list.filter((x) => x.id !== u.id))} color={C.red}><Trash2 size={14} /></IconBtn>}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, flex: "2 1 140px" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <select style={{ ...inputStyle, flex: "1 1 160px" }} value={role} onChange={(e) => setRole(e.target.value)}>{ROLE_NAMES.map((r) => <option key={r}>{r}</option>)}</select>
        {role === "Territory Manager (BD)" && (
          <select style={{ ...inputStyle, flex: "1 1 130px" }} value={region} onChange={(e) => setRegion(e.target.value)}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
        )}
        <Btn small onClick={add}>Add</Btn>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(list)}>Save users</Btn>
      </div>
    </Modal>
  );
}
