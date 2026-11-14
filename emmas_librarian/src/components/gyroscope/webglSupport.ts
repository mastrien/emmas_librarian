/**
 * Whether this machine can draw WebGL. Virtual machines, remote desktops, the CI runners and some old GPUs cannot, and
 * react-three-fiber then throws while the canvas mounts: the error reached the root boundary and replaced the whole app
 * with "Algo deu errado" (found by the Linux E2E on the Ask page).
 *
 * @example if (!hasWebGl()) return <span className="rings-placeholder" />;
 */
export function hasWebGl(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): boolean {
  try {
    const canvas = createCanvas();
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    // Some drivers throw instead of returning null; either way there is nothing to draw with.
    return false;
  }
}
