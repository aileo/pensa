import type { ComponentProps } from 'react'

export function SelectInput(props: ComponentProps<'select'>) {
  return <select {...props} className={`field ${props.className ?? ''}`.trim()} />
}
