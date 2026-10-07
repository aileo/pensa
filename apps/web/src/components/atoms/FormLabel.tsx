import type { ComponentProps } from 'react'

export function FormLabel(props: ComponentProps<'label'>) {
  return <label {...props} className={`label ${props.className ?? ''}`.trim()} />
}
