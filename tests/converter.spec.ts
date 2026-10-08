import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { extension, formatSize, mediaKind, outputName, MAX_FILE_SIZE } from '../src/lib/files'
import { conversionArgs } from '../src/lib/converter'

async function png(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 24
    const context = canvas.getContext('2d')!
    context.fillStyle = '#245bcc'
    context.fillRect(0, 0, 32, 24)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  return Buffer.from(bytes)
}

function wav() {
  const samples = 8000
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(8000, 24)
  buffer.writeUInt32LE(16000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++) buffer.writeInt16LE(Math.sin(index * 2 * Math.PI * 440 / 8000) * 4000, 44 + index * 2)
  return buffer
}

async function webm(page: Page, withAudio = true) {
  const bytes = await page.evaluate(async audio => {
    const response = await fetch('/ffmpeg/ffmpeg-core.js')
    const scriptURL = URL.createObjectURL(new Blob([await response.text()], { type: 'text/javascript' }))
    try {
      const factory = (await import(scriptURL)).default
      const wasm = await (await fetch('/ffmpeg/ffmpeg-core.wasm')).arrayBuffer()
      const core = await factory({ wasmBinary: new Uint8Array(wasm) })
      const args = ['-f', 'lavfi', '-i', 'color=c=blue:s=64x48:r=10']
      if (audio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000')
      args.push('-t', '1', '-c:v', 'libvpx', '-b:v', '100k', '-pix_fmt', 'yuv420p')
      args.push(...(audio ? ['-c:a', 'libvorbis'] : ['-an']))
      core.exec(...args, 'fixture.webm')
      if (core.ret !== 0) throw new Error('video fixture failed')
      const result = Array.from(core.FS.readFile('fixture.webm') as Uint8Array)
      core.FS.unlink('fixture.webm')
      return result
    } finally {
      URL.revokeObjectURL(scriptURL)
    }
  }, withAudio)
  const metadata = await page.evaluate(async data => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'video/webm' }))
    const video = document.createElement('video')
    try {
      return await new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
        video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
        video.onerror = () => reject(new Error('invalid video fixture'))
        video.src = url
      })
    } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url) }
  }, bytes)
  expect(metadata.width).toBe(64)
  expect(metadata.height).toBe(48)
  expect(metadata.duration).toBeGreaterThan(0.9)
  return Buffer.from(bytes)
}


async function convert(page: Page, count: number) {
  await page.getByRole('button', { name: /^converter arquivo/ }).click()
  await expect(page.locator('.status-done')).toHaveCount(count, { timeout: 90_000 })
  await expect(page.locator('.queue-hint')).toContainText('conversão concluída')
}

async function readResults(page: Page) {
  return page.locator('.download-button').evaluateAll(async links => Promise.all(links.map(async link => {
    const anchor = link as HTMLAnchorElement
    const bytes = new Uint8Array(await (await fetch(anchor.href)).arrayBuffer())
    return { name: anchor.download, bytes: Array.from(bytes) }
  })))
}

test('file naming, category fallback and codec rules', () => {
  expect(outputName('Foto.final.v2.PNG', 'webp')).toBe('Foto.final.v2.webp')
  expect(outputName('arquivo', 'mp3')).toBe('arquivo.mp3')
  expect(extension('Foto.PNG')).toBe('png')
  expect(mediaKind({ name: 'sound.WAV', type: '' })).toBe('audio')
  expect(mediaKind({ name: 'video.mkv', type: 'application/octet-stream' })).toBe('video')
  expect(mediaKind({ name: 'fake.png', type: 'application/pdf' })).toBeNull()
  expect(formatSize(1024)).toBe('1 kb')
  expect(MAX_FILE_SIZE).toBe(209715200)
  expect(conversionArgs({ kind: 'video', format: 'mp3' }, 'a', 'b')).toContain('-vn')
  expect(conversionArgs({ kind: 'video', format: 'mp4' }, 'a', 'b')).toContain('0:a:0?')
  expect(() => conversionArgs({ kind: 'image', format: 'avi' }, 'a', 'b')).toThrow()
})

