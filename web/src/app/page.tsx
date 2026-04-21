"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type SurfacePoint = {
  label: string;
  median: number;
  p75: number;
  p25: number;
  p90: number;
  p10: number;
};

type SurfaceKey = keyof Omit<SurfacePoint, "label">;

type LandingArtifact = {
  title: string;
  subtitle: string;
  scenario: string;
  chartEyebrow: string;
  chartDescription: string;
  cvarLabel: string;
  legend: {
    success: string;
    primary: string;
    danger: string;
  };
  contributionsTitle: string;
  decisionTitle: string;
  decisionAction: string;
  decisionText: string;
  confidence: string;
  chips: readonly string[];
};

const SURFACE_SERIES: SurfacePoint[] = [
  { label: "T0", median: 100, p75: 101, p25: 99, p90: 102, p10: 98 },
  { label: "Q1", median: 97, p75: 99, p25: 94, p90: 101, p10: 91 },
  { label: "Q2", median: 95, p75: 97, p25: 90, p90: 100, p10: 85 },
  { label: "Q3", median: 92, p75: 95, p25: 87, p90: 98, p10: 80 },
  { label: "Q4", median: 90, p75: 93, p25: 83, p90: 96, p10: 76 },
  { label: "Q6", median: 88, p75: 91, p25: 80, p90: 94, p10: 72 },
];

const CONTRIBUTION_ROWS = [
  { ticker: "XOM", share: "32%", width: 32, tone: "danger" },
  { ticker: "DAL", share: "24%", width: 24, tone: "primary" },
  { ticker: "CEMEX", share: "17%", width: 17, tone: "primary" },
] as const;

const CHART = {
  width: 560,
  height: 240,
  paddingX: 30,
  paddingTop: 16,
  paddingBottom: 28,
};

const SURFACE_VALUES = SURFACE_SERIES.flatMap((point) => [
  point.median,
  point.p75,
  point.p25,
  point.p90,
  point.p10,
]);

const MAX_VALUE = Math.max(...SURFACE_VALUES) + 2;
const MIN_VALUE = Math.min(...SURFACE_VALUES) - 2;
const Y_TICKS = [100, 92, 84, 76];

function xFor(index: number) {
  const usableWidth = CHART.width - CHART.paddingX * 2;
  return CHART.paddingX + (usableWidth / (SURFACE_SERIES.length - 1)) * index;
}

function yFor(value: number) {
  const usableHeight = CHART.height - CHART.paddingTop - CHART.paddingBottom;
  return CHART.paddingTop + ((MAX_VALUE - value) / (MAX_VALUE - MIN_VALUE)) * usableHeight;
}

function buildLinePath(key: SurfaceKey) {
  return SURFACE_SERIES.map((point, index) => {
    const prefix = index === 0 ? "M" : "L";
    return `${prefix} ${xFor(index)} ${yFor(point[key])}`;
  }).join(" ");
}

function buildBandPath(upperKey: SurfaceKey, lowerKey: SurfaceKey) {
  const upper = SURFACE_SERIES.map((point, index) => `${xFor(index)} ${yFor(point[upperKey])}`);
  const lower = [...SURFACE_SERIES].reverse().map((point, index) => {
    const reversedIndex = SURFACE_SERIES.length - 1 - index;
    return `${xFor(reversedIndex)} ${yFor(point[lowerKey])}`;
  });

  return `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`;
}

const OUTER_BAND = buildBandPath("p90", "p10");
const INNER_BAND = buildBandPath("p75", "p25");
const MEDIAN_LINE = buildLinePath("median");

