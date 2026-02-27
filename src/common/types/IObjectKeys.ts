export interface IObjectKeys {
  [key: string]:
    | string
    | Date
    | number
    | boolean
    | undefined
    | ((...args: unknown[]) => unknown)
    | Record<string, unknown>
    | unknown[];
}