test('all image outputs, duplicate names, same extension and explicit downloads', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const requests: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') requests.push(request.method()) })
  await page.goto('/')
  const buffer = await png(page)
  const payload = { name: 'Foto.final.v2.png', mimeType: 'image/png', buffer }
  await page.locator('input[type=file]').setInputFiles([payload, payload, payload])
  const selects = page.getByRole('combobox', { name: /^formato de saída de / })
  await expect(selects).toHaveCount(3)
  await selects.nth(0).selectOption('jpg')
  await selects.nth(1).selectOption('png')
  await selects.nth(2).selectOption('webp')
  await convert(page, 3)
  const outputs = await readResults(page)
  expect(outputs.map(output => output.name)).toEqual(['Foto.final.v2.jpg', 'Foto.final.v2.png', 'Foto.final.v2.webp'])
  for (const output of outputs) {
    const dimensions = await page.evaluate(async bytes => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]))
      return [image.width, image.height]
    }, output.bytes)
    expect(dimensions).toEqual([32, 24])
  }
  const downloading = page.waitForEvent('download')
  await page.getByRole('link', { name: 'baixar Foto.final.v2.webp' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('Foto.final.v2.webp')
  await download.saveAs(testInfo.outputPath('converted.webp'))
  expect(errors).toEqual([])
  expect(requests).toEqual([])
  await page.getByRole('button', { name: 'remover Foto.final.v2.png', exact: true }).nth(1).click()
  await expect(page.getByRole('combobox', { name: /^formato de saída de / })).toHaveCount(2)
  await page.getByRole('button', { name: 'limpar fila' }).click()
  await expect(page.getByRole('combobox', { name: /^formato de saída de / })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'selecionar arquivos', exact: true })).toBeVisible()
})

test('all audio outputs decode as real audio', async ({ page }, testInfo) => {
  await page.goto('/')
  const outputs = ['mp3', 'wav', 'ogg', 'aac', 'flac']
  await page.locator('input[type=file]').setInputFiles(outputs.map(format => ({ name: `tom.${format}.wav`, mimeType: 'audio/wav', buffer: wav() })))
  for (const [index, format] of outputs.entries()) await page.getByRole('combobox', { name: /^formato de saída de / }).nth(index).selectOption(format)
  await convert(page, outputs.length)
  for (const output of await readResults(page)) {
    const duration = await page.evaluate(async bytes => {
      const context = new AudioContext()
      try { return (await context.decodeAudioData(new Uint8Array(bytes).buffer)).duration }
      finally { await context.close() }
    }, output.bytes)
    expect(duration).toBeGreaterThan(0.8)
    expect(output.bytes.length).toBeGreaterThan(100)
    const downloading = page.waitForEvent('download')
    await page.getByRole('link', { name: `baixar ${output.name}`, exact: true }).click()
    await (await downloading).saveAs(testInfo.outputPath(output.name))
  }
})

test('all video outputs and audio extraction produce usable media', async ({ page }, testInfo) => {
  await page.goto('/')
  const buffer = await webm(page)
  const outputs = ['mp4', 'webm', 'mov', 'mkv', 'mp3']
  await page.locator('input[type=file]').setInputFiles(outputs.map(format => ({ name: `clipe.${format}.webm`, mimeType: 'video/webm', buffer })))
  for (const [index, format] of outputs.entries()) await page.getByRole('combobox', { name: /^formato de saída de / }).nth(index).selectOption(format)
  await convert(page, outputs.length)
  for (const output of await readResults(page)) {
    const duration = await page.evaluate(async ({ bytes, name }) => {
      const element = document.createElement(name.endsWith('.mp3') ? 'audio' : 'video')
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]))
      try {
        return await new Promise<number>((resolve, reject) => {
          element.onloadedmetadata = () => resolve(element.duration)
          element.onerror = () => reject(new Error(`cannot decode ${name}`))
          element.src = url
        })
      } finally { element.removeAttribute('src'); element.load(); URL.revokeObjectURL(url) }
    }, output)
    expect(duration).toBeGreaterThan(0.3)
    const downloading = page.waitForEvent('download')
    await page.getByRole('link', { name: `baixar ${output.name}`, exact: true }).click()
    await (await downloading).saveAs(testInfo.outputPath(output.name))
  }
})

