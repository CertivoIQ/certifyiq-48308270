import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, oldText, newText) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`Expected patch anchor missing in ${path}`);
  const next = source.replace(oldText, newText);
  if (next === source) throw new Error(`Patch did not change ${path}`);
  writeFileSync(path, next);
}

patch(
  'src/lib/tic-field-registry.ts',
  `const incomeMemberFields = Array.from({ length: TIC_INCOME_ROW_COUNT }, (_, index) => {\n  const member = index + 1;\n  const prefix = \`Household member \${member}\`;\n  return [\n    field(\`income_member_\${member}_wages_business\`, \`\${prefix} — employment or wages\`, "Part III — Gross Annual Income", "currency", [\`income member \${member} employment or wages\`]),\n    field(\`income_member_\${member}_social_security_pension\`, \`\${prefix} — Social Security / pensions\`, "Part III — Gross Annual Income", "currency", [\`income member \${member} social security pensions\`]),\n    field(\`income_member_\${member}_public_assistance\`, \`\${prefix} — public assistance\`, "Part III — Gross Annual Income", "currency", [\`income member \${member} public assistance\`]),\n    field(\`income_member_\${member}_other_income\`, \`\${prefix} — other income\`, "Part III — Gross Annual Income", "currency", [\`income member \${member} other income\`]),\n    field(\`income_member_\${member}_total_income\`, \`\${prefix} — total annual income\`, "Part III — Gross Annual Income", "currency", [\`income member \${member} total annual income\`]),\n  ];\n}).flat();`,
  `const incomeMemberFields = Array.from({ length: TIC_INCOME_ROW_COUNT }, (_, index) => {\n  const row = index + 1;\n  const prefix = \`Income row \${row}\`;\n  return [\n    field(\`income_member_\${row}_household_member_number\`, \`\${prefix} — HH Mbr #\`, "Part III — Gross Annual Income", "number", [\`income member \${row} household member number\`]),\n    field(\`income_member_\${row}_wages_business\`, \`\${prefix} — employment or wages\`, "Part III — Gross Annual Income", "currency", [\`income member \${row} employment or wages\`]),\n    field(\`income_member_\${row}_social_security_pension\`, \`\${prefix} — Social Security / pensions\`, "Part III — Gross Annual Income", "currency", [\`income member \${row} social security pensions\`]),\n    field(\`income_member_\${row}_public_assistance\`, \`\${prefix} — public assistance\`, "Part III — Gross Annual Income", "currency", [\`income member \${row} public assistance\`]),\n    field(\`income_member_\${row}_other_income\`, \`\${prefix} — other income\`, "Part III — Gross Annual Income", "currency", [\`income member \${row} other income\`]),\n    field(\`income_member_\${row}_total_income\`, \`\${prefix} — total annual income\`, "Part III — Gross Annual Income", "currency", [\`income member \${row} total annual income\`]),\n  ];\n}).flat();`,
);

patch(
  'src/components/certivoiq-tic-review-form.tsx',
  `<td className="border border-slate-600 px-2 py-1 text-center font-semibold">{member}</td>\n              {["wages_business", "social_security_pension", "public_assistance", "other_income"].map((suffix) => {`,
  `<td className="border border-slate-600 p-0">\n                <input\n                  aria-label={def(\`income_member_\${member}_household_member_number\`)?.label ?? \`Income row \${member} — HH Mbr #\`}\n                  className="h-8 w-full border-0 bg-white px-2 text-center text-xs font-semibold outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800/20"\n                  value={values[\`income_member_\${member}_household_member_number\`] ?? ""}\n                  disabled={busy}\n                  inputMode="numeric"\n                  onChange={(event) => onChange(\`income_member_\${member}_household_member_number\`, event.target.value)}\n                />\n              </td>\n              {["wages_business", "social_security_pension", "public_assistance", "other_income"].map((suffix) => {`,
);

