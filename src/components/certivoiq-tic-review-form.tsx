import { createContext, useContext, useMemo } from "react";
import { TIC_SUPPLEMENTAL_SECTIONS } from "@/lib/tic-supplemental-fields";
import { ticCompletenessFindings } from "@/lib/tic-completeness";
import type { TicFieldDefinition } from "@/lib/tic-field-registry";
import { TIC_ASSET_ROW_COUNT, TIC_FIELD_BY_KEY, TIC_HOUSEHOLD_ROW_COUNT, TIC_INCOME_ROW_COUNT } from "@/lib/tic-field-registry";

const CompletionContext = createContext(new Map<string, string>());

type FactMeta = {
  page: number | null;
  confidence: number;
  value: unknown;
};

type Props = {
  values: Record<string, string>;
  factsByField: Map<string, FactMeta>;
  busy: boolean;
  onChange: (field: string, value: string) => void;
};

function def(key: string): TicFieldDefinition | undefined {
  return TIC_FIELD_BY_KEY.get(key);
}

function confidenceLabel(fact?: FactMeta) {
  if (!fact) return "Not extracted";
  return `P${fact.page ?? "—"} · ${Math.round(Number(fact.confidence || 0) * 100)}%`;
}

function Field({
  field,
  values,
  factsByField,
  busy,
  onChange,
  compact = false,
  placeholder,
}: Props & { field: string; compact?: boolean; placeholder?: string }) {
  const finding = useContext(CompletionContext).get(field);
  const definition = def(field);
  if (!definition) return null;
  const fact = factsByField.get(field);
  const value = values[field] ?? "";
  const original = fact?.value == null ? "" : String(fact.value);
  const corrected = Boolean(fact && value.trim() !== original.trim());
  return (
    <label id={`tic-field-${field}`} className="block min-w-0">
      <div className="mb-1 flex items-end justify-between gap-2">
        <span className={`${compact ? "text-[10px]" : "text-xs"} font-semibold leading-tight`}>{definition.label}</span>
        <span className={`shrink-0 text-[9px] ${corrected ? "font-semibold" : "text-slate-500"}`}>
          {corrected ? "Corrected" : confidenceLabel(fact)}
        </span>
      </div>
      <input
        className={`${compact ? "h-8 px-2 text-xs" : "h-9 px-2.5 text-sm"} w-full rounded-none border border-slate-500 bg-white text-slate-950 outline-none focus:ring-2 focus:ring-slate-800/20`}
        aria-invalid={Boolean(finding)}
        title={finding}
        style={finding ? { backgroundColor: "#fef08a", borderColor: "#a16207" } : undefined}
        value={value}
        disabled={busy}
        inputMode={definition.type === "currency" || definition.type === "number" ? "decimal" : undefined}
        placeholder={placeholder ?? definition.placeholder ?? ""}
        onChange={(event) => onChange(field, event.target.value)}
      />
    </label>
  );
}

function Choice({ field, option, label, values, busy, onChange }: Props & { field: string; option: string; label: string }) {
  const checked = (values[field] ?? "").toLowerCase() === option.toLowerCase();
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium">
      <input
        type="radio"
        name={field}
        value={option}
        checked={checked}
        disabled={busy}
        onChange={() => onChange(field, option)}
      />
      {label}
    </label>
  );
}

