"use client";

import { useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/types";

interface Step {
  label: string;
  state: string;
}

const money = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();

export default function Home() {
  const [input, setInput] = useState("");
  const [price, setPrice] = useState("");
  const [useCache, setUseCache] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; tone?: string }>({
    text: "Copart · paste a link to the lot page, or a bare lot number",
  });
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);

  // one-time reveal for stages (mirrors the original landing script)
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    document.querySelectorAll(".stage, .verdict__card").forEach((el) => {
      el.classList.add("will-reveal");
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if ((running || report) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [running, report]);

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    const value = input.trim();
    if (!value) {
      setNote({ text: "Needs a link to a Copart lot", tone: "bad" });
      return;
    }
    if (!useCache && !/copart|^\d{6,}$/i.test(value)) {
      setNote({
        text: "Needs a Copart lot URL or a lot number",
        tone: "bad",
      });
      return;
    }

    setSteps([]);
    setNotice(null);
    setError(null);
    setReport(null);
    setRunning(true);
    setNote({ text: "Analyzing the lot…", tone: "ok" });

    const params = new URLSearchParams({ input: value });
    if (price.trim()) params.set("price", price.trim());
    if (useCache) params.set("cache", "1");

    const es = new EventSource(`/api/analyze?${params.toString()}`);
    esRef.current = es;
    let completed = false;

    es.addEventListener("step", (ev) => {
      const s = JSON.parse((ev as MessageEvent).data) as Step;
      setSteps((prev) => {
        const cleared = prev.map((p) =>
          p.state === "active" ? { ...p, state: "done" } : p
        );
        if (s.state === "done") {
          const idx = cleared.findIndex((p) => p.label === s.label);
          if (idx >= 0) {
            cleared[idx] = { ...cleared[idx], state: "done" };
            return cleared;
          }
        }
        return [...cleared, s];
      });
    });

    es.addEventListener("notice", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as { message: string };
      setNotice(d.message);
    });

    es.addEventListener("report", (ev) => {
      const r = JSON.parse((ev as MessageEvent).data) as Report;
      completed = true;
      setReport(r);
      setRunning(false);
      setNote({ text: "Report ready", tone: "ok" });
      es.close();
    });

    es.addEventListener("error", (ev) => {
      if (completed) return;
      const raw = (ev as MessageEvent).data;
      if (raw) {
        try {
          const d = JSON.parse(raw) as { message: string };
          setError(d.message);
          setNote({ text: d.message, tone: "bad" });
        } catch {
          setError("Stream error.");
        }
      } else if (!report) {
        setError("Connection lost before the report arrived.");
      }
      setRunning(false);
      es.close();
    });
  }

  return (
    <>
      <nav className="pill" aria-label="Main navigation">
        <a className="pill__brand" href="#top">
          carify
        </a>
        <div className="pill__links">
          <a className="pill__link" href="#process">
            Process
          </a>
          <a className="pill__link" href="#example">
            Example
          </a>
        </div>
        <a className="pill__cta" href="#check">
          Check a lot
        </a>
      </nav>

      <header className="hero" id="top">
        <div className="hero__inner">
          <div className="hero__copy">
            <h1 className="hero__title">
              A verdict on the lot — <span className="hero__mark">before you bid</span>
            </h1>
            <p className="hero__lede">
              CARify reads the photos of a Copart lot the way a reseller with ten
              years of experience does: impact zones, airbags, water traces,
              running gear — and calculates how much this car can earn you in
              Georgia.
            </p>

            <form className="check" id="check" noValidate onSubmit={start}>
              <label className="visually-hidden" htmlFor="lot-url">
                Auction lot URL
              </label>
              <input
                className="check__input"
                id="lot-url"
                type="text"
                inputMode="url"
                placeholder="https://www.copart.com/lot/… or 99901895"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="check__btn" type="submit" disabled={running}>
                {running ? "Analyzing…" : "Check"}
              </button>
              <div className="check__opts">
                <input
                  className="check__price"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  placeholder="target price, $"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  aria-label="Expected final price in USD"
                />
                <label className="check__toggle">
                  <input
                    type="checkbox"
                    checked={useCache}
                    onChange={(e) => setUseCache(e.target.checked)}
                  />
                  Demo mode (cached lot)
                </label>
              </div>
              <p
                className="check__note"
                role="status"
                aria-live="polite"
                data-tone={note.tone}
              >
                {note.text}
              </p>
            </form>
          </div>

          <figure className="scan" aria-label="Vehicle damage analysis diagram">
            <div className="scan__frame">
              <svg
                className="scan__svg"
                viewBox="0 0 640 300"
                role="img"
                aria-hidden="true"
              >
                <path
                  className="scan__body"
                  d="M76 232 C52 232 40 220 40 202 C40 186 50 176 72 170 L124 156 C154 122 202 102 272 100 L372 102 C438 104 484 124 514 160 L572 172 C594 177 604 189 604 204 C604 222 592 232 568 232 L524 232 A54 54 0 0 0 416 232 L224 232 A54 54 0 0 0 116 232 Z"
                />
                <path
                  className="scan__line"
                  d="M158 154 L200 120 C224 106 252 100 284 99 L284 154 Z"
                />
                <path
                  className="scan__line"
                  d="M298 99 L356 100 C398 103 430 116 448 136 L462 154 L298 154 Z"
                />
                <line
                  className="scan__line"
                  x1="291"
                  y1="100"
                  x2="291"
                  y2="228"
                />
                <circle className="scan__wheel" cx="170" cy="232" r="36" />
                <circle className="scan__hub" cx="170" cy="232" r="13" />
                <circle className="scan__wheel" cx="470" cy="232" r="36" />
                <circle className="scan__hub" cx="470" cy="232" r="13" />
                <path
                  className="scan__damage"
                  d="M40 202 C40 186 50 176 72 170 L124 156 C138 140 156 127 178 118 L192 156 L180 232 L116 232 A54 54 0 0 0 76 219 C56 217 42 212 40 202 Z"
                />
                <polyline
                  className="scan__leader"
                  points="70,182 70,56 148,56"
                />
                <polyline
                  className="scan__leader"
                  points="176,132 176,24 268,24"
                />
                <polyline
                  className="scan__leader"
                  points="330,126 330,44 466,44"
                />
                <polyline
                  className="scan__leader"
                  points="470,268 470,292 560,292"
                />
                <circle className="scan__dot" cx="70" cy="182" r="4" />
                <circle className="scan__dot" cx="176" cy="132" r="4" />
                <circle
                  className="scan__dot scan__dot--ok"
                  cx="330"
                  cy="126"
                  r="4"
                />
                <circle
                  className="scan__dot scan__dot--ok"
                  cx="470"
                  cy="268"
                  r="4"
                />
              </svg>
              <ul className="scan__callouts">
                <li className="scan__callout" style={{ "--x": "24.5%", "--y": "12.5%" } as React.CSSProperties}>
                  bumper · replace
                </li>
                <li className="scan__callout" style={{ "--x": "43.5%", "--y": "1.5%" } as React.CSSProperties}>
                  fender + hood · repaint
                </li>
                <li
                  className="scan__callout scan__callout--ok"
                  style={{ "--x": "74.5%", "--y": "8.5%" } as React.CSSProperties}
                >
                  airbags · not deployed
                </li>
                <li
                  className="scan__callout scan__callout--ok scan__callout--right"
                  style={{ "--x": "0%", "--y": "86%" } as React.CSSProperties}
                >
                  runs &amp; drives
                </li>
              </ul>
            </div>
            <figcaption className="scan__caption">
              Every photo of the lot, analysed automatically
            </figcaption>
          </figure>
        </div>
      </header>

      {(running || report) && (
        <section className="result" id="result" ref={resultRef}>
          {!report && (
            <div className="steps">
              <p className="steps__title">Analysis</p>
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`step ${
                    s.state === "active"
                      ? "is-active"
                      : s.state === "done"
                        ? "is-done"
                        : ""
                  }`}
                >
                  <span className="step__dot" />
                  <span>{s.label}</span>
                </div>
              ))}
              {notice && <div className="steps__notice">{notice}</div>}
              {error && <div className="steps__err">{error}</div>}
            </div>
          )}
          {report && <VerdictCard report={report} notice={notice} />}
        </section>
      )}

      <main>
        <section className="process" id="process" aria-label="How CARify works">
          <h2 className="process__title">Four steps from a link to a decision</h2>

          <article className="stage">
            <h3 className="stage__head">
              <span className="stage__num">1.0</span> Link
            </h3>
            <div className="stage__body">
              <p>
                Paste a link to a Copart lot. CARify pulls everything the page
                holds: photos, title type, run-and-drive status, odometer, sale
                region.
              </p>
              <p className="stage__annot">COPART · LOT PAGE</p>
            </div>
          </article>

          <article className="stage">
            <h3 className="stage__head">
              <span className="stage__num">2.0</span> Photos
            </h3>
            <div className="stage__body">
              <p>
                The model walks through every shot: body geometry, impact zones,
                deployed airbags, flood and rust traces, cabin and engine-bay
                condition. What a reseller squints at for twenty minutes reads
                here in a single pass.
              </p>
              <p className="stage__annot">
                BODY · AIRBAGS · WATER · CABIN · ENGINE BAY
              </p>
            </div>
          </article>

          <article className="stage">
            <h3 className="stage__head">
              <span className="stage__num">3.0</span> Verdict
            </h3>
            <div className="stage__body">
              <p>
                Buy or pass — and why. Which parts are a certain replacement,
                what can be repaired, whether the car will drive after the fix,
                and which hidden risks don&rsquo;t show at first glance.
              </p>
              <p className="stage__annot">BUY / PASS · PARTS LIST · RISKS</p>
            </div>
          </article>

          <article className="stage">
            <h3 className="stage__head">
              <span className="stage__num">4.0</span> Economics
            </h3>
            <div className="stage__body">
              <p>
                Lot price, shipping to Poti, customs clearance, repairs in
                Georgia — against the real resale price on the local market. The
                margin is visible before your first bid, not after the car lands
                at the port.
              </p>
              <p className="stage__annot">
                LOT + SHIPPING + CUSTOMS + REPAIRS VS MARKET
              </p>
            </div>
          </article>
        </section>

        <section className="verdict" id="example" aria-label="Verdict example">
          <h2 className="verdict__title">What a verdict looks like</h2>
          <p className="verdict__sub">
            A demo breakdown — this is how CARify reports on a real lot.
          </p>

          <div className="verdict__card">
            <header className="verdict__head">
              <div className="verdict__id">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="verdict__preview"
                  src="/demo-camry.jpg"
                  alt="Front-damaged 2019 Toyota Camry SE on the auction lot"
                  loading="lazy"
                />
                <div>
                  <p className="verdict__lot">LOT #58214937 · COPART · ATLANTA, GA</p>
                  <p className="verdict__car">Toyota Camry SE · 2019 · 3.5 V6</p>
                </div>
              </div>
              <p className="verdict__chip verdict__chip--yes">Buy — with caveats</p>
            </header>

            <div className="verdict__grid">
              <div className="verdict__block">
                <h3 className="verdict__blockhead">What the photos show</h3>
                <table className="verdict__table">
                  <tbody>
                    <tr>
                      <td>Front bumper</td>
                      <td>cracked</td>
                      <td data-tone="bad">replace</td>
                    </tr>
                    <tr>
                      <td>Right fender</td>
                      <td>deformed</td>
                      <td data-tone="bad">replace</td>
                    </tr>
                    <tr>
                      <td>Hood</td>
                      <td>chips, geometry intact</td>
                      <td data-tone="warn">repaint</td>
                    </tr>
                    <tr>
                      <td>Airbags</td>
                      <td>not deployed</td>
                      <td data-tone="ok">ok</td>
                    </tr>
                    <tr>
                      <td>Running gear</td>
                      <td>lot starts and drives</td>
                      <td data-tone="ok">ok</td>
                    </tr>
                    <tr>
                      <td>Cabin</td>
                      <td>no water traces</td>
                      <td data-tone="ok">ok</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="verdict__block">
                <h3 className="verdict__blockhead">Import economics</h3>
                <table className="verdict__table verdict__table--money">
                  <tbody>
                    <tr>
                      <td>Auction bid</td>
                      <td>$6,200</td>
                    </tr>
                    <tr>
                      <td>Shipping to Poti</td>
                      <td>$1,450</td>
                    </tr>
                    <tr>
                      <td>Customs clearance</td>
                      <td>$2,100</td>
                    </tr>
                    <tr>
                      <td>Repairs and parts</td>
                      <td>$1,700</td>
                    </tr>
                    <tr className="verdict__total">
                      <td>Total invested</td>
                      <td>$11,450</td>
                    </tr>
                    <tr>
                      <td>Georgian market, after repair</td>
                      <td>$14,500</td>
                    </tr>
                    <tr className="verdict__margin">
                      <td>Estimated margin</td>
                      <td>+$3,050</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="verdict__why">
              Why buy: a front impact with no airbag deployment and no flooding
              is the most predictable kind of repair. This generation of Camry
              sells fast on the Georgian market. The caveat: the right fender —
              check the frame rail in the engine-bay photo, CARify flagged that
              shot in the report.
            </p>

            <p className="verdict__footnote">
              FIGURES IN THIS EXAMPLE ARE FOR DEMONSTRATION · EVERY REAL LOT IS
              CALCULATED FRESH
            </p>
          </div>
        </section>

        <section className="qa" aria-label="Honest questions">
          <h2 className="qa__title">Honest questions</h2>
          <dl className="qa__list">
            <div className="qa__item">
              <dt>What can photos actually show?</dt>
              <dd>
                The nature and direction of the impact, deployed airbags, water
                and rust traces, cabin condition, VIN legibility. What they
                can&rsquo;t: engine compression and service history — CARify
                marks honestly where confidence is low.
              </dd>
            </div>
            <div className="qa__item">
              <dt>What if the photos are few or bad?</dt>
              <dd>
                The verdict comes back with lowered confidence, and it says so
                outright. A lot with three blurry shots is a signal in itself.
              </dd>
            </div>
            <div className="qa__item">
              <dt>Why Georgia?</dt>
              <dd>
                The port of Poti is next door, customs follow a predictable
                formula, and the resale market for American cars is one of the
                liveliest in the region. Import economics compute more precisely
                here than almost anywhere.
              </dd>
            </div>
          </dl>
        </section>

      </main>

      <footer className="foot">
        <p className="foot__meta">
          carify · coded with{" "}
          <a
            className="foot__link"
            href="https://cursor.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cursor
          </a>
        </p>
      </footer>
    </>
  );
}

