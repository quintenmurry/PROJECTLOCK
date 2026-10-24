"use client";
import { useActionState, useState } from "react";
import { saveCarrierCoverage } from "../carrier-actions";
import { Alert, Button, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CAPABILITIES, CATEGORY_LABEL, US_STATES, type CapabilityCategory } from "@/lib/capabilities";

type Port = { id: number; code: string; name: string; city: string; state: string };
export type Coverage = {
  ports: number[];
  terminals: { port_id: number; name: string }[];
  areas: { city: string; state: string }[];
  capabilities: { category: CapabilityCategory; value: string }[];
};

export function CoverageForm({ ports, initial, readOnly }: { ports: Port[]; initial: Coverage; readOnly: boolean }) {
  const [state, action] = useActionState(saveCarrierCoverage, {});
  const [selPorts, setSelPorts] = useState<Set<number>>(new Set(initial.ports));
  const [terminals, setTerminals] = useState(initial.terminals);
  const [areas, setAreas] = useState(initial.areas);
  const [caps, setCaps] = useState<Set<string>>(new Set(initial.capabilities.map((c) => `${c.category}|${c.value}`)));

  const payload = JSON.stringify({
    ports: [...selPorts],
    terminals: terminals.filter((t) => t.name.trim()),
    areas: areas.filter((a) => a.city.trim()),
    capabilities: [...caps].map((k) => { const [category, value] = k.split("|"); return { category, value }; }),
  });
  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };
  const portOptions = ports.filter((p) => selPorts.has(p.id));

  return (
    <form action={action} className="space-y-8">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.message}</Alert>}
      <input type="hidden" name="coverage" value={payload} />
      <fieldset disabled={readOnly} className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold text-slate-900">Ports and rail ramps you serve</h3>
          <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {ports.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selPorts.has(p.id)} onChange={() => setSelPorts(toggle(selPorts, p.id))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span>{p.name} <span className="text-slate-400">{p.state}</span></span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900">Terminals</h3>
          <p className="text-sm text-slate-500">Name the terminals you pull from. Select a port above first.</p>
          <div className="mt-3 space-y-2">
            {terminals.map((t, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Select aria-label="Port" className="w-60" value={t.port_id}
                  onChange={(e) => setTerminals(terminals.map((x, j) => (j === i ? { ...x, port_id: Number(e.target.value) } : x)))}>
                  {portOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input aria-label="Terminal name" className="w-64 flex-1" maxLength={120} placeholder="Terminal name" value={t.name}
                  onChange={(e) => setTerminals(terminals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Button type="button" variant="ghost" onClick={() => setTerminals(terminals.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" disabled={portOptions.length === 0}
              onClick={() => setTerminals([...terminals, { port_id: portOptions[0].id, name: "" }])}>
              Add terminal
            </Button>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900">Delivery areas</h3>
          <p className="text-sm text-slate-500">Cities you deliver to or pick up from.</p>
          <div className="mt-3 space-y-2">
            {areas.map((a, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Input aria-label="City" className="w-64 flex-1" maxLength={80} placeholder="City" value={a.city}
                  onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
                <Select aria-label="State" className="w-24" value={a.state}
                  onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, state: e.target.value } : x)))}>
                  {US_STATES.map((s) => <option key={s}>{s}</option>)}
                </Select>
                <Button type="button" variant="ghost" onClick={() => setAreas(areas.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setAreas([...areas, { city: "", state: areas.at(-1)?.state ?? "CA" }])}>
              Add area
            </Button>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          {(Object.keys(CAPABILITIES) as CapabilityCategory[]).map((cat) => (
            <section key={cat}>
              <h3 className="text-sm font-semibold text-slate-900">{CATEGORY_LABEL[cat]}</h3>
              <div className="mt-3 space-y-2">
                {CAPABILITIES[cat].map((v) => {
                  const k = `${cat}|${v}`;
                  return (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={caps.has(k)} onChange={() => setCaps(toggle(caps, k))}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      {v}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </fieldset>
      {!readOnly && <SubmitButton pendingText="Saving…">Save coverage</SubmitButton>}
    </form>
  );
}
