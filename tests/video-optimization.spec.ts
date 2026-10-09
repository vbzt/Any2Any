import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function fixture(page: Page, format: 'mov' | 'webm' = 'mov', pcm = false) {
  return Buffer.from(await page.evaluate(async ({ format, pcm }) => {
    const scriptURL = URL.createObjectURL(new Blob([await (await fetch('/ffmpeg/ffmpeg-core.js')).text()], { type: 'text/javascript' }))
    try {
      const core = await (await import(scriptURL)).default({
        wasmBinary: new Uint8Array(await (await fetch('/ffmpeg/ffmpeg-core.wasm')).arrayBuffer()),
      })
      const video = format === 'webm' ? ['-c:v', 'libvpx', '-b:v', '200k'] : ['-c:v', 'libx264', '-preset', 'ultrafast']
      const audio = pcm ? ['-c:a', 'pcm_s16le'] : ['-c:a', format === 'webm' ? 'libvorbis' : 'aac']
      core.exec('-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
        '-t', '1', '-threads', '1', ...video, ...audio, `fixture.${format}`)
      if (core.ret !== 0) throw new Error('fixture failed')
      return Array.from(core.FS.readFile(`fixture.${format}`) as Uint8Array)
    } finally { URL.revokeObjectURL(scriptURL) }
  }, { format, pcm }))
}

async function inspect(page: Page, bytes: Buffer) {
  return page.evaluate(async bytes => {
    const scriptURL = URL.createObjectURL(new Blob([await (await fetch('/ffmpeg/ffmpeg-core.js')).text()], { type: 'text/javascript' }))
    try {
      const core = await (await import(scriptURL)).default({
        wasmBinary: new Uint8Array(await (await fetch('/ffmpeg/ffmpeg-core.wasm')).arrayBuffer()),
      })
      core.FS.writeFile('media', new Uint8Array(bytes))
      core.ffprobe('-v', 'error', '-show_streams', '-show_packets', '-show_data_hash', 'sha256',
        '-show_entries', 'stream=codec_type,codec_name,width,height:packet=codec_type,data_hash',
        '-of', 'json', 'media', '-o', 'probe.json')
      if (core.ret !== 0 && core.ret !== -1) throw new Error('probe failed')
      return JSON.parse(core.FS.readFile('probe.json', { encoding: 'utf8' })) as {
        streams: { codec_type: string; codec_name: string; width?: number; height?: number }[]
        packets: { codec_type: string; data_hash: string }[]
      }
    } finally { URL.revokeObjectURL(scriptURL) }
  }, Array.from(bytes))
}

async function output(page: Page) {
  await expect(page.locator('.status-done, .status-error')).toHaveCount(1)
  await expect(page.locator('.status-error')).toHaveCount(0)
  await expect(page.locator('.status-done')).toHaveCount(1)
  return Buffer.from(await page.locator('.download-button').evaluate(async link =>
    Array.from(new Uint8Array(await (await fetch((link as HTMLAnchorElement).href)).arrayBuffer()))))
}

async function convert(page: Page, buffer: Buffer, name: string, format: string) {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: name.endsWith('.webm') ? 'video/webm' : 'video/quicktime', buffer })
  await page.locator('.format-select select').selectOption(format)
  await page.locator('.convert-button').click()
  return output(page)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true })
  })
})

test('video optimization preserves encoded packets in compatible MOV to MP4', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/ffmpeg/mt/')) requests.push(request.url()) })
  await page.goto('/')
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  const input = await fixture(page)
  const result = await convert(page, input, 'camera.mov', 'mp4')
  const before = await inspect(page, input)
  const after = await inspect(page, result)
  for (const kind of ['video', 'audio']) {
    expect(after.packets.filter(packet => packet.codec_type === kind).map(packet => packet.data_hash))
      .toEqual(before.packets.filter(packet => packet.codec_type === kind).map(packet => packet.data_hash))
  }
  expect(after.streams.map(stream => stream.codec_name)).toEqual(['h264', 'aac'])
  expect(requests.some(url => url.endsWith('ffmpeg-core.worker.js'))).toBe(true)
})

test('video optimization copies H264 and converts incompatible PCM audio', async ({ page }) => {
  await page.goto('/')
  const input = await fixture(page, 'mov', true)
  const result = await convert(page, input, 'audio-pcm.mov', 'mp4')
  const before = await inspect(page, input)
  const after = await inspect(page, result)
  expect(after.packets.filter(packet => packet.codec_type === 'video').map(packet => packet.data_hash))
    .toEqual(before.packets.filter(packet => packet.codec_type === 'video').map(packet => packet.data_hash))
  expect(after.streams.find(stream => stream.codec_type === 'audio')?.codec_name).toBe('aac')
})

