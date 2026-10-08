import { expect, test } from '@playwright/test'

test('typography IBM Plex loads and keeps upload visible across viewports', async ({ page }, testInfo) => {
  await page.goto('/')
  const loaded = await page.evaluate(async () => {
    const faces = await Promise.all([400, 500, 600].map(weight => document.fonts.load(`${weight} 16px "IBM Plex Sans"`, 'conversão áudio código')))
    await document.fonts.ready
    return faces.map(group => group.filter(face => face.status === 'loaded').length)
  })
  for (const count of loaded) expect(count).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('conversor de arquivos')
  await expect(page.getByRole('combobox', { name: 'comparar fontes', exact: true })).toHaveCount(0)
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1024, height: 600 },
    { width: 768, height: 720 },
    { width: 375, height: 667 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    const box = await page.locator('.dropzone').boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    expect(await page.locator('h1').evaluate(element => getComputedStyle(element).fontFamily)).toContain('IBM Plex Sans')
    await page.screenshot({ path: testInfo.outputPath(`empty-plex-${viewport.width}.png`), fullPage: true })
  }
})