function toneForDecision(decision: string): string {
  if (decision === "replace") return "bad";
  if (decision === "repair") return "warn";
  return "ok";
}

function VerdictCard({
  report,
  notice,
}: {
  report: Report;
  notice: string | null;
}) {
  const { lot, analysis, costs, verdict, score, headline } = report;
  const carName =
    [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") ||
    "Unknown vehicle";
  const chipMod =
    verdict === "BUY"
      ? "verdict__chip--yes"
      : verdict === "RISKY"
        ? "verdict__chip--warn"
        : "verdict__chip--bad";
  const chipLabel =
    verdict === "BUY" ? "Buy" : verdict === "RISKY" ? "Risky" : "Skip";

  return (
    <div className="verdict__card">
      <header className="verdict__head">
        <div className="verdict__id">
          {lot.photos[0] && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className="verdict__preview"
              src={lot.photos[0]}
              alt={`${carName} — lot preview`}
            />
          )}
          <div>
            <p className="verdict__lot">
              LOT #{lot.lotNumber} · COPART
              {lot.location ? ` · ${lot.location.toUpperCase()}` : ""}
              {lot.fromCache ? " · CACHED DEMO" : ""}
            </p>
            <p className="verdict__car">{carName}</p>
          </div>
        </div>
        <p className={`verdict__chip ${chipMod}`}>{chipLabel}</p>
      </header>

      <div className="rv__score">
        <span className="rv__score-num">{score}</span>
        <div className="rv__track">
          <div className="rv__fill" style={{ width: `${score}%` }} />
        </div>
      </div>
      <p className="rv__headline">{headline}</p>

      {notice && <div className="steps__notice">{notice}</div>}

      <div className="rv__chips">
        {lot.primaryDamage && (
          <span className="rv__chip">
            Damage <b>{lot.primaryDamage}</b>
          </span>
        )}
        {lot.odometer !== null && (
          <span className="rv__chip">
            Odo <b>{lot.odometer.toLocaleString()} mi</b>
          </span>
        )}
        {lot.driveable !== null && (
          <span className="rv__chip" data-tone={lot.driveable ? "ok" : "warn"}>
            Run &amp; drive <b>{lot.driveable ? "yes" : "no"}</b>
          </span>
        )}
        {lot.titleType && (
          <span className="rv__chip">
            Title <b>{lot.titleType}</b>
          </span>
        )}
        {lot.hasKeys && (
          <span className="rv__chip">
            Keys <b>{lot.hasKeys}</b>
          </span>
        )}
        <span
          className="rv__chip"
          data-tone={
            analysis.confidence === "high"
              ? "ok"
              : analysis.confidence === "medium"
                ? "warn"
                : "bad"
          }
        >
          Confidence <b>{analysis.confidence}</b>
        </span>
      </div>

      <div className="verdict__grid">
        <div className="verdict__block">
          <h3 className="verdict__blockhead">What the photos show</h3>
          {analysis.damageSummary && (
            <p className="rv__notes rv__notes--lead">
              {analysis.damageSummary}
            </p>
          )}
          <table className="verdict__table verdict__table--gap">
            <tbody>
              {analysis.damagePoints.map((d, i) => (
                <tr key={i}>
                  <td>{d.area}</td>
                  <td>{d.condition}</td>
                  <td data-tone={toneForDecision(d.decision)}>{d.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {analysis.runnableAssessment && (
            <p className="rv__notes">
              <b>Runs:</b> {analysis.runnableAssessment}
            </p>
          )}
        </div>

        <div className="verdict__block">
          <h3 className="verdict__blockhead">Import economics (USD)</h3>
          <table className="verdict__table verdict__table--money">
            <tbody>
              <tr>
                <td>Purchase (expected)</td>
                <td>{money(costs.purchaseUsd)}</td>
              </tr>
              <tr>
                <td>Copart fees</td>
                <td>{money(costs.auctionFeesUsd)}</td>
              </tr>
              <tr>
                <td>Shipping to Poti</td>
                <td>{money(costs.shippingUsd)}</td>
              </tr>
              <tr>
                <td>Georgia customs</td>
                <td>{money(costs.customsUsd)}</td>
              </tr>
              <tr>
                <td>Repair (GE market)</td>
                <td>{money(costs.repairUsd)}</td>
              </tr>
              <tr className="verdict__total">
                <td>Landed cost</td>
                <td>{money(costs.landedCostUsd)}</td>
              </tr>
              <tr>
                <td>Est. resale in Georgia</td>
                <td>{money(costs.resaleUsd)}</td>
              </tr>
              <tr className="verdict__margin">
                <td>Net profit ({costs.marginPct}%)</td>
                <td>{money(costs.netProfitUsd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rv__cols">
        <div className="verdict__block">
          <h3 className="verdict__blockhead">
            Parts to replace · Georgian used market
          </h3>
          {analysis.partsToReplace.length === 0 ? (
            <p className="rv__notes rv__notes--lead">No major parts flagged.</p>
          ) : (
            <table className="verdict__table verdict__table--money">
              <tbody>
                {analysis.partsToReplace.map((p, i) => (
                  <tr key={i}>
                    <td>
                      {p.name}
                      {p.note ? (
                        <span className="rv__partnote">{p.note}</span>
                      ) : null}
                    </td>
                    <td>
                      {money(p.priceMinUsd)}–{money(p.priceMaxUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="verdict__block">
          <h3 className="verdict__blockhead">Risks &amp; flags</h3>
          <div className="rv__chips rv__chips--lead">
            <span
              className="rv__chip"
              data-tone={
                analysis.floodRisk === "none"
                  ? "ok"
                  : analysis.floodRisk === "possible"
                    ? "warn"
                    : "bad"
              }
            >
              Flood risk <b>{analysis.floodRisk}</b>
            </span>
            <span
              className="rv__chip"
              data-tone={
                analysis.structuralRisk === "low"
                  ? "ok"
                  : analysis.structuralRisk === "medium"
                    ? "warn"
                    : "bad"
              }
            >
              Structural <b>{analysis.structuralRisk}</b>
            </span>
          </div>
          {analysis.risks.length > 0 ? (
            <ul className="rv__risks">
              {analysis.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="rv__notes">No major risks flagged.</p>
          )}
          {analysis.notes && <p className="rv__notes">{analysis.notes}</p>}
        </div>
      </div>

      {lot.photos.length > 0 && (
        <div className="verdict__block">
          <h3 className="verdict__blockhead">Lot photos ({lot.photos.length})</h3>
          <div className="rv__gallery">
            {lot.photos.map((src, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={src} alt={`Lot photo ${i + 1}`} loading="lazy" />
            ))}
          </div>
        </div>
      )}

      <p className="verdict__footnote">
        ESTIMATES ARE HACKATHON-GRADE · CUSTOMS, SHIPPING &amp; REPAIR FIGURES
        ARE APPROXIMATE AND RECOMPUTED PER LOT
      </p>
    </div>
  );
}
