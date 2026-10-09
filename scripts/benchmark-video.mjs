import { chromium } from '@playwright/test'

const url = process.argv[2] || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
try {
  const page = await browser.newPage()
  await page.goto(url)
  const result = await page.evaluate(async () => {
    const { FFmpeg } = await import('/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js')
    const { conversionArgs } = await import('/src/lib/converter.ts')
    const singleURL = URL.createObjectURL(new Blob([await (await fetch('/ffmpeg/ffmpeg-core.js')).text()], { type: 'text/javascript' }))
    const multiURL = URL.createObjectURL(new Blob([await (await fetch('/ffmpeg/mt/ffmpeg-core.js')).text()], { type: 'text/javascript' }))
    const single = new FFmpeg()
    const multi = new FFmpeg()
    try {
      const core = await (await import(singleURL)).default({
        wasmBinary: new Uint8Array(await (await fetch('/ffmpeg/ffmpeg-core.wasm')).arrayBuffer()),
      })
      const inputs = {}
      for (const format of ['mov', 'webm']) {
        core.exec('-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
          '-t', '4', '-threads', '1',
          ...(format === 'mov' ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac'] : ['-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis']),
          `fixture.${format}`)
        if (core.ret !== 0) throw new Error('fixture failed')
        inputs[format] = core.FS.readFile(`fixture.${format}`)
        core.reset()
      }
      await single.load({ coreURL: singleURL, wasmURL: new URL('/ffmpeg/ffmpeg-core.wasm', globalThis.location.href).href })
      await multi.load({
        coreURL: multiURL,
        wasmURL: new URL('/ffmpeg/mt/ffmpeg-core.wasm', globalThis.location.href).href,
        workerURL: new URL('/ffmpeg/mt/ffmpeg-core.worker.js', globalThis.location.href).href,
      })
      const threads = Math.min(4, Math.floor(globalThis.navigator.hardwareConcurrency / 2))
      const streams = [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p' }, { codec_type: 'audio', codec_name: 'aac' }]
      async function run(engine, inputFormat, options, probe = false) {
        const start = performance.now()
        await engine.writeFile(`input.${inputFormat}`, inputs[inputFormat].slice())
        if (probe) {
          await engine.ffprobe(['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt', '-of', 'json', `input.${inputFormat}`, '-o', 'probe.json'])
          JSON.parse(await engine.readFile('probe.json', 'utf8'))
        }
        const code = await engine.exec(conversionArgs({ kind: 'video', format: 'mp4' }, `input.${inputFormat}`, 'output.mp4', options))
        if (code !== 0) throw new Error('conversion failed')
        const output = await engine.readFile('output.mp4')
        if (!output.byteLength) throw new Error('empty result')
        const elapsed = performance.now() - start
        await Promise.allSettled([`input.${inputFormat}`, 'output.mp4', 'probe.json'].map(path => engine.deleteFile(path)))
        return elapsed
      }
      const cases = [
        ['mov-reencode-single', single, 'mov', { forceTranscode: true, threads: 1 }, false],
        ['mov-copy-single', single, 'mov', { streams, threads: 1 }, true],
        ['webm-reencode-single', single, 'webm', { forceTranscode: true, threads: 1 }, false],
        ['webm-reencode-multi', multi, 'webm', { forceTranscode: true, threads }, false],
      ]
      const samples = {}
      for (const [name, engine, format, options, probe] of cases) {
        await run(engine, format, options, probe)
        samples[name] = []
        for (let index = 0; index < 3; index++) samples[name].push(Math.round(await run(engine, format, options, probe)))
      }
      return { input: 'synthetic 1280x720, 24 fps, 4 seconds, audio', coldLoadExcluded: true, logicalCores: globalThis.navigator.hardwareConcurrency, threads, samples }
    } finally {
      single.terminate()
      multi.terminate()
      URL.revokeObjectURL(singleURL)
      URL.revokeObjectURL(multiURL)
    }
  })
  console.log(JSON.stringify(result, null, 2))
} finally { await browser.close() }