export default function LandingPage() {
  const { dictionary } = useLanguage();
  const { landing, shared } = dictionary;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_24%,rgba(245,195,71,0.08),transparent_30%),radial-gradient(circle_at_84%_72%,rgba(245,195,71,0.04),transparent_26%)]" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="font-display text-xl font-bold text-obsidian-on">
            Stochasto<span className="text-primary">Green</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 font-mono text-[0.58rem] tracking-[0.16em] text-obsidian-outline uppercase">
              <span>{shared.family}</span>
              <span className="text-obsidian-outline-var">·</span>
              <span className="text-primary">{landing.headerTag}</span>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.96fr)] gap-12 lg:gap-16 items-center pt-12 lg:pt-20 pb-16 lg:pb-24">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="flex flex-col gap-7"
          >
            <div className="inline-flex items-center gap-3 w-fit border border-primary/20 bg-primary/5 px-3 py-2 font-mono text-[0.6rem] tracking-[0.16em] text-obsidian-on-var uppercase">
              <span className="text-obsidian-outline">{landing.eyebrowPrefix}</span>
              <span className="text-obsidian-outline-var">·</span>
              <span className="text-primary">{landing.eyebrowArtifact}</span>
            </div>

            <div className="space-y-4">
              <div className="font-display text-[clamp(2.6rem,6vw,5rem)] font-bold leading-none text-obsidian-on">
                Stochasto<span className="text-primary">Green</span>
              </div>
              <h1 className="max-w-[13ch] font-display text-[clamp(2.3rem,5vw,4.2rem)] font-bold leading-[0.96] tracking-[-0.03em] text-obsidian-on">
                {landing.headline}
              </h1>
            </div>

            <p className="max-w-xl text-[1rem] lg:text-[1.05rem] leading-relaxed text-obsidian-on-var">
              {landing.description}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-primary text-obsidian-bg font-display text-[0.72rem] font-bold tracking-[0.18em] uppercase hover:bg-primary-dim transition-colors shadow-[0_0_30px_rgba(245,195,71,0.18)]"
              >
                {landing.primaryCta}
              </Link>
              <Link
                href="/register"
                className="px-6 py-3 border border-obsidian-outline text-obsidian-on font-display text-[0.72rem] font-bold tracking-[0.18em] uppercase hover:bg-obsidian-mid transition-colors"
              >
                {landing.secondaryCta}
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-obsidian-outline-var">
              {landing.signals.map((signal) => (
                <div key={signal.label} className="space-y-1.5">
                  <div className="font-mono text-[0.58rem] tracking-[0.16em] text-obsidian-outline uppercase">
                    {signal.label}
                  </div>
                  <div className="font-display text-[0.92rem] font-semibold text-obsidian-on">{signal.value}</div>
                  <div className="text-[0.78rem] leading-relaxed text-obsidian-on-var">{signal.detail}</div>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.1 }}
          >
            <RiskArtifact artifact={landing.artifact} />
          </motion.aside>
        </main>

        <footer className="border-t border-obsidian-outline-var pt-6 flex flex-col md:flex-row justify-between gap-3 text-[0.6rem] font-mono tracking-[0.14em] uppercase text-obsidian-outline">
          <div>© 2026 The Velveteen Project // StochastoGreen</div>
          <div className="text-obsidian-on-var">{landing.footer}</div>
        </footer>
      </div>
    </div>
  );
}