test('video optimization transcodes incompatible WebM video in multithread mode', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/ffmpeg/mt/')) requests.push(request.url()) })
  await page.goto('/')
  const result = await convert(page, await fixture(page, 'webm'), 'recording.webm', 'mp4')
  const after = await inspect(page, result)
  expect(after.streams.map(stream => stream.codec_name)).toEqual(['h264', 'aac'])
  expect(after.streams[0]).toMatchObject({ width: 320, height: 180 })
  expect(requests.some(url => url.endsWith('ffmpeg-core.worker.js'))).toBe(true)
})

test('video optimization falls back when multithread assets fail to load', async ({ page }) => {
  let attempts = 0
  await page.route('**/ffmpeg/mt/ffmpeg-core.js', route => { attempts++; return route.abort() })
  await page.goto('/')
  const input = await fixture(page)
  await convert(page, input, 'fallback.mov', 'mp4')
  await page.getByRole('button', { name: 'limpar fila' }).click()
  await convert(page, input, 'again.mov', 'mp4')
  expect(attempts).toBe(1)
})

test('video optimization falls back after a fatal multithread execution failure', async ({ page }) => {
  let attempts = 0
  await page.route('**/ffmpeg/mt/ffmpeg-core.js', async route => {
    attempts++
    const response = await route.fetch()
    const source = await response.text()
    expect(source).toContain('export default createFFmpegCore;')
    await route.fulfill({ response, body: source.replace('export default createFFmpegCore;', `
      export default async options => {
        const core = await createFFmpegCore(options);
        core.exec = () => { throw new WebAssembly.RuntimeError('memory access out of bounds'); };
        return core;
      };
    `) })
  })
  await page.goto('/')
  const input = await fixture(page)
  await convert(page, input, 'runtime.mov', 'mp4')
  await page.getByRole('button', { name: 'limpar fila' }).click()
  await convert(page, input, 'after.mov', 'mp4')
  expect(attempts).toBe(1)
  await expect(page.locator('.status-error')).toHaveCount(0)
})

for (const reason of ['without isolation', 'on low-memory devices', 'with few CPU cores']) {
  test(`video optimization uses single thread ${reason}`, async ({ page }) => {
    const requests: string[] = []
    if (reason === 'without isolation') {
      await page.route('**/', async route => {
        const response = await route.fetch()
        const headers = response.headers()
        delete headers['cross-origin-opener-policy']
        delete headers['cross-origin-embedder-policy']
        await route.fulfill({ response, headers })
      })
    }
    page.on('request', request => { if (request.url().includes('/ffmpeg/mt/')) requests.push(request.url()) })
    await page.goto('/')
    if (reason === 'on low-memory devices') {
      await page.evaluate(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }))
    }
    if (reason === 'with few CPU cores') {
      await page.evaluate(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }))
    }
    if (reason === 'without isolation') expect(await page.evaluate(() => crossOriginIsolated)).toBe(false)
    await convert(page, await fixture(page, 'webm'), 'compatible.webm', 'mp4')
    expect(requests).toEqual([])
  })
}

test('video optimization retries rejected stream copy with a fresh transcoding engine', async ({ page }) => {
  await page.route('**/ffmpeg/mt/ffmpeg-core.js', async route => {
    const response = await route.fetch()
    const source = await response.text()
    await route.fulfill({ response, body: source.replace('export default createFFmpegCore;', `
      export default async options => {
        const core = await createFFmpegCore(options);
        const exec = core.exec;
        core.exec = (...args) => {
          if (args.includes('copy')) { core.ret = 1; return 1; }
          return exec(...args);
        };
        return core;
      };
    `) })
  })
  await page.goto('/')
  const result = await convert(page, await fixture(page), 'retry-copy.mov', 'mp4')
  expect((await inspect(page, result)).streams.map(stream => stream.codec_name)).toEqual(['h264', 'aac'])
})

test('video optimization contains corrupt input and converts the following video', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'broken.mov', mimeType: 'video/quicktime', buffer: Buffer.from('invalid') },
    { name: 'good.mov', mimeType: 'video/quicktime', buffer: await fixture(page) },
  ])
  await page.locator('.format-select select').nth(0).selectOption('mp4')
  await page.locator('.format-select select').nth(1).selectOption('mp4')
  await page.locator('.convert-button').click()
  await expect(page.locator('.status-error')).toHaveCount(1)
  await expect(page.locator('.status-done')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'baixar good.mp4' })).toBeVisible()
})
