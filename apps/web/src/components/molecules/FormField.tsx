import type { ReactNode } from 'react'
import { useTranslation } from '../../language-context'
import { FormLabel } from '../atoms/FormLabel'

export function FormField({ id, label, optional, optionalText, labelClassName, className, hint, children }: {
  id: string
  label: string
  optional?: boolean
  optionalText?: ReactNode
  labelClassName?: string
  className?: string
  hint?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  return <div className={className}>
    <FormLabel htmlFor={id} className={labelClassName}>{label}{(optional || optionalText) && <> <span className="font-normal">{optionalText ?? t('(facultatif)')}</span></>}</FormLabel>
    {children}
    {hint && <p className="muted mt-1.5">{hint}</p>}
  </div>
}
