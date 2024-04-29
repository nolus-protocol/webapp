export enum Mode {
  serve = "serve",
  dev = "dev",
  prod = "prod"
}

export const isDev = () => {
  return import.meta.env.VITE_MODE == Mode.dev || import.meta.env.VITE_MODE == Mode.serve;
};

export const isServe = () => {
  return import.meta.env.VITE_MODE == Mode.serve;
};