function YesNo({ field, prompt, values, factsByField, busy, onChange }: Props & { field: string; prompt: string }) {
  const fact = factsByField.get(field);
  const finding = useContext(CompletionContext).get(field);
  return (
    <div id={`tic-field-${field}`} style={finding ? { backgroundColor: "#fef08a", padding: 6 } : undefined} title={finding}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{prompt}</span>
        <span className="text-[9px] text-slate-500">{confidenceLabel(fact)}</span>
      </div>
      <div className="mt-2 flex gap-5">
        <Choice field={field} option="Yes" label="Yes" values={values} factsByField={factsByField} busy={busy} onChange={onChange} />
        <Choice field={field} option="No" label="No" values={values} factsByField={factsByField} busy={busy} onChange={onChange} />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-y-2 border-slate-900 bg-slate-100 px-2 py-1 text-center text-sm font-extrabold tracking-tight">{children}</div>;
}

function MemberTable({ values, factsByField, busy, onChange }: Props) {
  const members = Array.from({ length: TIC_HOUSEHOLD_ROW_COUNT }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100 text-center font-bold">
            {[
              "HH Mbr #", "Last Name", "First Name & Middle Initial", "Rel HH", "Race*", "Ethn*", "Dsbs*", "Gndr*", "Date of Birth", "F/T Student", "Social Security / Alien Reg. No.",
            ].map((label) => <th key={label} className="border border-slate-600 px-1 py-1">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const cells = [
              [null, String(member)],
              [`household_member_${member}_last_name`, null],
              [`household_member_${member}_first_name_middle_initial`, null],
              [`household_member_${member}_relationship`, null],
              [`household_member_${member}_race`, null],
              [`household_member_${member}_ethnicity`, null],
              [`household_member_${member}_disability`, null],
              [`household_member_${member}_gender`, null],
              [`household_member_${member}_date_of_birth`, null],
              [`household_member_${member}_full_time_student`, null],
              [`household_member_${member}_ssn_or_alien_registration`, null],
            ] as const;
            return (
              <tr key={member}>
                {cells.map(([field, fixed], index) => (
                  <td key={`${member}-${index}`} className="border border-slate-600 p-0">
                    {fixed ? <div className="px-2 py-2 text-center font-semibold">{fixed}</div> : (
                      <input
                        aria-label={def(field!)?.label ?? field!}
                        className="h-8 w-full border-0 bg-white px-1.5 text-[11px] text-slate-950 outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800/20"
                        value={values[field!] ?? ""}
                        disabled={busy}
                        onChange={(event) => onChange(field!, event.target.value)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-slate-600">* Optional demographic fields, consistent with the source TIC.</p>
    </div>
  );
}

function IncomeTable({ values, factsByField, busy, onChange }: Props) {
  const members = Array.from({ length: TIC_INCOME_ROW_COUNT }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100 text-center font-bold">
            <th className="border border-slate-600 p-1">HH Mbr #</th>
            <th className="border border-slate-600 p-1">(A) Employment or Wages</th>
            <th className="border border-slate-600 p-1">(B) Social Security / Pensions</th>
            <th className="border border-slate-600 p-1">(C) Public Assistance</th>
            <th className="border border-slate-600 p-1">(D) Other Income</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member}>
              <td className="border border-slate-600 p-0">
                <input
                  aria-label={def(`income_member_${member}_household_member_number`)?.label ?? `Income row ${member} — HH Mbr #`}
                  className="h-8 w-full border-0 bg-white px-2 text-center text-xs font-semibold outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800/20"
                  value={values[`income_member_${member}_household_member_number`] ?? ""}
                  disabled={busy}
                  inputMode="numeric"
                  onChange={(event) => onChange(`income_member_${member}_household_member_number`, event.target.value)}
                />
              </td>
              {["wages_business", "social_security_pension", "public_assistance", "other_income"].map((suffix) => {
                const field = `income_member_${member}_${suffix}`;
                return (
                  <td key={field} className="border border-slate-600 p-0">
                    <input aria-label={def(field)?.label ?? field} className="h-8 w-full border-0 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800/20" value={values[field] ?? ""} disabled={busy} inputMode="decimal" onChange={(event) => onChange(field, event.target.value)} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid border-x border-b border-slate-600 md:grid-cols-[1fr_280px]">
        <div className="px-3 py-2 text-xs font-semibold">Add Totals from (A) through (D) above</div>
        <div className="border-t border-slate-600 p-2 md:border-l md:border-t-0"><Field field="total_income_e" values={values} factsByField={factsByField} busy={busy} onChange={onChange} compact /></div>
      </div>
    </div>
  );
}

function AssetsTable({ values, factsByField, busy, onChange }: Props) {
  const rows = Array.from({ length: TIC_ASSET_ROW_COUNT }, (_, i) => i + 1);
  return (
    <>
      <div className="border-x border-b border-slate-600 p-3">
        <div className="text-center text-xs font-bold">Part IVA — INCOME FROM ASSETS — Less Than Or Equal To The Imputed Income Threshold (IIT)</div>
        <div className="mt-2"><Field field="asset_actual_income_below_iit" values={values} factsByField={factsByField} busy={busy} onChange={onChange} /></div>
      </div>
      <div className="border-x border-b border-slate-600">
        <div className="bg-slate-100 px-2 py-1 text-center text-xs font-bold">Part IVB — INCOME FROM ASSETS — GREATER Than The Imputed Income Threshold (IIT)</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-[10px]">
            <thead>
              <tr className="text-center font-bold">
                {[
                  "Hshld Mbr #", "(G) Type of Asset", "(H) Current / Disposed", "(I) NNPP / Real / Tax Relief", "(J) Cash Value of Asset", "(K) Actual / Imputed", "(L) Annual Income from Asset",
                ].map((label) => <th key={label} className="border border-slate-600 p-1">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const fields = [
                  `asset_${row}_household_member_number`, `asset_${row}_type`, `asset_${row}_current_disposed`, `asset_${row}_category`, `asset_${row}_cash_value`, `asset_${row}_income_method`, `asset_${row}_annual_income`,
                ];
                return (
                  <tr key={row}>
                    {fields.map((field) => (
                      <td key={field} className="border border-slate-600 p-0">
                        <input aria-label={def(field)?.label ?? field} className="h-8 w-full border-0 bg-white px-1.5 text-[11px] outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800/20" value={values[field] ?? ""} disabled={busy} onChange={(event) => onChange(field, event.target.value)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 border-t border-slate-600 p-2 md:grid-cols-2">
          <Field field="total_nnpp" values={values} factsByField={factsByField} busy={busy} onChange={onChange} compact />
          <Field field="total_income_assets_m" values={values} factsByField={factsByField} busy={busy} onChange={onChange} compact />
        </div>
      </div>
    </>
  );
}

function ProgramColumn({ field, statusField, label, options, values, factsByField, busy, onChange }: Props & { field: string; statusField: string; label: string; options: string[] }) {
  return (
    <div className="border border-slate-600 p-2">
      <Choice field={field} option="Yes" label={label} values={values} factsByField={factsByField} busy={busy} onChange={onChange} />
      <div className="mt-2 text-[10px] font-semibold">Income Status</div>
      <select className="mt-1 w-full border border-slate-500 bg-white px-2 py-1.5 text-xs" value={values[statusField] ?? ""} disabled={busy} onChange={(event) => onChange(statusField, event.target.value)}>
        <option value="">Not marked</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function SupplementalFields({ fields, ...props }: Props & { fields: readonly TicFieldDefinition[] }) {
  const blocks: { id: string; rows: Map<string, TicFieldDefinition[]>; fields: TicFieldDefinition[] }[] = [];
  for (const definition of fields) {
    const match = /^(application_(?:member|reference|residence|automobile|other_income|asset)|worksheet_(?:member|income|asset))_(\d+)_/.exec(definition.key);
    if (!match) { blocks.push({id: definition.key, rows: new Map(), fields: [definition]}); continue; }
    let block = blocks.find(b=>b.id===match[1]);
    if(!block){ block={id:match[1]!,rows:new Map(),fields:[]};blocks.push(block); }
    block.rows.set(match[2]!,[...(block.rows.get(match[2]!)??[]),definition]);
  }
  return <div className="space-y-3 p-3">{blocks.map(block=>block.rows.size ?
    <div key={block.id} className="overflow-x-auto"><table className="w-full border-collapse text-xs">
      <tbody>{[...block.rows.entries()].map(([row,definitions])=><tr key={row}>
        <th className="border border-slate-500 p-2">{row}</th>
        {definitions.map(definition=><td key={definition.key} className="min-w-[150px] border border-slate-500 p-2 align-top"><Field field={definition.key} compact {...props}/></td>)}
      </tr>)}</tbody></table></div>
    : <div key={block.id}>{block.fields.map(definition=>definition.type==='yes_no'
      ? <YesNo key={definition.key} field={definition.key} prompt={definition.label} {...props}/>
      : <Field key={definition.key} field={definition.key} {...props}/>)}</div>
  )}</div>;
}

export function CertivoIqTicReviewForm(props: Props) {
  const { values, factsByField, busy, onChange } = props;
  const completion = useMemo(()=>new Map(ticCompletenessFindings(values).map(f=>[f.field,f.message])),[values]);
  return (
    <CompletionContext.Provider value={completion}>
    <div className="mx-auto w-full max-w-[1180px] space-y-5">
      <div className="overflow-hidden rounded-lg border border-slate-400 bg-white text-slate-950 shadow-sm">
        <div className="border-b-2 border-slate-900 p-3">
          <div className="grid items-start gap-3 md:grid-cols-[1fr_300px]">
            <div>
              <div className="text-center text-xl font-black tracking-tight md:text-2xl">CERTIVOIQ TENANT INCOME CERTIFICATION</div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <Choice field="certification_type" option="Initial Certification" label="Initial Certification" {...props} />
                <Choice field="certification_type" option="Recertification" label="Recertification" {...props} />
                <Choice field="certification_type" option="Other" label="Other" {...props} />
              </div>
              {(values['certification_type'] ?? "").toLowerCase() === "other" ? (
                <div className="mt-2 max-w-md"><Field field="other_certification_type" {...props} compact /></div>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Field field="certification_effective_date" {...props} compact placeholder="MM/DD/YYYY" />
              <Field field="move_in_date" {...props} compact placeholder="MM/DD/YYYY" />
              <Field field="current_date" {...props} compact placeholder="MM/DD/YYYY" />
            </div>
          </div>
        </div>

        <SectionTitle>PART I — DEVELOPMENT DATA</SectionTitle>
        <div className="grid gap-2 border-x border-b border-slate-600 p-3 md:grid-cols-4">
          <div className="md:col-span-2"><Field field="property_name" {...props} compact /></div>
          <Field field="county" {...props} compact />
          <Field field="tax_credit_number" {...props} compact />
          <div className="md:col-span-2"><Field field="property_address" {...props} compact /></div>
          <Field field="building_identification_number" {...props} compact />
          <div className="grid grid-cols-2 gap-2"><Field field="unit_number" {...props} compact /><Field field="unit_bedrooms" {...props} compact /></div>
        </div>

        <SectionTitle>PART II — HOUSEHOLD COMPOSITION</SectionTitle>
        <div className="border-x border-b border-slate-600 p-2"><MemberTable {...props} /></div>

        <SectionTitle>PART III — GROSS ANNUAL INCOME (Use Annual Amounts)</SectionTitle>
        <IncomeTable {...props} />

        <SectionTitle>PART IV — INCOME FROM ASSETS</SectionTitle>
        <AssetsTable {...props} />

        <SectionTitle>PART V — TOTAL HOUSEHOLD INCOME</SectionTitle>
        <div className="border-x border-b border-slate-600 p-3"><Field field="household_annual_income" {...props} /></div>

        <SectionTitle>HOUSEHOLD CERTIFICATION & SIGNATURE(S)</SectionTitle>
        <div className="grid gap-3 border-x border-b border-slate-600 p-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((member) => (
            <div key={member} className="grid grid-cols-[1fr_140px] gap-2">
              <YesNo field={`household_member_${member}_signature_present`} prompt={`Signature ${member} present`} {...props} />
              <Field field={`household_member_${member}_signature_date`} {...props} compact placeholder="MM/DD/YYYY" />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-400 bg-white text-slate-950 shadow-sm">
        <SectionTitle>PART VI — DETERMINATION OF INCOME ELIGIBILITY</SectionTitle>
        <div className="grid gap-3 border-x border-b border-slate-600 p-3 md:grid-cols-2">
          <div className="grid gap-3">
            <Field field="household_annual_income" {...props} />
            <Field field="applicable_lihtc_income_limit" {...props} />
            <Field field="household_income_at_move_in" {...props} />
            <Field field="household_size_at_move_in" {...props} />
          </div>
          <div className="grid gap-3">
            <Field field="household_income_restriction_percent" {...props} />
            <Field field="current_income_limit_140_percent" {...props} />
            <YesNo field="income_exceeds_140_percent" prompt="Household income exceeds 140% at recertification" {...props} />
          </div>
        </div>

        <SectionTitle>PART VII — RENT</SectionTitle>
        <div className="grid gap-3 border-x border-b border-slate-600 p-3 md:grid-cols-2">
          <div className="grid gap-3">
            <Field field="tenant_paid_rent" {...props} />
            <Field field="utility_allowance" {...props} />
            <Field field="gross_rent" {...props} />
            <Field field="state_max_gross_rent" {...props} />
          </div>
          <div className="grid gap-3">
            <Field field="rental_assistance_type" {...props} />
            <Field field="rent_assistance" {...props} />
            <Field field="other_non_optional_charges" {...props} />
            <Field field="unit_rent_restriction_percent" {...props} />
          </div>
        </div>

        <SectionTitle>PART VIII — STUDENT STATUS</SectionTitle>
        <div className="grid gap-3 border-x border-b border-slate-600 p-3 md:grid-cols-[1fr_1.5fr]">
          <YesNo field="all_occupants_full_time_students" prompt="Are all occupants full-time students?" {...props} />
          <Field field="student_exception_code" {...props} />
        </div>

        <SectionTitle>PART IX — PROGRAM TYPE</SectionTitle>
        <div className="grid border-x border-b border-slate-600 md:grid-cols-5">
          <ProgramColumn field="program_type_lihtc" statusField="program_lihtc_income_status" label="a. Tax Credit" options={["< 50% AMGI", "< 60% AMGI", "< 80% AMGI", "OI"]} {...props} />
          <ProgramColumn field="program_type_home" statusField="program_home_income_status" label="b. HOME" options={["50% AMGI", "60% AMGI", "80% AMGI", "OI"]} {...props} />
          <ProgramColumn field="program_type_tax_exempt_bond" statusField="program_tax_exempt_income_status" label="c. Tax Exempt" options={["20% AMGI", "40% AMGI", "50% AMGI", "60% AMGI", "80% AMGI", "OI"]} {...props} />
          <ProgramColumn field="program_type_pennhomes" statusField="program_pennhomes_income_status" label="d. PennHOMES" options={["20% AMGI", "40% AMGI", "50% AMGI", "60% AMGI", "80% AMGI", "OI"]} {...props} />
          <ProgramColumn field="program_type_pennhomes_home" statusField="program_pennhomes_home_income_status" label="e. PennHOMES/HOME" options={["20% AMGI", "40% AMGI", "50% AMGI", "60% AMGI", "80% AMGI", "OI"]} {...props} />
        </div>

        <SectionTitle>SIGNATURE OF OWNER / REPRESENTATIVE</SectionTitle>
        <div className="grid gap-3 border-x border-b border-slate-600 p-3 md:grid-cols-[1fr_220px]">
          <div className="grid gap-3">
            <Field field="owner_representative_name" {...props} />
            <YesNo field="owner_representative_signature_present" prompt="Owner / representative signature present" {...props} />
          </div>
          <Field field="owner_representative_signature_date" {...props} placeholder="MM/DD/YYYY" />
        </div>
        <div className="border border-yellow-500 bg-yellow-50 p-3 text-slate-950" aria-live="polite">
          <h3 className="font-bold">Completion findings</h3>
          {ticCompletenessFindings(props.values).length ? <ul className="list-disc pl-5">{ticCompletenessFindings(props.values).map(f => <li key={f.field}><a className="underline" href={`#tic-field-${f.field}`}>{f.message}</a></li>)}</ul> : <p className="text-xs">No incomplete asset amounts detected in the entered fields. Other evidence and review checks still apply.</p>}
        </div>
        {TIC_SUPPLEMENTAL_SECTIONS.map(section => <section key={section.id} className="mt-5">
          <SectionTitle>{section.title}</SectionTitle>
          {section.note && <p className="p-3 text-xs">{section.note}</p>}
          <SupplementalFields fields={section.fields} {...props} />
        </section>)}
      </div>
    </div>
    </CompletionContext.Provider>
  );
}

