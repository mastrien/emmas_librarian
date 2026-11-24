// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { AGENT_MODELS, agentModel } from '../runtime/agentModels';
import { chooseDevice, parseDevices } from '../runtime/devices';
import { findFreePort } from '../runtime/freePort';
import { chatServerArgs, decisionServerArgs } from '../runtime/serverArgs';

const CUDA = 'Available devices:\n  CUDA0: NVIDIA L4 (22563 MiB, 22369 MiB free)\n';
const VULKAN =
  'ggml_vulkan: Found 1 Vulkan devices:\nAvailable devices:\n  Vulkan0: AMD Radeon RX 580 Series (8192 MiB, 8000 MiB free)\n';
const SOFTWARE = 'Available devices:\n  Vulkan0: llvmpipe (LLVM 15.0.7, 256 bits) (30000 MiB, 30000 MiB free)\n';

describe('the models of the agent', () => {
  it('has one chat and one decision model, each with a published size and SHA-256', () => {
    expect(AGENT_MODELS.map((model) => model.role)).toEqual(['chat', 'decision']);
    for (const model of AGENT_MODELS) {
      expect(model.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(model.sizeBytes).toBeGreaterThan(1e9);
      expect(model.url).toBe(
        `https://huggingface.co/LiquidAI/${model.id === 'd1-2b' ? 'd1-2B-GGUF' : 'LFM3-1.7B-GGUF'}/resolve/main/${model.file}`,
      );
    }
  });

  it('finds the model of a role, and says which roles exist when asked for another', () => {
    expect(agentModel('chat').id).toBe('lfm3-1.7b');
    expect(agentModel('decision').id).toBe('d1-2b');
    expect(() => agentModel('voice' as 'chat')).toThrow(/ERR_NO_AGENT_MODEL.*"voice".*chat or decision/s);
  });
});

describe('devices', () => {
  it('reads the id, the name and the memory of each device, and ignores the other lines', () => {
    expect(parseDevices(CUDA)).toEqual([{ id: 'CUDA0', backend: 'CUDA', name: 'NVIDIA L4', memoryMiB: 22563 }]);
    expect(parseDevices(VULKAN)).toEqual([
      { id: 'Vulkan0', backend: 'Vulkan', name: 'AMD Radeon RX 580 Series', memoryMiB: 8192 },
    ]);
    expect(parseDevices('nothing here')).toEqual([]);
  });

  it('prefers CUDA over Vulkan, and the larger memory within a backend', () => {
    const devices = parseDevices(
      `${VULKAN}  Vulkan1: Other (16000 MiB, 1 MiB free)\n  CUDA0: GPU (4096 MiB, 4000 MiB free)`,
    );
    expect(chooseDevice(devices, 2048)).toBe('CUDA0');
    expect(
      chooseDevice(
        devices.filter((device) => device.backend === 'Vulkan'),
        2048,
      ),
    ).toBe('Vulkan1');
  });

  it('leaves the choice empty (the processor) for a software renderer, a card too small, or no device', () => {
    expect(chooseDevice(parseDevices(SOFTWARE), 2048)).toBe('');
    expect(chooseDevice(parseDevices(VULKAN), 16000)).toBe('');
    expect(chooseDevice([], 2048)).toBe('');
  });
});

describe('findFreePort', () => {
  it('gives a port above 1023, and a different one when asked again while the first is not kept', async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThan(1023);
    expect(Number.isInteger(port)).toBe(true);
  });
});

describe('server arguments', () => {
  const launch = { modelPath: '/m/x.gguf', contextSize: 4096, device: 'Vulkan0', port: 8090 };

  it('starts a chat model with its template, the device and a fixed seed', () => {
    const args = chatServerArgs({ ...launch, contextSize: 16384 }, { enable_thinking: false });
    expect(args).toEqual(
      expect.arrayContaining(['-m', '/m/x.gguf', '--jinja', '-c', '16384', '--device', 'Vulkan0', '--seed', '42']),
    );
    expect(args.slice(-2)).toEqual(['--chat-template-kwargs', '{"enable_thinking":false}']);
  });

  it('leaves out the device and the template arguments when there are none', () => {
    const args = chatServerArgs({ ...launch, device: '' });
    expect(args).not.toContain('--device');
    expect(args).not.toContain('--chat-template-kwargs');
  });

  it('starts a decision model with no template and a batch as big as the context', () => {
    const args = decisionServerArgs(launch);
    expect(args).toEqual(expect.arrayContaining(['-b', '4096', '-ub', '4096', '--port', '8090']));
    expect(args).not.toContain('--jinja');
  });

  // Surviving mutation of the review of #202: 0.0.0.0 would open both servers to the network.
  it('binds both servers to the loopback only', () => {
    for (const args of [chatServerArgs(launch), decisionServerArgs(launch)])
      expect(args[args.indexOf('--host') + 1]).toBe('127.0.0.1');
  });
});
