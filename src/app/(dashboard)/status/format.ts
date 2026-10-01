export function formatCpu(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 1 : 0)} cores` : `${value}m`
}

export function formatBytes(value: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++ }
  return `${amount.toFixed(unit > 1 && amount < 10 ? 1 : 0)} ${units[unit]}`
}