test('partial failures, video without audio, retry and new files after conversion', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'quebrado.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') },
    { name: 'silencioso.webm', mimeType: 'video/webm', buffer: await webm(page, false) },
  ])
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(0).selectOption('webp')
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(1).selectOption('mp4')
  await page.getByRole('button', { name: 'converter arquivos', exact: true }).click()
  await expect(page.locator('.status-error')).toHaveCount(1)
  await expect(page.locator('.status-done')).toHaveCount(1)
  await page.getByRole('button', { name: 'tentar novamente quebrado.png' }).click()
  await expect(page.locator('.file-error')).toContainText('corrompido')
  await expect(page.locator('.status-done')).toHaveCount(1)
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(1).selectOption('mp3')
  await page.getByRole('button', { name: 'converter arquivos', exact: true }).click()
  await expect(page.locator('.status-error')).toHaveCount(2)
  await expect(page.locator('.file-error').nth(1)).toContainText('faixa de áudio')
  await page.getByRole('button', { name: 'remover quebrado.png' }).click()
  await page.getByRole('button', { name: 'remover silencioso.webm' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'novo.png', mimeType: 'image/png', buffer: await png(page) })
  await page.getByRole('combobox', { name: /^formato de saída de / }).selectOption('png')
  await convert(page, 1)
})

test('engine load failure is visible and retry recovers', async ({ page }) => {
  await page.route('**/ffmpeg/ffmpeg-core.js', route => route.abort())
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'teste.png', mimeType: 'image/png', buffer: await png(page) })
  await page.getByRole('combobox', { name: /^formato de saída de / }).selectOption('png')
  await page.getByRole('button', { name: 'converter arquivo', exact: true }).click()
  await expect(page.locator('.file-error')).toContainText('carregar o conversor')
  await page.unroute('**/ffmpeg/ffmpeg-core.js')
  await page.getByRole('button', { name: 'tentar novamente teste.png' }).click()
  await expect(page.locator('.status-done')).toHaveCount(1)
})

test('empty and invalid files, extension fallback, format clearing and size limit', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'vazio.png', mimeType: 'image/png', buffer: Buffer.alloc(0) },
    { name: 'texto.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') },
  ])
  await expect(page.getByRole('alert')).toContainText('vazio')
  await expect(page.getByRole('alert')).toContainText('compatível')
  await expect(page.getByRole('combobox', { name: /^formato de saída de / })).toHaveCount(0)
  await page.evaluate(() => {
    const file = new File([new Uint8Array(200 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })
    const transfer = new DataTransfer()
    transfer.items.add(file)
    document.querySelector('.dropzone')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }))
  })
  await expect(page.getByRole('alert')).toContainText('200 mb')
  await expect(page.getByRole('combobox', { name: /^formato de saída de / })).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles({ name: 'sem.mime.PNG', mimeType: '', buffer: await png(page) })
  await page.getByRole('combobox', { name: /^formato de saída de / }).selectOption('webp')
  await expect(page.getByRole('button', { name: 'converter arquivo', exact: true })).toBeEnabled()
  await page.getByRole('combobox', { name: /^formato de saída de / }).selectOption('')
  await expect(page.getByRole('button', { name: 'converter arquivo', exact: true })).toBeDisabled()
  await page.getByRole('combobox', { name: /^formato de saída de / }).selectOption('png')
  await convert(page, 1)
})

test('responsive layouts, keyboard, reduced motion and every real link', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark')
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1024, height: 600 },
    { width: 768, height: 720 },
    { width: 375, height: 667 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    const upload = await page.getByRole('button', { name: 'selecionar arquivos', exact: true }).boundingBox()
    expect(upload).not.toBeNull()
    expect(upload!.y).toBeGreaterThanOrEqual(0)
    expect(upload!.y + upload!.height).toBeLessThanOrEqual(viewport.height)
    const box = await page.locator('.dropzone').boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    await page.screenshot({ path: testInfo.outputPath(`first-screen-${viewport.width}-${viewport.height}.png`) })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'ir para o conversor' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'selecionar arquivos', exact: true })).toBeFocused()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooserPromise).setFiles({ name: 'Arquivo.com.nome.muito.longo.para.verificar.o.layout.png', mimeType: 'image/png', buffer: await png(page) })
  await page.getByRole('combobox', { name: /^formato de saída de / }).focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: /^formato de saída de / })).toHaveValue('jpg')
  const outline = await page.getByRole('combobox', { name: /^formato de saída de / }).evaluate(element => getComputedStyle(element).outlineStyle)
  expect(outline).not.toBe('none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath(`queue-${width}.png`), fullPage: true })
  }
  const links = await page.getByRole('link').evaluateAll(elements => elements.map(element => element.getAttribute('href')))
  expect(links).toEqual(['#converter', 'https://github.com/vbzt', 'https://github.com/vbzt/Any2Any'])
  await page.getByRole('button', { name: 'limpar fila' }).click()
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath(`empty-${width}.png`), fullPage: true })
  }
})



