export enum Mode {
  serve = "serve",
  dev = "dev",
  prod = "prod"
}

export const isDev = () => {
  return import.meta.env.VITE_MODE == Mode.dev;
};

export const isServe = () => {
  return import.meta.env.VITE_MODE == Mode.serve;
};