function RiskArtifact({ artifact }: { artifact: LandingArtifact }) {
  return (
    <div className="panel bg-obsidian-low/95 shadow-[0_0_42px_rgba(0,0,0,0.32)]">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(245,195,71,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />

      <div className="relative p-5 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b border-obsidian-outline-var">
          <div>
            <div className="font-mono text-[0.58rem] tracking-[0.16em] text-obsidian-outline uppercase mb-2">
              {artifact.title}
            </div>
            <div className="font-display text-[0.96rem] font-semibold tracking-[0.08em] text-obsidian-on uppercase">
              {artifact.subtitle}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 h-fit px-3 py-1.5 border border-primary/25 bg-primary/5 font-mono text-[0.58rem] tracking-[0.16em] text-primary uppercase">
            {artifact.scenario}
          </div>
        </div>

        <div className="mt-5 border border-obsidian-outline-var bg-[linear-gradient(180deg,rgba(26,26,28,0.96),rgba(14,14,16,1))] p-4 lg:p-5">
          <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
            <div>
              <div className="font-mono text-[0.58rem] tracking-[0.16em] text-obsidian-outline uppercase mb-1">
                {artifact.chartEyebrow}
              </div>
              <div className="text-[0.82rem] text-obsidian-on-var">{artifact.chartDescription}</div>
            </div>
            <div className="font-mono text-[0.6rem] tracking-[0.16em] text-primary uppercase whitespace-nowrap">
              {artifact.cvarLabel}
            </div>
          </div>

          <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="w-full h-auto">
            {Y_TICKS.map((tick) => (
              <g key={tick}>
                <line
                  x1={CHART.paddingX}
                  x2={CHART.width - CHART.paddingX}
                  y1={yFor(tick)}
                  y2={yFor(tick)}
                  stroke="rgba(74,72,76,0.45)"
                  strokeDasharray="3 4"
                />
                <text
                  x={4}
                  y={yFor(tick) + 4}
                  fill="#6f6870"
                  fontSize="10"
                  fontFamily="var(--font-jetbrains-mono)"
                  letterSpacing="0.14em"
                >
                  {tick}
                </text>
              </g>
            ))}

            {SURFACE_SERIES.map((point, index) => (
              <text
                key={point.label}
                x={xFor(index)}
                y={CHART.height - 6}
                textAnchor="middle"
                fill="#6f6870"
                fontSize="10"
                fontFamily="var(--font-jetbrains-mono)"
                letterSpacing="0.14em"
              >
                {point.label}
              </text>
            ))}

            <path d={OUTER_BAND} fill="rgba(255,107,107,0.10)" />
            <path d={INNER_BAND} fill="rgba(245,195,71,0.14)" />
            <path d={MEDIAN_LINE} fill="none" stroke="#f5c347" strokeWidth="2.5" />
          </svg>

          <div className="mt-4 flex flex-wrap gap-4">
            <LegendSwatch label={artifact.legend.success} tone="success" />
            <LegendSwatch label={artifact.legend.primary} tone="primary" />
            <LegendSwatch label={artifact.legend.danger} tone="danger" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.08fr_0.92fr] gap-4 mt-4">
          <div className="border border-obsidian-outline-var bg-obsidian-mid/60 p-4">
            <div className="font-mono text-[0.58rem] tracking-[0.16em] text-obsidian-outline uppercase mb-3">
              {artifact.contributionsTitle}
            </div>
            <div className="space-y-3">
              {CONTRIBUTION_ROWS.map((row) => (
                <div key={row.ticker} className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[0.68rem]">
                    <span className="text-obsidian-on">{row.ticker}</span>
                    <span className={row.tone === "danger" ? "text-danger" : "text-primary"}>{row.share}</span>
                  </div>
                  <div className="h-1.5 bg-obsidian-high overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${row.width}%` }}
                      transition={{ duration: 0.8, delay: 0.15 }}
                      className={row.tone === "danger" ? "h-full bg-danger" : "h-full bg-primary"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-obsidian-outline-var bg-obsidian-mid/60 p-4">
            <div className="font-mono text-[0.58rem] tracking-[0.16em] text-obsidian-outline uppercase mb-3">
              {artifact.decisionTitle}
            </div>
            <div className="inline-flex px-2.5 py-1 border border-danger/35 bg-danger/10 font-mono text-[0.58rem] font-bold tracking-[0.16em] text-danger uppercase">
              {artifact.decisionAction}
            </div>
            <p className="mt-3 text-[0.82rem] leading-relaxed text-obsidian-on-var">{artifact.decisionText}</p>

            <div className="mt-4">
              <div className="flex items-center justify-between font-mono text-[0.58rem] tracking-[0.14em] uppercase text-obsidian-outline mb-2">
                <span>{artifact.confidence}</span>
                <span className="text-primary">74%</span>
              </div>
              <div className="h-1.5 bg-obsidian-high overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "74%" }}
                  transition={{ duration: 0.9, delay: 0.2 }}
                  className="h-full bg-primary"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {artifact.chips.map((chip) => (
                <span
                  key={chip}
                  className="px-2 py-1 border border-obsidian-outline-var font-mono text-[0.55rem] tracking-[0.14em] text-obsidian-on-var uppercase"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "success" | "danger";
}) {
  const toneClass = tone === "primary" ? "bg-primary" : tone === "success" ? "bg-success" : "bg-danger";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-[2px] ${toneClass}`} />
      <span className="font-mono text-[0.58rem] tracking-[0.14em] text-obsidian-on-var uppercase">{label}</span>
    </div>
  );
}
