export function readNameDay(data: FormData, incomplete: string) {
  const month = String(data.get('nameDayMonth') ?? ''), day = String(data.get('nameDayDay') ?? '')
  if (!!month !== !!day) throw new Error(incomplete)
  return month ? `${month}-${day}` : null
}
