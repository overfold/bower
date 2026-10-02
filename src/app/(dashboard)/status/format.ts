export function formatCpu(value: number) {
  if (value < 1000) return `${value}m`
  const cores = value / 1000
  return `${cores.toFixed(value % 1000 ? 1 : 0)} ${cores === 1 ? 'core' : 'cores'}`
}

export function formatBytes(value: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++ }
  return `${amount.toFixed(unit > 1 && amount < 10 ? 1 : 0)} ${units[unit]}`
}
