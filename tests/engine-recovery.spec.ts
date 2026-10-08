import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function jpeg(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 321
    canvas.height = 241
    const context = canvas.getContext('2d')!
    context.fillStyle = '#245bcc'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg'))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  return Buffer.from(bytes)
}

test('jpeg same format preserves the image and keeps the engine usable', async ({ page }) => {
  await page.goto('/')
  const buffer = await jpeg(page)
  await page.locator('input[type=file]').setInputFiles([
    { name: 'foto.JPG', mimeType: 'image/jpeg', buffer },
    { name: 'alias.JPEG', mimeType: 'image/jpeg', buffer },
    { name: 'proxima.jpeg', mimeType: 'image/jpeg', buffer },
  ])
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(0).selectOption('jpg')
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(1).selectOption('jpg')
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(2).selectOption('png')
  await page.getByRole('button', { name: 'converter arquivos', exact: true }).click()
  await expect(page.locator('.status-done')).toHaveCount(3, { timeout: 90_000 })
  await expect(page.locator('.status-error')).toHaveCount(0)
  const outputs = await page.locator('.download-button').evaluateAll(async links => Promise.all(links.map(async link => {
    const anchor = link as HTMLAnchorElement
    const blob = await (await fetch(anchor.href)).blob()
    const image = await createImageBitmap(blob)
    const dimensions = [image.width, image.height]
    image.close()
    return { name: anchor.download, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), dimensions }
  })))
  expect(outputs.map(output => output.name)).toEqual(['foto.jpg', 'alias.jpg', 'proxima.png'])
  for (const output of outputs) expect(output.dimensions).toEqual([321, 241])
  expect(outputs[0].bytes).toEqual(Array.from(buffer))
  expect(outputs[1].bytes).toEqual(Array.from(buffer))
  await page.getByRole('button', { name: 'limpar fila' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'outra.jpeg', mimeType: 'image/jpeg', buffer })
  await page.getByRole('combobox', { name: /^formato de saída de / }).selectOption('webp')
  await page.getByRole('button', { name: 'converter arquivo', exact: true }).click()
  await expect(page.getByRole('link', { name: 'baixar outra.webp', exact: true })).toBeVisible()
})

test('fatal engine failure only fails one file and a fresh engine handles the rest and retry', async ({ page }) => {
  let loads = 0
  await page.route('**/ffmpeg/ffmpeg-core.js', async route => {
    loads++
    if (loads !== 1) { await route.continue(); return }
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
  const buffer = await jpeg(page)
  await page.locator('input[type=file]').setInputFiles([
    { name: 'primeira.jpg', mimeType: 'image/jpeg', buffer },
    { name: 'segunda.jpg', mimeType: 'image/jpeg', buffer },
  ])
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(0).selectOption('jpg')
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(1).selectOption('png')
  await page.getByRole('button', { name: 'converter arquivos', exact: true }).click()
  await expect(page.locator('.status-error')).toHaveCount(1)
  await expect(page.locator('.status-done')).toHaveCount(1)
  expect(loads).toBe(2)
  await expect(page.getByRole('button', { name: 'limpar fila' })).toBeEnabled()
  const completed = await page.getByRole('link', { name: 'baixar segunda.png' }).getAttribute('href')
  await page.getByRole('button', { name: 'tentar novamente primeira.jpg' }).click()
  await expect(page.locator('.status-done')).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'baixar segunda.png' })).toHaveAttribute('href', completed!)
  expect(loads).toBe(2)
})

test('corrupt jpeg same format fails locally and the next file converts', async ({ page }) => {
  await page.goto('/')
  const buffer = await jpeg(page)
  await page.locator('input[type=file]').setInputFiles([
    { name: 'corrompida.jpeg', mimeType: 'image/jpeg', buffer: buffer.subarray(0, 8) },
    { name: 'valida.jpg', mimeType: 'image/jpeg', buffer },
  ])
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(0).selectOption('jpg')
  await page.getByRole('combobox', { name: /^formato de saída de / }).nth(1).selectOption('png')
  await page.getByRole('button', { name: 'converter arquivos', exact: true }).click()
  await expect(page.locator('.status-error')).toHaveCount(1)
  await expect(page.locator('.file-error')).toContainText('corrompido')
  await expect(page.locator('.status-done')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'baixar corrompida.jpg' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'baixar valida.png' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'limpar fila' })).toBeEnabled()
})
