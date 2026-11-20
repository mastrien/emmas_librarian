export interface LlamaDevice {
  /** The name llama.cpp takes in --device, e.g. CUDA0. */
  id: string;
  backend: string;
  name: string;
  memoryMiB: number;
}

/** The faster backends first; Vulkan is the one that works on most graphics cards. */
const BACKEND_ORDER = ['CUDA', 'Metal', 'ROCm', 'HIP', 'Vulkan', 'SYCL'];
const SOFTWARE = /llvmpipe|software|swiftshader|cpu/i;
const LINE = /^\s*([A-Za-z]+)(\d+):\s*(.+?)\s*\((\d+)\s*MiB/;

/**
 * The devices that `llama-server --list-devices` prints.
 *
 * Usage:
 *   parseDevices('Available devices:\n  CUDA0: NVIDIA L4 (22563 MiB, 22369 MiB free)'); // [{ id: 'CUDA0', ... }]
 */
export function parseDevices(listing: string): LlamaDevice[] {
  return listing.split('\n').flatMap((line) => {
    const found = LINE.exec(line);
    if (!found) return [];
    const [, backend, index, name, memory] = found;
    return [{ id: `${backend}${index}`, backend, name, memoryMiB: Number(memory) }];
  });
}

const rank = (device: LlamaDevice): number => {
  const position = BACKEND_ORDER.indexOf(device.backend);
  return position === -1 ? BACKEND_ORDER.length : position;
};

/**
 * The device to run the models on: a real graphics card with room for them, the fastest backend first and the most
 * memory within it. An empty text means "no --device": let llama.cpp use the processor.
 *
 * Usage:
 *   chooseDevice(parseDevices(listing), 2048); // 'CUDA0', or '' when nothing has 2 GiB
 */
export function chooseDevice(devices: LlamaDevice[], minMemoryMiB: number): string {
  const usable = devices.filter((device) => !SOFTWARE.test(device.name) && device.memoryMiB >= minMemoryMiB);
  const best = [...usable].sort((a, b) => rank(a) - rank(b) || b.memoryMiB - a.memoryMiB)[0];
  return best?.id ?? '';
}
