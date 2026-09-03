function criterionValue(record) {
  if (!record) return null;
  if (record.value_fraction) return `${record.value_fraction.numerator}/${record.value_fraction.denominator}`;
  if (record.value_range) return `${record.value_range.lower}-${record.value_range.upper}`;
  if (record.value_text !== null && record.value_text !== undefined) return record.value_text;
  return record.value;
}

function criterionValueKey(record) {
  const value = criterionValue(record);
  return value === null || value === undefined ? "" : String(value);
}

module.exports = { criterionValue, criterionValueKey };
