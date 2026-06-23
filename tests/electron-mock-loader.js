const ELECTRON_MOCK = `
export const app = {
  getPath: () => '.',
  on: () => {},
  quit: () => {}
};
export default { app };
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'electron') {
    return { shortCircuit: true, url: 'electron://mock' };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === 'electron://mock') {
    return { shortCircuit: true, format: 'module', source: ELECTRON_MOCK };
  }
  return nextLoad(url, context);
}