patch(
  'src/components/certivoiq-tic-review-form.tsx',
  `<Choice field="certification_type" option="Other" label="Other" {...props} />\n              </div>`,
  `<Choice field="certification_type" option="Other" label="Other" {...props} />\n              </div>\n              {(values.certification_type ?? "").toLowerCase() === "other" ? (\n                <div className="mt-2 max-w-md"><Field field="other_certification_type" {...props} compact /></div>\n              ) : null}`,
);

patch(
  'src/lib/tic-pdf-form-values.ts',
  `    "Total Annual Household Income": "household_annual_income",`,
  `    "Total Annual Household Income": "household_annual_income",\n    "Textfield-11": "household_annual_income",`,
);

patch(
  'src/lib/tic-pdf-form-values.ts',
  `function incomeKey(name: string): string | null {`,
  `function incomeHouseholdMemberKey(name: string): string | null {\n  const match = /^HH Mbr-(\\d+)$/.exec(name);\n  if (!match?.[1]) return null;\n  const suffix = Number(match[1]);\n  const row = suffix >= 4 && suffix <= 8\n    ? suffix - 3\n    : suffix >= 14 && suffix <= 18\n      ? suffix - 8\n      : null;\n  return row ? \`income_member_\${row}_household_member_number\` : null;\n}\n\nfunction incomeKey(name: string): string | null {`,
);

patch(
  'src/lib/tic-pdf-form-values.ts',
  `const key = staticFieldKey(name) ?? householdKey(name) ?? incomeKey(name) ?? assetKey(name) ?? signatureKey(name);`,
  `const key = staticFieldKey(name) ?? householdKey(name) ?? incomeHouseholdMemberKey(name) ?? incomeKey(name) ?? assetKey(name) ?? signatureKey(name);`,
);

patch(
  'src/lib/tic-spatial-extraction.mjs',
  `function selectedCertificationType(lines, pageWidth) {`,
  `function selectedCertificationType(lines, words, pageWidth, pageHeight) {`,
);

patch(
  'src/lib/tic-spatial-extraction.mjs',
  `    for (const word of line.words) {\n      if (word.x1 > anchor.x0 || word.x1 < anchor.x0 - pageWidth * 0.055) continue;\n      score = Math.max(score, markerScore(word.text));\n    }`,
  `    for (const word of words) {\n      if (Math.abs(word.cy - anchor.cy) > Math.max(8, pageHeight * 0.012)) continue;\n      if (word.x1 > anchor.x0 || word.x1 < anchor.x0 - pageWidth * 0.055) continue;\n      score = Math.max(score, markerScore(word.text));\n    }`,
);

patch(
  'src/lib/tic-spatial-extraction.mjs',
  `    add(out, \`income_member_\${member}_wages_business\`, parts[1]);`,
  `    add(out, \`income_member_\${member}_household_member_number\`, parts[0]);\n    add(out, \`income_member_\${member}_wages_business\`, parts[1]);`,
);

patch(
  'src/lib/tic-spatial-extraction.mjs',
  `  const certificationType = selectedCertificationType(lines, width);`,
  `  const certificationType = selectedCertificationType(lines, words, width, height);`,
);

patch(
  'scripts/test-tic-spatial-extraction.mjs',
  `  assert(values.includes(direct('income_member_1_wages_business', '25544.40')));`,
  `  assert(values.includes(direct('income_member_1_household_member_number', '1')));\n  assert(values.includes(direct('income_member_1_wages_business', '25544.40')));`,
);

patch(
  'scripts/test-tic-native-form-extraction.mjs',
  `    ['A Employment or Wages', 'wages_business'],`,
  `    ['HH Mbr-4', 'household_member_number'],\n    ['A Employment or Wages', 'wages_business'],`,
);

patch(
  'scripts/test-tic-native-form-extraction.mjs',
  `  assert.match(formMap, /\["certification_type", name\]/);`,
  `  assert.match(formMap, /\["certification_type", name\]/);\n  assert.match(formMap, /incomeHouseholdMemberKey/);\n  assert.match(review, /other_certification_type/);`,
);

console.log('PASS: source TIC and CertivoIQ TIC parity patch applied');