test('busy queue stays fixed and completed results release their URLs', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const state = window as Window & { revokedUrls: string[] }
    state.revokedUrls = []
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = url => { state.revokedUrls.push(url); revoke(url) }
  })
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/ffmpeg/ffmpeg-core.js', async route => { await gate; await route.continue() })
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'ok.png', mimeType: 'image/png', buffer: await png(page) },
    { name: 'erro.png', mimeType: 'image/png', buffer: Buffer.from('invalid') },
  ])
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(0).selectOption('webp')
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(1).selectOption('png')
  await page.getByRole('button', { name: 'converter arquivos', exact: true }).click()
  await expect(page.getByRole('button', { name: 'convertendo', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'adicionar arquivos', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'limpar fila' })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: /^formato de saída de / }).nth(0)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'remover ok.png' })).toBeDisabled()
  await page.evaluate(() => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['abc'], 'nao.adicionar.png', { type: 'image/png' }))
    document.querySelector('.dropzone')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }))
  })
  await expect(page.locator('.file-row')).toHaveCount(2)
  release()
  await expect(page.locator('.status-done')).toHaveCount(1)
  await expect(page.locator('.status-error')).toHaveCount(1)
  const firstUrl = await page.getByRole('link', { name: 'baixar ok.webp' }).getAttribute('href')
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath(`results-${width}.png`), fullPage: true })
  }
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(0).selectOption('png')
  await expect(page.getByRole('link', { name: 'baixar ok.webp' })).toHaveCount(0)
  expect(await page.evaluate(() => (window as Window & { revokedUrls: string[] }).revokedUrls)).toContain(firstUrl)
  await page.getByRole('button', { name: 'remover erro.png' }).click()
  await convert(page, 1)
  const secondUrl = await page.getByRole('link', { name: 'baixar ok.png' }).getAttribute('href')
  await page.getByRole('button', { name: 'limpar fila' }).click()
  expect(await page.evaluate(() => (window as Window & { revokedUrls: string[] }).revokedUrls)).toContain(secondUrl)
})

test('text, controls and focus colors meet contrast thresholds', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'contraste.png', mimeType: 'image/png', buffer: await png(page) })
  const colors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const dropzone = document.querySelector('.dropzone')!
    const backgrounds = [root.backgroundColor, getComputedStyle(dropzone).backgroundColor]
    for (const state of ['is-dragging', 'is-disabled']) {
      dropzone.classList.add(state)
      backgrounds.push(getComputedStyle(dropzone).backgroundColor)
      dropzone.classList.remove(state)
    }
    const button = getComputedStyle(document.querySelector('.primary-button')!)
    const select = getComputedStyle(document.querySelector('select')!)
    return {
      text: ['--text', '--muted', '--accent', '--error'].map(name => root.getPropertyValue(name).trim()),
      backgrounds,
      button: [button.color, button.backgroundColor],
      control: [select.borderTopColor, select.backgroundColor],
      focus: root.getPropertyValue('--accent').trim(),
    }
  })
  function luminance(color: string) {
    const channels = (color.startsWith('#')
      ? color.match(/[a-f0-9]{2}/gi)!.map(value => parseInt(value, 16))
      : color.match(/[\d.]+/g)!.slice(0, 3).map(Number))
      .map(value => value / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  function ratio(first: string, second: string) {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }
  for (const foreground of colors.text) {
    for (const background of colors.backgrounds) expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5)
  }
  expect(ratio(colors.button[0], colors.button[1])).toBeGreaterThanOrEqual(4.5)
  expect(ratio(colors.control[0], colors.control[1])).toBeGreaterThanOrEqual(3)
  expect(ratio(colors.focus, colors.backgrounds[0])).toBeGreaterThanOrEqual(3)
})
