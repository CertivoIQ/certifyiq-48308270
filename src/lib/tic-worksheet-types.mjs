/** Printed worksheet cell types; never derive source amounts from other fields. */
export function worksheetFieldType(key) {
 if (!key.startsWith('worksheet_')) return 'text';
 if (/_certification_date$|_dob$/.test(key)) return 'date';
 if (/_percent$|_hours_per_period$|_periods_per_year$|_age$/.test(key)) return 'number';
 if (/worksheet_total_|_greatest_asset_income$|_qualifying_income_limit$|_variance$|_dollars_per_hour$|_income_per_year$|_market_value$|_divest_cost$|_cash_value$/.test(key)) return 'currency';
 return 'text';
}
